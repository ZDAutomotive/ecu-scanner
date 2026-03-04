# ECU Scanner

工业级 ECU 扫码验证系统，用于车辆研发阶段的刷写台架。

## 技术栈

### 后端
- **Python 3.10+**
- **FastAPI** - 高性能 Web 框架
- **SQLite** - 轻量级数据库
- **pyserial** - 串口通信

### 前端
- **React 18** + **TypeScript**
- **Vite** - 构建工具
- **Tailwind CSS** - UI 样式
- **Zustand** - 状态管理

## 功能特性

- 扫码枪自动识别（串口通信）
- HW ID 校验与防重
- 控制域管理
- 硬件配置管理
- 实时 WebSocket 推送
- 扫码/刷写记录查询
- 覆盖率统计
- CSV 导出

## 项目结构

```
ecu-scanner/
├── backend/           # 后端项目
│   ├── app/
│   │   ├── api/      # API 路由
│   │   ├── core/     # 核心配置
│   │   ├── models/   # 数据模型
│   │   └── services/ # 业务逻辑
│   └── requirements.txt
├── frontend/          # 前端项目
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── api/
│   └── package.json
└── docs/             # 文档
```

## 快速开始

### 后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python init_db.py

# 启动服务
python -m app.main
```

后端服务运行在 http://localhost:8000

### 前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端运行在 http://localhost:3000

## API 文档

启动后访问 http://localhost:8000/docs 查看 Swagger 文档。

## 配置

串口配置在 `backend/app/core/config.py`：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| serial_port | COM3 | 串口号 |
| serial_baudrate | 9600 | 波特率 |
| serial_bytesize | 8 | 数据位 |
| serial_parity | N | 校验位 |
| serial_stopbits | 1 | 停止位 |

## 页面说明

- **扫码工作站** - 实时扫码验证界面
- **数据管理** - 扫码/刷写记录查询与导出
- **系统设置** - 控制域和硬件配置管理
