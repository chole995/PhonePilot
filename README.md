<h1 align="center">PhonePilot</h1>

<p align="center">
  <strong>Enable AI Agents to Physically Control Your Phone & Hardware Wallet</strong>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform"></a>
  <a href="#"><img src="https://img.shields.io/badge/Electron-28.x-47848F?logo=electron&logoColor=white" alt="Electron"></a>
  <a href="#"><img src="https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white" alt="React"></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="#"><img src="https://img.shields.io/badge/MCP-1.x-8B5CF6" alt="MCP"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License"></a>
</p>

---

## About

**PhonePilot** is a desktop application that enables AI agents to physically control smartphones and hardware wallets through a mechanical arm. Using the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), AI agents (such as Claude, Cursor, etc.) can directly operate the mechanical arm to perform taps, swipes, and other touch interactions on the device screen, while observing the results in real-time through a camera feed.

<p align="center">
  <img src="docs/assets/arm-hardware.png" alt="Mechanical Arm Hardware" width="600">
  <br>
  <em>Mechanical Arm Hardware Setup</em>
</p>

## Features

### 🤖 Native MCP Protocol Support

Built-in MCP Server supporting both Streamable HTTP and SSE transport protocols, seamlessly integrating with any MCP-compatible AI client.

| Tool | Description |
|------|-------------|
| `arm-connect` | Connect to the mechanical arm controller |
| `arm-disconnect` | Disconnect from the mechanical arm |
| `arm-move` | Move the arm to a specified position |
| `arm-click` | Perform a click at the current position |
| `capture-frame` | Capture the current camera frame |
| `execute-sequence` | Execute a predefined automation sequence (supports OCR steps) |
| `stop-sequence` | Stop the currently running sequence |
| `confirm-action` | Tap confirm/cancel button on device |
| `input-pin` | Automatically input PIN on device |
| `mnemonic-store` | Store or retrieve captured mnemonic words |
| `mnemonic-verify` | Match correct mnemonic word via OCR option selection |

### 📷 Real-time Visual Feedback

HD camera with live device screen preview, featuring:
- Auto-detection and connection to DECXIN cameras
- Manual focus mode to prevent autofocus hunting
- Crosshair and grid overlay assistants
- 90° auto-rotation to match device portrait display

<p align="center">
  <img src="docs/assets/control-software.png" alt="Control Software Interface" width="700">
  <br>
  <em>PhonePilot Control Interface</em>
</p>

### 🎮 Precision Mechanical Control

- Millimeter-accurate X/Y axis movement
- Adjustable step size (1-50mm)
- Adjustable touch depth (Z-axis)
- Real-time operation logging

### 🖥️ Cross-Platform Desktop App

Built with Electron, natively supporting:
- macOS (Intel & Apple Silicon)
- Windows (x64)
- Linux (AppImage, deb)

## How It Works

```
┌─────────────────┐     MCP Protocol      ┌──────────────────┐
│   AI Agent      │◄────────────────────►│   PhonePilot     │
│  (Claude, etc)  │                       │   Desktop App    │
└─────────────────┘                       └────────┬─────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    │              │              │
                              ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
                              │Mechanical │  │  Camera   │  │  Device   │
                              │   Arm     │  │ (DECXIN)  │  │ (Wallet)  │
                              └───────────┘  └───────────┘  └───────────┘
```

1. **AI Agent** connects to PhonePilot via MCP protocol
2. **PhonePilot** translates MCP commands into mechanical arm control instructions
3. **Mechanical Arm** performs physical touch operations on the device screen
4. **Camera** captures the screen and returns the frame to the AI agent
5. **AI Agent** analyzes the frame and decides on the next action

## Getting Started

### Prerequisites

- Node.js 20.x or later
- Yarn package manager
- Compatible mechanical arm controller (via COM port)
- USB camera (DECXIN recommended)
- Python 3.8+ (required for OCR)

### Installation & Running

```bash
git clone https://github.com/your-username/PhonePilot.git
cd PhonePilot
yarn install

# Set up OCR Python environment (creates scripts/.venv)
yarn setup:ocr

# Download OCR models
python3 - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download('PaddlePaddle/en_PP-OCRv5_mobile_rec', local_dir='models/ocr_bench/en_PP-OCRv5_mobile_rec')
snapshot_download('PaddlePaddle/PP-OCRv5_mobile_det', local_dir='models/ocr_bench/PP-OCRv5_mobile_det')
snapshot_download('PaddlePaddle/PP-OCRv5_mobile_rec', local_dir='models/ocr_bench/PP-OCRv5_mobile_rec')
print('done')
PY

yarn electron:dev
```

> `yarn setup:ocr` automatically locates a compatible Python 3.9–3.12 and installs OCR dependencies into `scripts/.venv`.
> To use a custom Python binary: `PHONEPILOT_PYTHON_BIN=/path/to/python yarn electron:dev`

### Building for Production

```bash
yarn electron:build   # current platform
yarn build:mac        # macOS
yarn build:win        # Windows
yarn build:linux      # Linux
```

## OCR Mnemonic Recognition

PhonePilot uses a dual-path OCR pipeline for hardware wallet mnemonic capture:

- **Mnemonic display page & confirmation option area**: `en_PP-OCRv5_mobile_rec`
- **Confirmation page question number area (`#N`)**: `PP-OCRv5_mobile_det` + `PP-OCRv5_mobile_rec`

**Typical workflow:**

1. `execute-sequence` triggers `ocrCapture` — mnemonic words are recognized and stored in memory
2. `mnemonic-store` can be used to query or override stored words
3. Verification page triggers `ocrVerify` — OCR reads the question number and candidate words
4. `mnemonic-verify` matches the correct word and performs the tap

**OCR model paths** (default under `models/ocr_bench/`):

| Model | Environment Variable Override |
|-------|-------------------------------|
| `en_PP-OCRv5_mobile_rec` | `PHONEPILOT_OCR_MODEL_DIR` |
| `PP-OCRv5_mobile_det` | `PHONEPILOT_OCR_DET_MODEL_DIR` |
| `PP-OCRv5_mobile_rec` | `PHONEPILOT_OCR_MULTI_REC_MODEL_DIR` |

Optional tuning: `PHONEPILOT_OCR_MAX_IMAGE_SIDE` (default 1280), `PHONEPILOT_OCR_CPU_THREADS` (default 4)

## Automation Sequences

PhonePilot ships with predefined sequences for hardware wallet testing. See [docs/test-case-arrangement.md](docs/test-case-arrangement.md) for the full list and coverage matrix.

| Category | Sequence IDs |
|----------|-------------|
| BIP39 Create | `create-wallet`, `create-wallet-18`, `create-wallet-24` |
| BIP39 Import 12-word | `one-normal-12`, `two-normal-12`, `three-normal-12`, `api-normal-12` |
| BIP39 Import 18/24-word | `one/two/three-normal-18`, `one/two/three-normal-24` |
| SLIP39 Create | `create-slip39-single-template`, `create-slip39-multi-*` |
| SLIP39 Import | `count20_one/two/three_normal`, `count33_one/two_normal` |

## MCP Integration

### Endpoints

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `POST /mcp` | Streamable HTTP | Modern MCP clients |
| `GET /sse` | SSE | Legacy MCP clients |
| `GET /health` | HTTP | Health check |

### Configuration Example

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

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <sub>Made with ❤️ for the AI-powered future</sub>
</p>
