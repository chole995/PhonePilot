import { useState, useCallback, useRef } from 'react';
import {
  ARM_CONTROLLER_CONFIG,
  buildArmApiUrl,
  parseResourceHandle,
} from '../config/armController';
import './ControlPanel.css';

/**
 * Import all sequence definitions from electron/mcp/sequences.
 * This is the single source of truth for all automation sequences!
 * Both PhonePilot UI and MCP tools use the same sequence definitions.
 */
import {
  getAllSequenceIds,
  getSequence,
  getFullSteps,
  getAllCategories,
  getSequencesByCategory,
  type AutoSequence,
} from '../../electron/mcp/sequences';

// Get all sequences from the shared definition
const OPERATION_SEQUENCES: AutoSequence[] = getAllSequenceIds()
  .map((id: string) => getSequence(id))
  .filter((seq): seq is AutoSequence => seq !== undefined);

// Get all categories for the sequence panel
const SEQUENCE_CATEGORIES = getAllCategories();

interface ControlPanelState {
  isConnected: boolean;
  resourceHandle: number;
  serverIP: string;
  comPort: string;
  stepSize: number;
  zDepth: number;
  currentX: number;
  currentY: number;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  isAutoRunning: boolean;
  autoProgress: number;
  selectedSequenceId: string;
  selectedCategory: string;
  /** Words captured via OCR during create-wallet flow */
  capturedWords: string[];
}

interface LogEntry {
  id: number;
  time: string;
  action: string;
  detail: string;
}

interface SequenceOcrResult {
  success: boolean;
  words: string[];
  confidence?: number;
  expectedWordCount?: number;
  hasCompleteSequence?: boolean;
  bip39Valid?: boolean;
  reason?: string;
}

interface SequenceVerifyOcrResult {
  success: boolean;
  optionIndex: number;
  wordIndex: number;
  correctWord: string;
  rawOptions?: string[];
  matchedOptions?: string[];
  mnemonicWords?: string[];
  reason?: string;
}

function ControlPanel() {
  const [state, setState] = useState<ControlPanelState>({
    isConnected: false,
    resourceHandle: 0,
    serverIP: ARM_CONTROLLER_CONFIG.defaultServerIP,
    comPort: ARM_CONTROLLER_CONFIG.defaultComPort,
    stepSize: ARM_CONTROLLER_CONFIG.defaultStepSize,
    zDepth: ARM_CONTROLLER_CONFIG.defaultZDepth,
    currentX: 0,
    currentY: 0,
    isLoading: false,
    isReady: false,
    error: null,
    isAutoRunning: false,
    autoProgress: 0,
    selectedSequenceId: OPERATION_SEQUENCES[0].id,
    selectedCategory: SEQUENCE_CATEGORIES[0],
    capturedWords: [],
  });

  // Ref to track if auto operation should be cancelled
  const autoOperationCancelledRef = useRef(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((action: string, detail: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour12: false });
    setLogs(prev => [
      { id: Date.now(), time, action, detail },
      ...prev.slice(0, 49),
    ]);
  }, []);

  /**
   * Sends a command to the arm controller via HTTP.
   * Uses Electron IPC to bypass CORS restrictions.
   * Falls back to fetch API when Electron is unavailable (development mode).
   *
   * @param params - Command parameters (duankou, hco, daima)
   * @returns Server response as string
   * @throws Error if request fails
   */
  const sendCommand = useCallback(async (params: { duankou: string; hco: number; daima: string }): Promise<string> => {
    const url = buildArmApiUrl(state.serverIP, params);
    try {
      if (window.electronAPI?.httpRequest) {
        const response = await window.electronAPI.httpRequest(url);
        return response.data;
      } else {
        const response = await fetch(url);
        const text = await response.text();
        return text;
      }
    } catch (error) {
      throw new Error(`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [state.serverIP]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Connects to the arm controller by opening the COM port.
   * After successful connection, waits for device to be ready before enabling controls.
   */
  const handleConnect = async () => {
    if (state.isLoading) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await sendCommand({
        duankou: state.comPort,
        hco: 0,
        daima: '0',
      });

      const resourceHandle = parseResourceHandle(result);

      if (resourceHandle > 0) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          resourceHandle,
          isLoading: false,
          isReady: false,
        }));

        // Sync state to MCP
        if (window.electronAPI?.syncArmState) {
          await window.electronAPI.syncArmState({
            isConnected: true,
            resourceHandle,
            comPort: state.comPort,
          });
        }

        await delay(ARM_CONTROLLER_CONFIG.deviceReadyDelay);

        setState(prev => ({ ...prev, isReady: true }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to open port. Check if port is occupied.',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  };

  /**
   * Disconnects from the arm controller.
   * First resets machine position to origin, then closes the COM port.
   * Can be called even when not connected to release any previous connection.
   */
  const handleDisconnect = async () => {
    if (state.isLoading) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (state.isConnected && state.resourceHandle > 0) {
        await sendCommand({
          duankou: '0',
          hco: state.resourceHandle,
          daima: 'X0Y0Z0',
        });

        await delay(ARM_CONTROLLER_CONFIG.commandDelay);

        await sendCommand({
          duankou: '0',
          hco: state.resourceHandle,
          daima: '0',
        });
      }

      setState(prev => ({
        ...prev,
        isConnected: false,
        resourceHandle: 0,
        currentX: 0,
        currentY: 0,
        isLoading: false,
        isReady: false,
      }));

      // Sync state to MCP
      if (window.electronAPI?.syncArmState) {
        await window.electronAPI.syncArmState({
          isConnected: false,
          resourceHandle: 0,
          comPort: state.comPort,
        });
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnected: false,
        resourceHandle: 0,
        currentX: 0,
        currentY: 0,
        isLoading: false,
        isReady: false,
      }));

      // Sync state to MCP
      if (window.electronAPI?.syncArmState) {
        await window.electronAPI.syncArmState({
          isConnected: false,
          resourceHandle: 0,
          comPort: state.comPort,
        });
      }
    }
  };

  /**
   * Moves the arm in the specified direction by the current step size.
   * Y axis is inverted: Y decreases when moving up, increases when moving down.
   * Coordinates are clamped to non-negative values.
   *
   * @param direction - Movement direction (up, down, left, right)
   */
  const handleMove = async (direction: 'up' | 'down' | 'left' | 'right') => {
    if (state.isLoading || !state.isConnected || !state.isReady) return;
    
    let newX = state.currentX;
    let newY = state.currentY;
    
    switch (direction) {
      case 'up':
        newY -= state.stepSize;
        break;
      case 'down':
        newY += state.stepSize;
        break;
      case 'left':
        newX -= state.stepSize;
        break;
      case 'right':
        newX += state.stepSize;
        break;
    }
    
    newX = Math.max(0, newX);
    newY = Math.max(0, newY);
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const directionLabel = { up: '上', down: '下', left: '左', right: '右' }[direction];
    
    try {
      await sendCommand({
        duankou: '0',
        hco: state.resourceHandle,
        daima: `X${newX}Y${newY}`,
      });
      
      addLog('移动', `${directionLabel} (${state.currentX},${state.currentY}) → (${newX},${newY})`);
      
      setState(prev => ({
        ...prev,
        currentX: newX,
        currentY: newY,
        isLoading: false,
      }));
    } catch (error) {
      addLog('错误', `移动失败: ${error instanceof Error ? error.message : 'Unknown'}`);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Move failed',
      }));
    }
  };

  /**
   * Performs a click operation at the current position.
   * Lowers the pen (Z6), waits briefly, then raises it (Z0).
   */
  const handleClick = async () => {
    if (state.isLoading || !state.isConnected || !state.isReady) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await sendCommand({
        duankou: '0',
        hco: state.resourceHandle,
        daima: `Z${state.zDepth}`,
      });
      
      await delay(ARM_CONTROLLER_CONFIG.clickDelay);
      
      await sendCommand({
        duankou: '0',
        hco: state.resourceHandle,
        daima: `Z${ARM_CONTROLLER_CONFIG.zUp}`,
      });
      
      addLog('点击', `位置 (${state.currentX},${state.currentY}) 深度 Z${state.zDepth}`);
      
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      addLog('错误', `点击失败: ${error instanceof Error ? error.message : 'Unknown'}`);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Click operation failed',
      }));
    }
  };

  /**
   * Executes an auto operation sequence.
   * If sequenceId is provided, runs that sequence; otherwise uses the currently selected one.
   */
  const handleAutoOperation = async (sequenceId?: string) => {
    if (state.isLoading || !state.isConnected || !state.isReady || state.isAutoRunning) return;

    const targetId = sequenceId || state.selectedSequenceId;
    const sequence = OPERATION_SEQUENCES.find(s => s.id === targetId);
    if (!sequence) return;

    // Update selected sequence ID to match what we're running
    if (sequenceId) {
      setState(prev => ({ ...prev, selectedSequenceId: targetId }));
    }

    // getFullSteps is now imported from sequences.ts
    const steps = getFullSteps(sequence);
    const totalVerifySteps = steps.filter((step) => !!step.ocrVerify).length;
    let finishedVerifySteps = 0;

    autoOperationCancelledRef.current = false;
    setState(prev => ({ ...prev, isAutoRunning: true, autoProgress: 0, error: null, capturedWords: [] }));
    addLog('自动', `开始执行自动操作序列: ${sequence.name}`);

    try {
      for (let i = 0; i < steps.length; i++) {
        // Check if operation was cancelled
        if (autoOperationCancelledRef.current) {
          addLog('自动', '操作已取消');
          break;
        }

        const step = steps[i];
        setState(prev => ({ ...prev, autoProgress: i + 1 }));

        if (step.ocrVerify) {
          const verifyRound = finishedVerifySteps + 1;
          addLog('验证', `开始第 ${verifyRound}/${totalVerifySteps} 次确认题 OCR`);

          // Verification OCR step: move arm, OCR to detect word index, click correct option
          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `X${step.x}Y${step.y}`,
          });

          addLog('自动', `${step.label} - 移动到 (${step.x},${step.y})，等待验证OCR...`);

          // Wait for arm to settle
          await delay(1000);

          // Trigger verification OCR and wait for result (with 45s timeout)
          const verifyResult = await Promise.race([
            new Promise<SequenceVerifyOcrResult>((resolve) => {
              const handler = (e: Event) => {
                window.removeEventListener('phonepilot:verify-ocr-result', handler);
                resolve((e as CustomEvent).detail);
              };
              window.addEventListener('phonepilot:verify-ocr-result', handler);
              window.dispatchEvent(new CustomEvent('phonepilot:trigger-verify-ocr'));
            }),
            new Promise<SequenceVerifyOcrResult>((resolve) =>
              setTimeout(
                () => resolve({
                  success: false,
                  optionIndex: -1,
                  wordIndex: -1,
                  correctWord: '',
                  mnemonicWords: [],
                  reason: 'Verify OCR timed out',
                }),
                45000
              )
            ),
          ]);

          if (!verifyResult.success) {
            throw new Error(`验证OCR失败: ${verifyResult.reason || 'unknown reason'}`);
          }
          if (
            verifyResult.optionIndex < 0
            || verifyResult.optionIndex >= step.ocrVerify.options.length
          ) {
            throw new Error(
              `验证OCR返回了无效选项索引 ${verifyResult.optionIndex} (可选范围: 0-${step.ocrVerify.options.length - 1})`
            );
          }

          const option = step.ocrVerify.options[verifyResult.optionIndex];
          addLog('验证', `单词 #${verifyResult.wordIndex} -> ${verifyResult.correctWord.toUpperCase()} (选项${verifyResult.optionIndex + 1})`);
          if (Array.isArray(verifyResult.mnemonicWords) && verifyResult.mnemonicWords.length > 0) {
            addLog(
              '验证',
              `助记词表: ${verifyResult.mnemonicWords.map((word, idx) => `${idx + 1}.${word}`).join(', ')}`
            );
          }
          if (Array.isArray(verifyResult.rawOptions) && verifyResult.rawOptions.length > 0) {
            addLog('验证', `OCR选项: ${verifyResult.rawOptions.join(', ')}`);
          }
          if (Array.isArray(verifyResult.matchedOptions) && verifyResult.matchedOptions.length > 0) {
            addLog('验证', `匹配选项: ${verifyResult.matchedOptions.join(', ')}`);
          }

          // Click the correct option: move to position -> lower stylus -> raise stylus
          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `X${option.x}Y${option.y}`,
          });

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `Z${option.depth}`,
          });

          await delay(ARM_CONTROLLER_CONFIG.clickDelay);

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `Z${ARM_CONTROLLER_CONFIG.zUp}`,
          });

          finishedVerifySteps += 1;
          addLog('验证', `第 ${verifyRound}/${totalVerifySteps} 题已点击选项${verifyResult.optionIndex + 1} (${option.x},${option.y})`);
        } else if (step.ocrCapture) {
          const ocrCaptureConfig = typeof step.ocrCapture === 'object' ? step.ocrCapture : {};
          // OCR capture step: move arm out of the way (no click), then trigger OCR
          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `X${step.x}Y${step.y}`,
          });

          addLog('自动', `${step.label} - 移动到 (${step.x},${step.y})，等待OCR识别...`);

          // Wait for arm to settle
          await delay(1000);

          // Trigger OCR and wait for result (with 45s timeout)
          const ocrResult = await Promise.race([
            new Promise<SequenceOcrResult>((resolve) => {
              const handler = (e: Event) => {
                window.removeEventListener('phonepilot:ocr-result', handler);
                resolve((e as CustomEvent).detail);
              };
              window.addEventListener('phonepilot:ocr-result', handler);
              window.dispatchEvent(
                new CustomEvent('phonepilot:trigger-ocr', { detail: ocrCaptureConfig })
              );
            }),
            new Promise<SequenceOcrResult>((resolve) =>
              setTimeout(
                () => resolve({
                  success: false,
                  words: [],
                  reason: 'Mnemonic OCR timed out',
                }),
                45000
              )
            ),
          ]);

          const allowPartial = !!ocrCaptureConfig.allowPartial;
          const canContinueWithPartial = allowPartial && ocrResult.words.length > 0;
          if ((!ocrResult.success && !canContinueWithPartial) || ocrResult.words.length === 0) {
            throw new Error(`助记词OCR失败: ${ocrResult.reason || 'no words recognized'}`);
          }
          setState(prev => ({ ...prev, capturedWords: ocrResult.words }));
          addLog('OCR', `识别到 ${ocrResult.words.length} 个单词: ${ocrResult.words.join(', ')}`);
        } else if (step.swipeTo) {
          // Swipe operation: move to start -> lower stylus -> move to end -> raise stylus
          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `X${step.x}Y${step.y}`,
          });

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `Z${step.depth}`,
          });

          await delay(50);

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `X${step.swipeTo.x}Y${step.swipeTo.y}`,
          });

          // Wait before raising stylus (use custom hold delay or default 50ms)
          await delay(step.swipeHoldDelay ?? 50);

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `Z${ARM_CONTROLLER_CONFIG.zUp}`,
          });

          addLog('自动', `${step.label} (${step.x},${step.y}) → (${step.swipeTo.x},${step.swipeTo.y})`);
        } else {
          // Click operation: move to position -> lower stylus -> raise stylus
          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `X${step.x}Y${step.y}`,
          });

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `Z${step.depth}`,
          });

          await delay(ARM_CONTROLLER_CONFIG.clickDelay);

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `Z${ARM_CONTROLLER_CONFIG.zUp}`,
          });

          addLog('自动', `${step.label} (${step.x},${step.y})`);
        }

        // Wait before next step (use custom delay or default 100ms for faster execution)
        await delay(step.delayAfter ?? 250);
      }

      if (!autoOperationCancelledRef.current) {
        addLog('自动', '自动操作序列完成');
      }
    } catch (error) {
      addLog('错误', `自动操作失败: ${error instanceof Error ? error.message : 'Unknown'}`);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Auto operation failed',
      }));
    } finally {
      setState(prev => ({ ...prev, isAutoRunning: false, autoProgress: 0 }));
    }
  };

  /**
   * Cancels the ongoing auto operation.
   */
  const handleCancelAutoOperation = () => {
    autoOperationCancelledRef.current = true;
  };

  const isControlDisabled = !state.isConnected || !state.isReady || state.isLoading || state.isAutoRunning;

  const categorySequences = getSequencesByCategory(state.selectedCategory);
  const runningSequence = OPERATION_SEQUENCES.find(s => s.id === state.selectedSequenceId);

  return (
    <div className="control-panel">
      {/* Connection Settings - full width top */}
      <div className="control-section connection-section">
        <h3>连接设置</h3>
        <div className="connection-row">
          <input
            type="text"
            value={state.serverIP}
            onChange={(e) => setState(prev => ({ ...prev, serverIP: e.target.value }))}
            disabled={state.isConnected}
            placeholder="IP 地址"
            className="input-ip"
          />
          <input
            type="text"
            value={state.comPort}
            onChange={(e) => setState(prev => ({ ...prev, comPort: e.target.value }))}
            disabled={state.isConnected}
            placeholder="串口"
            className="input-port"
          />
          <div className="position-display">
            <span className="coordinate">X: {state.currentX}</span>
            <span className="coordinate">Y: {state.currentY}</span>
          </div>
          <button
            className={`btn btn-connect ${state.isConnected ? 'btn-secondary' : 'btn-primary'}`}
            onClick={state.isConnected ? handleDisconnect : handleConnect}
            disabled={state.isLoading || state.isAutoRunning}
          >
            {state.isLoading
              ? (state.isConnected ? '断开中...' : '连接中...')
              : (state.isConnected ? '断开连接' : '连接')}
          </button>
        </div>
      </div>

      {state.error && (
        <div className="error-message">
          {state.error}
        </div>
      )}

      {/* Main body: left manual + right sequences */}
      <div className="control-body">
        {/* Left: Manual Operation */}
        <div className="manual-section">
          <h3>手动操作</h3>
          <div className="control-selectors">
            <label>
              <span>步长</span>
              <select
                value={state.stepSize}
                onChange={(e) => setState(prev => ({ ...prev, stepSize: parseInt(e.target.value, 10) }))}
                disabled={isControlDisabled}
              >
                {ARM_CONTROLLER_CONFIG.stepOptions.map(step => (
                  <option key={step} value={step}>{step}</option>
                ))}
              </select>
            </label>
            <label>
              <span>深度</span>
              <select
                value={state.zDepth}
                onChange={(e) => setState(prev => ({ ...prev, zDepth: parseInt(e.target.value, 10) }))}
                disabled={isControlDisabled}
              >
                {ARM_CONTROLLER_CONFIG.zDepthOptions.map(depth => (
                  <option key={depth} value={depth}>Z{depth}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="direction-controls">
            <div className="direction-grid">
              <div className="grid-cell"></div>
              <div className="grid-cell">
                <button className="direction-btn" onClick={() => handleMove('up')} disabled={isControlDisabled} title="向上">↑</button>
              </div>
              <div className="grid-cell"></div>
              <div className="grid-cell">
                <button className="direction-btn" onClick={() => handleMove('left')} disabled={isControlDisabled} title="向左">←</button>
              </div>
              <div className="grid-cell">
                <button className="click-btn" onClick={handleClick} disabled={isControlDisabled} title="点击">点击</button>
              </div>
              <div className="grid-cell">
                <button className="direction-btn" onClick={() => handleMove('right')} disabled={isControlDisabled} title="向右">→</button>
              </div>
              <div className="grid-cell"></div>
              <div className="grid-cell">
                <button className="direction-btn" onClick={() => handleMove('down')} disabled={isControlDisabled} title="向下">↓</button>
              </div>
              <div className="grid-cell"></div>
            </div>
          </div>
        </div>

        {/* Right: Preset Sequences */}
        <div className="sequence-section">
          <h3>预置指令</h3>
          <div className="sequence-category-tabs">
            {SEQUENCE_CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`seq-cat-tab ${state.selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setState(prev => ({ ...prev, selectedCategory: cat }))}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="sequence-list">
            {categorySequences.map(seq => {
              const isRunning = state.isAutoRunning && state.selectedSequenceId === seq.id;
              return (
                <button
                  key={seq.id}
                  className={`sequence-btn ${isRunning ? 'running' : ''}`}
                  onClick={() => {
                    if (isRunning) {
                      handleCancelAutoOperation();
                    } else {
                      handleAutoOperation(seq.id);
                    }
                  }}
                  disabled={(!isRunning && isControlDisabled) || (state.isAutoRunning && !isRunning)}
                >
                  <span className="seq-btn-name">{seq.name}</span>
                  {isRunning && runningSequence && (
                    <span className="seq-btn-progress">
                      {state.autoProgress}/{getFullSteps(runningSequence).length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {state.isAutoRunning && runningSequence && (
            <div
              className="auto-progress"
              style={{ '--progress-percent': `${(state.autoProgress / getFullSteps(runningSequence).length) * 100}%` } as React.CSSProperties}
            >
              <div className="auto-progress-bar" />
            </div>
          )}
        </div>
      </div>

      {/* Captured Words Display */}
      {state.capturedWords.length > 0 && (
        <div className="captured-words-section">
          <div className="captured-words-header">
            <h3>识别到的助记词</h3>
            <span className="captured-words-count">{state.capturedWords.length} 个</span>
          </div>
          <div className="captured-words-grid">
            {state.capturedWords.map((word, i) => (
              <span key={i} className="captured-word">
                <span className="word-index">{i + 1}.</span>
                <span className="word-text">{word}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bottom: Operation Logs */}
      <div className="logs-section">
        <div className="action-logs">
          {logs.length === 0 ? (
            <div className="logs-empty">暂无操作日志</div>
          ) : (
            <div className="logs-list">
              {logs.map(log => (
                <div key={log.id} className="log-entry">
                  <span className="log-time">{log.time}</span>
                  <span className="log-action">{log.action}</span>
                  <span className="log-detail">{log.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ControlPanel;
