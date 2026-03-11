import { app, BrowserWindow, ipcMain, net } from 'electron';
import path from 'path';
import { PhonePilotMcpServer } from './mcp';
import { runPaddleOcrEn, stopPaddleOcrEnDaemon } from './paddleOcrEn';
import {
  setFrameCaptureCallback,
  setMcpLogCallback,
  setPreOcrCaptureCallback,
  setMnemonicOcrCallback,
  setVerifyOcrCallback,
  type MnemonicOcrResult,
  type MnemonicOcrRequest,
  type VerifyOcrResult,
} from './mcp/state';
import { saveCaptureToDownloads } from './saveCapture';

/**
 * Build output directory structure:
 * ├── dist-electron/
 * │   ├── main/main.js
 * │   └── preload/preload.js
 * └── dist/index.html
 */
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

let mainWindow: BrowserWindow | null = null;
let mcpServer: PhonePilotMcpServer | null = null;

/** Pending frame capture resolve function */
let pendingFrameResolve: ((frame: string | null) => void) | null = null;

/** Pending OCR-input capture resolve function */
let pendingPreOcrResolve: ((payload: string | null) => void) | null = null;
let pendingMnemonicOcrResolve: ((payload: MnemonicOcrResult | null) => void) | null = null;
let pendingVerifyOcrResolve: ((payload: VerifyOcrResult | null) => void) | null = null;

/** Use bracket notation to avoid vite:define plugin transformation */
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

/**
 * Creates the main application window.
 * Configures window size, preload script, and content loading.
 * Shows window only after ready to prevent visual flash.
 * Sends timestamp message to renderer on load.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send(
      'main-process-message',
      new Date().toLocaleString()
    );
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(process.env.DIST || '', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const HTTP_REQUEST_RETRY_DELAYS_MS = [250, 600] as const;

function isRetryableNetError(message: string): boolean {
  const normalized = message.toLowerCase();
  return [
    'err_network_changed',
    'err_internet_disconnected',
    'err_network_io_suspended',
    'err_name_not_resolved',
    'err_address_unreachable',
    'socket hang up',
  ].some((pattern) => normalized.includes(pattern));
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function performNetRequest(url: string): Promise<{ status: number | undefined; data: string }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= HTTP_REQUEST_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const request = net.request(url);
        let responseData = '';

        request.on('response', (response) => {
          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });

          response.on('end', () => {
            resolve({
              status: response.statusCode,
              data: responseData,
            });
          });

          response.on('error', (error: Error) => {
            reject(new Error(`Response error: ${error.message}`));
          });
        });

        request.on('error', (error) => {
          reject(new Error(`Request error: ${error.message}`));
        });

        request.end();
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const shouldRetry = isRetryableNetError(lastError.message)
        && attempt < HTTP_REQUEST_RETRY_DELAYS_MS.length;
      if (!shouldRetry) {
        throw lastError;
      }

      const retryDelay = HTTP_REQUEST_RETRY_DELAYS_MS[attempt];
      console.warn(
        `[http-request] Transient network error on attempt ${attempt + 1}, retrying in ${retryDelay}ms: ${lastError.message}`
      );
      await delayMs(retryDelay);
    }
  }

  throw lastError ?? new Error('Unknown request error');
}

/**
 * Performs an HTTP request to the arm controller.
 * Used by MCP Server for arm control commands.
 */
async function httpRequest(url: string): Promise<string> {
  const response = await performNetRequest(url);
  return response.data;
}

/**
 * Captures a frame from the renderer process via IPC.
 * Sends request to renderer and waits for response.
 */
async function captureFrameFromRenderer(): Promise<string | null> {
  if (!mainWindow) {
    console.warn('Cannot capture frame: mainWindow is null');
    return null;
  }

  return new Promise((resolve) => {
    // Set timeout in case renderer doesn't respond
    const timeout = setTimeout(() => {
      pendingFrameResolve = null;
      resolve(null);
    }, 5000);

    pendingFrameResolve = (frame: string | null) => {
      clearTimeout(timeout);
      pendingFrameResolve = null;
      resolve(frame);
    };

    // Request frame from renderer
    mainWindow.webContents.send('mcp-capture-frame-request');
  });
}

/**
 * Requests the OCR-input image from the renderer (crop + scale).
 * Returns data URL or base64 of the image sent to the OCR library, or null.
 */
async function getPreOcrImageFromRenderer(): Promise<string | null> {
  if (!mainWindow) {
    console.warn('Cannot capture OCR-input image: mainWindow is null');
    return null;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingPreOcrResolve = null;
      resolve(null);
    }, 5000);

    pendingPreOcrResolve = (payload: string | null) => {
      clearTimeout(timeout);
      pendingPreOcrResolve = null;
      resolve(payload);
    };

    mainWindow.webContents.send('capture-pre-ocr-request');
  });
}

async function runMnemonicOcrFromRenderer(
  request?: MnemonicOcrRequest
): Promise<MnemonicOcrResult | null> {
  if (!mainWindow) {
    console.warn('Cannot run mnemonic OCR: mainWindow is null');
    return null;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingMnemonicOcrResolve = null;
      resolve(null);
    }, 45000);

    pendingMnemonicOcrResolve = (payload: MnemonicOcrResult | null) => {
      clearTimeout(timeout);
      pendingMnemonicOcrResolve = null;
      resolve(payload);
    };

    mainWindow.webContents.send('mcp-ocr-request', request || null);
  });
}

async function runVerifyOcrFromRenderer(): Promise<VerifyOcrResult | null> {
  if (!mainWindow) {
    console.warn('Cannot run verify OCR: mainWindow is null');
    return null;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingVerifyOcrResolve = null;
      resolve(null);
    }, 45000);

    pendingVerifyOcrResolve = (payload: VerifyOcrResult | null) => {
      clearTimeout(timeout);
      pendingVerifyOcrResolve = null;
      resolve(payload);
    };

    mainWindow.webContents.send('mcp-verify-ocr-request');
  });
}

/**
 * Sends MCP log to renderer process.
 */
function sendMcpLogToRenderer(log: {
  type: 'request' | 'response' | 'error' | 'info';
  action: string;
  detail: string;
}): void {
  if (mainWindow) {
    mainWindow.webContents.send('mcp-log', log);
  }
}

/**
 * Initializes and starts the MCP Server.
 */
async function startMcpServer(): Promise<void> {
  // Set up frame capture callback
  setFrameCaptureCallback(captureFrameFromRenderer);
  setPreOcrCaptureCallback(getPreOcrImageFromRenderer);
  setMnemonicOcrCallback(runMnemonicOcrFromRenderer);
  setVerifyOcrCallback(runVerifyOcrFromRenderer);

  // Set up MCP log callback to forward logs to renderer
  setMcpLogCallback(sendMcpLogToRenderer);

  // Create and start MCP server
  mcpServer = new PhonePilotMcpServer(httpRequest);
  const port = await mcpServer.start();

  // Notify renderer when MCP server is ready
  if (mainWindow) {
    mainWindow.webContents.send('mcp-server-ready', { port });
  }
}

/**
 * App initialization.
 * Creates window when Electron is ready.
 * Starts MCP Server for Claude/Cursor integration.
 * On macOS, recreates window when dock icon is clicked with no windows open.
 */
app.whenReady().then(async () => {
  createWindow();

  // Start MCP Server after window is created
  try {
    await startMcpServer();
  } catch (error) {
    console.error('Failed to start MCP Server:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/** Quit when all windows are closed, except on macOS */
app.on('window-all-closed', () => {
  stopPaddleOcrEnDaemon();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/** Clean up MCP Server before quitting */
app.on('will-quit', () => {
  if (mcpServer) {
    mcpServer.stop();
    mcpServer = null;
  }
  stopPaddleOcrEnDaemon();
});

/** IPC handler: Returns app version */
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

/** IPC handler: Returns current platform */
ipcMain.handle('get-platform', () => {
  return process.platform;
});

/**
 * IPC handler: Performs HTTP request from main process.
 * Bypasses CORS restrictions that would block renderer process requests.
 *
 * @param url - Target URL for the HTTP request
 * @returns Promise resolving to { status, data }
 */
ipcMain.handle('http-request', async (_event, url: string) => {
  return performNetRequest(url);
});

/**
 * IPC handler: Syncs arm connection state from UI to MCP state.
 * Called when UI connects/disconnects from arm controller.
 */
ipcMain.handle('sync-arm-state', async (_event, state: {
  isConnected: boolean;
  resourceHandle: number;
  comPort: string;
}) => {
  const { updateArmState } = await import('./mcp/state.js');
  updateArmState({
    isConnected: state.isConnected,
    resourceHandle: state.resourceHandle,
    comPort: state.comPort,
  });
  console.log(`[sync-arm-state] Updated MCP armState:`, state);
});

ipcMain.handle(
  'save-capture-to-downloads',
  async (
    _event,
    { dataUrlOrBase64, hint }: { dataUrlOrBase64: string; hint: string }
  ) => saveCaptureToDownloads(dataUrlOrBase64, hint)
);

/**
 * IPC handler: Runs en_PP-OCRv5_mobile_rec inference in a Python subprocess.
 */
ipcMain.handle(
  'paddleocr-en-recognize',
  async (
    _event,
    payload: {
      imageDataUrl: string;
      layoutHint?: 'mnemonic' | 'verify-options' | 'verify-number' | 'generic';
      expectedWordCount?: number;
    }
  ) => runPaddleOcrEn(payload)
);

/**
 * IPC listener: Receives captured frame from renderer process.
 * Called in response to 'mcp-capture-frame-request'.
 */
ipcMain.on('mcp-capture-frame-response', (_event, frame: string | null) => {
  if (pendingFrameResolve) {
    pendingFrameResolve(frame);
  }
});

ipcMain.on('capture-pre-ocr-response', (_event, payload: string | null) => {
  if (pendingPreOcrResolve) {
    pendingPreOcrResolve(payload);
  }
});

ipcMain.on('mcp-ocr-response', (_event, payload: MnemonicOcrResult | null) => {
  if (pendingMnemonicOcrResolve) {
    pendingMnemonicOcrResolve(payload);
  }
});

ipcMain.on('mcp-verify-ocr-response', (_event, payload: VerifyOcrResult | null) => {
  if (pendingVerifyOcrResolve) {
    pendingVerifyOcrResolve(payload);
  }
});
