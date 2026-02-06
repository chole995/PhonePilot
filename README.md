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
| `ocr-recognize` | OCR 识别屏幕文字 (PaddleOCR) |
| `mnemonic-store` | 存储/获取助记词 |
| `mnemonic-verify` | 助记词验证选词定位 |

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

# 安装 OCR 依赖 (可选但推荐)
./python/setup_ocr.sh
# 或手动安装: pip install -r python/requirements.txt

yarn electron:dev
```

### 构建

```bash
yarn electron:build      # 当前平台
yarn build:mac           # macOS
yarn build:win           # Windows
yarn build:linux         # Linux
```

## OCR 助记词识别

PhonePilot 集成了 [EasyOCR](https://github.com/JaidedAI/EasyOCR) 用于识别屏幕上的文字，特别适用于助记词备份和验证场景。

### 典型工作流程

1. **捕获助记词页面** - 当设备显示助记词时，调用 `ocr-recognize` 并设置 `extractMnemonic=true`
2. **自动存储** - 识别到的助记词会自动存储在内存中
3. **验证选词** - 在验证页面，调用 `ocr-recognize` 获取选项，再用 `mnemonic-verify` 找到正确选项的坐标
4. **点击选项** - 使用 `arm-move` 和 `arm-click` 点击正确位置

### 使用示例

```typescript
// 1. 识别并存储助记词
await call('ocr-recognize', { extractMnemonic: true });

// 2. 在验证页面识别选项
const ocrResult = await call('ocr-recognize', { lang: 'en' });

// 3. 找到正确选项位置 (假设要验证第 5 个词)
const verifyResult = await call('mnemonic-verify', {
  wordIndex: 5,
  ocrResults: ocrResult.results
});

// 4. 点击正确选项
await call('arm-move', { 
  x: verifyResult.matchedOption.centerX, 
  y: verifyResult.matchedOption.centerY 
});
await call('arm-click', {});
```

### OCR 语言支持

- `ch` - 中文和英文混合 (默认)
- `en` - 仅英文

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
