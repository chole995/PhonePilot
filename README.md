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

### 安装运行

```bash
git clone https://github.com/your-username/PhonePilot.git
cd PhonePilot
yarn install
yarn electron:dev
```

### 构建

```bash
yarn electron:build      # 当前平台
yarn build:mac           # macOS
yarn build:win           # Windows
yarn build:linux         # Linux
```

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
