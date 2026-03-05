import { app } from 'electron';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface PaddleOcrEnRequest {
  imageDataUrl: string;
  layoutHint?: 'mnemonic' | 'verify-options' | 'verify-number' | 'generic';
  expectedWordCount?: number;
}

export interface PaddleOcrEnResult {
  text: string;
  confidence: number;
  backend: 'en_PP-OCRv5_mobile_rec';
  elapsedMs: number;
}

function resolvePythonBin(): string {
  return process.env.PHONEPILOT_PYTHON_BIN || 'python3';
}

function resolveInferScriptPath(): string {
  const candidates = [
    path.join(app.getAppPath(), 'scripts', 'paddleocr_en_infer.py'),
    path.join(process.cwd(), 'scripts', 'paddleocr_en_infer.py'),
    path.join(__dirname, '..', 'scripts', 'paddleocr_en_infer.py'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `paddleocr_en_infer.py not found. Checked: ${candidates.join(', ')}`
  );
}

export async function runPaddleOcrEn(
  request: PaddleOcrEnRequest
): Promise<PaddleOcrEnResult> {
  return daemon.send(request);
}

interface PendingRequest {
  resolve: (value: PaddleOcrEnResult) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

class PaddleOcrEnDaemon {
  private child: ChildProcessWithoutNullStreams | null = null;
  private startPromise: Promise<void> | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private stdoutBuffer = '';
  private stderrBuffer = '';

  async send(request: PaddleOcrEnRequest): Promise<PaddleOcrEnResult> {
    await this.ensureStarted();

    if (!this.child) {
      throw new Error('PP-OCRv5 rec daemon is not running');
    }

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('PP-OCRv5 rec request timed out after 2 minutes'));
      }, 2 * 60 * 1000);

      this.pending.set(id, { resolve, reject, timer });
      const line = JSON.stringify({ id, ...request });
      this.child?.stdin.write(`${line}\n`);
    });
  }

  stop(): void {
    if (this.child) {
      this.child.kill('SIGTERM');
      this.child = null;
    }
    this.startPromise = null;
    this.stdoutBuffer = '';
    this.rejectAllPending(new Error('PP-OCRv5 rec daemon stopped'));
  }

  private async ensureStarted(): Promise<void> {
    if (this.child) {
      return;
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    const pythonBin = resolvePythonBin();
    const scriptPath = resolveInferScriptPath();

    this.startPromise = new Promise((resolve, reject) => {
      const env = { ...process.env };
      env.PYTHONUNBUFFERED = '1';
      env.PHONEPILOT_OCR_MAX_IMAGE_SIDE = env.PHONEPILOT_OCR_MAX_IMAGE_SIDE || '1280';
      env.PHONEPILOT_OCR_CPU_THREADS = env.PHONEPILOT_OCR_CPU_THREADS || '4';
      env.PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK =
        env.PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK || 'True';
      env.MPLCONFIGDIR = env.MPLCONFIGDIR || '/tmp/matplotlib-phonepilot';

      // Avoid inheriting dead local proxy settings from shell/IDE.
      delete env.HTTP_PROXY;
      delete env.HTTPS_PROXY;
      delete env.ALL_PROXY;
      delete env.http_proxy;
      delete env.https_proxy;
      delete env.all_proxy;

      const child = spawn(pythonBin, [scriptPath, '--server'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });
      this.child = child;
      this.stderrBuffer = '';
      this.stdoutBuffer = '';

      const bootTimeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Timed out while starting PP-OCRv5 rec daemon'));
      }, 45 * 1000);

      child.stdout.on('data', (chunk: Buffer) => {
        this.stdoutBuffer += chunk.toString();
        this.consumeStdoutLines({
          onReady: () => {
            clearTimeout(bootTimeout);
            resolve();
          },
        });
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        this.stderrBuffer += text;
        if (this.stderrBuffer.length > 8 * 1024) {
          this.stderrBuffer = this.stderrBuffer.slice(-8 * 1024);
        }
      });

      child.on('error', (err) => {
        clearTimeout(bootTimeout);
        this.child = null;
        reject(new Error(`Failed to start PP-OCRv5 rec daemon: ${err.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(bootTimeout);
        this.child = null;
        this.startPromise = null;
        const reason = `PP-OCRv5 rec daemon exited with code ${code}. stderr: ${this.stderrBuffer.trim() || '(empty)'}`;
        this.rejectAllPending(new Error(reason));
      });
    }).finally(() => {
      this.startPromise = null;
    });

    return this.startPromise;
  }

  private consumeStdoutLines(options?: { onReady?: () => void }): void {
    let idx: number;
    while ((idx = this.stdoutBuffer.indexOf('\n')) >= 0) {
      const line = this.stdoutBuffer.slice(0, idx).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(idx + 1);
      if (!line) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (parsed.type === 'ready') {
        options?.onReady?.();
        continue;
      }

      const id = typeof parsed.id === 'number' ? parsed.id : null;
      if (!id) continue;

      const pending = this.pending.get(id);
      if (!pending) continue;
      this.pending.delete(id);
      clearTimeout(pending.timer);

      if (parsed.ok === false) {
        const errorText =
          typeof parsed.error === 'string'
            ? parsed.error
            : 'Unknown PP-OCRv5 rec daemon error';
        pending.reject(new Error(errorText));
        continue;
      }

      pending.resolve({
        text: typeof parsed.text === 'string' ? parsed.text : '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        backend: 'en_PP-OCRv5_mobile_rec',
        elapsedMs: typeof parsed.elapsedMs === 'number' ? parsed.elapsedMs : 0,
      });
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

const daemon = new PaddleOcrEnDaemon();

export function stopPaddleOcrEnDaemon(): void {
  daemon.stop();
}
