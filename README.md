# PhonePilot

通过机械臂让 AI Agent 操控硬件钱包的桌面应用。基于 [MCP 协议](https://modelcontextprotocol.io/)，AI 可以控制机械臂在硬件钱包屏幕上执行点击、滑动等操作，并通过摄像头实时观察结果。

<p align="center">
  <img src="docs/assets/arm-hardware.png" alt="硬件设置" width="600">
</p>

## 为什么用硬件自动化

硬件钱包为了安全性，不提供任何软件接口进行自动化操作。PhonePilot 使用物理机械臂直接触摸屏幕：

- **突破封闭限制** - 无需钱包厂商支持，纯物理操作
- **安全隔离** - 不接触钱包固件，不影响私钥安全
- **通用兼容** - Ledger、Trezor、OneKey 等任何触摸屏钱包都能用
- **批量操作** - 适合需要重复签名、多钱包管理等场景

## 功能

### MCP 工具

| 工具 | 说明 |
|------|------|
| `arm-connect` | 连接机械臂控制器 |
| `arm-disconnect` | 断开机械臂连接 |
| `arm-move` | 移动机械臂到指定位置 |
| `arm-click` | 在当前位置执行点击 |
| `capture-frame` | 捕获当前摄像头画面 |
| `execute-sequence` | 执行预置自动化流程（含 OCR 步骤） |
| `stop-sequence` | 停止正在执行的流程 |
| `confirm-action` | 点击确认/取消按钮 |
| `input-pin` | 自动输入 PIN |
| `mnemonic-store` | 存储/获取助记词 |
| `mnemonic-verify` | 基于 OCR 选项匹配正确助记词 |

### 摄像头

- 自动检测并连接 DECXIN 摄像头
- 手动对焦模式
- 十字线和网格辅助
- 90° 自动旋转适配设备屏幕

### 机械臂控制

- 毫米级 X/Y 轴移动精度
- 可调步进距离 (1-50mm)
- 可调触摸深度 (Z 轴)

<p align="center">
  <img src="docs/assets/control-software.png" alt="控制界面" width="700">
</p>

## 工作原理

```
┌─────────────────┐     MCP Protocol      ┌──────────────────┐
│   AI Agent      │◄────────────────────►│   PhonePilot     │
│  (Claude, etc)  │                       │   Desktop App    │
└─────────────────┘                       └────────┬─────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    │              │              │
                              ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
                              │ 机械臂    │  │  摄像头   │  │ 硬件钱包  │
                              └───────────┘  └───────────┘  └───────────┘
```

## 快速开始

### 环境要求

- Node.js 20+
- Yarn
- 机械臂控制器 (COM 口连接)
- USB 摄像头
- Python 3.8+ (OCR 功能需要)

### 安装运行

```bash
git clone https://github.com/your-username/PhonePilot.git
cd PhonePilot
yarn install

# 初始化 OCR Python 环境（会创建 scripts/.venv）
yarn setup:ocr

# 下载 OCR 模型到本地
python3 - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download(
  'PaddlePaddle/en_PP-OCRv5_mobile_rec',
  local_dir='models/ocr_bench/en_PP-OCRv5_mobile_rec'
)
snapshot_download(
  'PaddlePaddle/PP-OCRv5_mobile_det',
  local_dir='models/ocr_bench/PP-OCRv5_mobile_det'
)
snapshot_download(
  'PaddlePaddle/PP-OCRv5_mobile_rec',
  local_dir='models/ocr_bench/PP-OCRv5_mobile_rec'
)
print('done')
PY

yarn electron:dev
```

说明：

- `yarn setup:ocr` 会执行 `scripts/setup_ocr.sh`
- 脚本会自动查找兼容的 Python 3.9 - 3.12，并在 `scripts/.venv` 中安装 OCR 依赖
- Electron 开发态会自动优先使用 `scripts/.venv/bin/python`
- 如需手动指定 Python，可设置环境变量 `PHONEPILOT_PYTHON_BIN=/path/to/python`

### 构建

```bash
yarn electron:build      # 当前平台
yarn build:mac           # macOS
yarn build:win           # Windows
yarn build:linux         # Linux
```

## OCR 助记词识别

PhonePilot 当前 OCR 采用双路径：

- 助记词页与确认页选项区：`en_PP-OCRv5_mobile_rec`
- 确认页题号区（`#N`）：`PP-OCRv5_mobile_det + PP-OCRv5_mobile_rec`

- Electron 主进程通过 IPC `paddleocr-en-recognize` 调用 Python daemon
- Python 脚本：`scripts/paddleocr_en_infer.py`
- 助记词页：按 2 列 6 行网格重排并输出标准化 `1..12` 文本
- 确认页：题号区域单独走 det+multi-rec；选项区域继续走 en-rec
- 识别后继续走现有 BIP39 校验/纠错流程

### 典型工作流程

1. 运行 `execute-sequence`（含 `ocrCapture` 步骤）触发助记词 OCR
2. 识别到的助记词会写入内存（可通过 `mnemonic-store` 查询/覆盖）
3. 验证页流程中触发 `ocrVerify`，OCR 识别题号与候选词
4. 用 `mnemonic-verify` 匹配正确词并执行点击

### 使用示例

```typescript
// 1. 跑一条包含 OCR 的自动流程（示例序列 ID 以项目内配置为准）
await call('execute-sequence', { sequenceId: 'one-normal-24' });

// 2. 查看当前缓存助记词
const words = await call('mnemonic-store', { action: 'get' });

// 3. 手工覆盖（可选）
await call('mnemonic-store', {
  action: 'set',
  words: ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident']
});
```

### OCR 模型路径

- 默认加载：
  - `models/ocr_bench/en_PP-OCRv5_mobile_rec`
  - `models/ocr_bench/PP-OCRv5_mobile_det`
  - `models/ocr_bench/PP-OCRv5_mobile_rec`
- 可通过环境变量覆盖：
  - `PHONEPILOT_OCR_MODEL_DIR=/absolute/path/to/en_PP-OCRv5_mobile_rec`
  - `PHONEPILOT_OCR_DET_MODEL_DIR=/absolute/path/to/PP-OCRv5_mobile_det`
  - `PHONEPILOT_OCR_MULTI_REC_MODEL_DIR=/absolute/path/to/PP-OCRv5_mobile_rec`
- 可选性能参数：`PHONEPILOT_OCR_MAX_IMAGE_SIDE`（默认 1280）
- 可选性能参数：`PHONEPILOT_OCR_CPU_THREADS`（默认 4）

## MCP 配置

### 端点

| 端点 | 协议 | 用途 |
|------|------|------|
| `POST /mcp` | Streamable HTTP | 现代 MCP 客户端 |
| `GET /sse` | SSE | 传统 MCP 客户端 |
| `GET /health` | HTTP | 健康检查 |

### 配置示例

```json
{
  "mcpServers": {
    "phonepilot": {
      "url": "http://localhost:3847/sse"
    }
  }
}
```

## License

[MIT](LICENSE)
