# 🌱 LifePrint - 儿童成长记录与特质解码平台

LifePrint 是一个基于 AI 的儿童成长记录与分析平台，采用 **RPG 游戏化** 设计理念。通过上传孩子的日常视频和照片，AI 自动分析行为模式、情绪状态、兴趣偏好，生成六维能力雷达图和特质徽章，帮助家长像「解锁成就」一样记录和理解孩子的成长轨迹。

## ✨ 核心功能

- **⚔️ RPG 角色面板** - 孩子的数字孪生，六维能力雷达图（专注力/创造力/运动/语言/情绪/探索欲）
- **🏅 天赋徽章墙** - AI 挖掘的特质标签，点击可回溯证据视频
- **🔬 特质鉴定所** - 上传时实时展示 AI 思考过程，即时弹出发现的特质
- **📜 成长进化史** - 里程碑时间线、纵向对比视图、月度成长报告
- **🧠 AI 行为分析** - 多模态大模型识别活动类型（运动、学习、艺术、社交等）
- **😊 情绪识别** - 分析面部表情和语音，追踪情绪变化趋势
- **🗣️ 语音转写** - 本地 Whisper 模型自动转写语音内容
- **👤 人脸识别** - 本地 InsightFace 模型自动识别家庭成员
- **📝 月度成长报告** - AI 生成专业的成长叙事报告，支持 PDF 导出
- **👨‍👩‍👧‍👦 家庭协作** - 多成员共同记录，支持多孩子管理

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────┐
│                   Nginx (反向代理)                │
├────────────────────┬────────────────────────────┤
│   React 前端        │       FastAPI 后端          │
│   - Ant Design 5   │       - SQLAlchemy 2.0     │
│   - ECharts 5      │       - Celery 异步任务      │
│   - Zustand        │       - JWT 认证            │
│   - TypeScript     │       - Pydantic 2.0       │
├────────────────────┴────────────────────────────┤
│                  基础设施层                       │
│  PostgreSQL 15 │ Redis 7 │ MinIO (S3 对象存储)   │
├─────────────────────────────────────────────────┤
│                   AI 引擎层                      │
│  本地模型:                                       │
│    - Whisper (语音转写)                          │
│    - InsightFace (人脸识别)                      │
│    - PySceneDetect (场景检测)                    │
│  远程 API (用户自配):                            │
│    - OpenAI / Anthropic / DashScope / DeepSeek  │
│    - 行为分析 + 情绪分析 + 报告生成               │
└─────────────────────────────────────────────────┘
```

## 📋 环境要求

| 要求 | Docker 模式 | 本地开发模式 |
|------|-------------|-------------|
| **操作系统** | macOS / Linux | macOS / Linux |
| **Docker** | ✅ 必须 | ❌ 不需要（但基础设施推荐用 Docker） |
| **Python** | ❌ 不需要 | ✅ 3.11+ |
| **Node.js** | ❌ 不需要 | ✅ 18+ |
| **内存** | ≥ 8GB | ≥ 4GB |
| **磁盘** | ≥ 10GB | ≥ 5GB |

---

## 🚀 启动方式

LifePrint 支持 **三种启动方式**，适用于不同场景：

### 方式一：Docker 一键启动（推荐部署）

最简单的方式，一条命令启动所有服务。

```bash
# 1. 克隆项目
git clone <your-repo-url> life_print
cd life_print

# 2. 配置环境变量
cp .env.example .env   # 如果有的话
# 编辑 .env，配置 LLM_API_KEY（也可以启动后在网页设置页面配置）

# 3. 一键启动
chmod +x start.sh
./start.sh
# 或显式指定模式
./start.sh docker
```

**启动后访问：**

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端页面 | `http://localhost` | 通过 Nginx 反向代理 |
| 后端 API | `http://localhost:8000/docs` | Swagger 文档 |
| MinIO 控制台 | `http://localhost:9001` | 账号: minioadmin / minioadmin123 |

### 方式二：本地开发模式（推荐开发）

前后端分离启动，支持热重载，适合日常开发调试。

```bash
# 1. 准备开发环境（自动安装依赖、创建虚拟环境）
./start.sh dev

# 2. 启动基础设施（PostgreSQL + Redis + MinIO）
#    方式 A：用 Docker 启动基础设施（推荐）
./start.sh infra

#    方式 B：用 Homebrew 本地安装
brew install postgresql@15 redis minio/stable/minio
brew services start postgresql@15
brew services start redis

# 3. 在三个终端窗口中分别启动：

# 终端 1 - MinIO（如果用方式 B）
minio server ./data/minio --console-address ':9001'

# 终端 2 - 后端
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 终端 3 - 前端
cd frontend
npm run dev
```

**启动后访问：**

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端页面 | `http://localhost:5173` | Vite 开发服务器，支持 HMR |
| 后端 API | `http://localhost:8000/docs` | 支持热重载 |
| MinIO 控制台 | `http://localhost:9001` | 账号: minioadmin / minioadmin |

### 方式三：混合模式（基础设施 Docker + 应用本地）

基础设施用 Docker，应用代码本地运行，兼顾便利性和开发体验。

```bash
# 1. 仅启动基础设施
./start.sh infra

# 2. 本地启动后端和前端（同方式二的步骤 3）
```

---

## 📜 start.sh 命令参考

```bash
./start.sh              # Docker 一键启动（默认）
./start.sh docker       # 同上
./start.sh dev          # 本地开发模式（安装依赖 + 环境检查）
./start.sh infra        # 仅启动基础设施（PostgreSQL + Redis + MinIO）
./start.sh stop         # 停止所有 Docker 服务
./start.sh clean        # 停止并清除所有 Docker 数据卷
./start.sh help         # 显示帮助信息
```

---

## 🔑 API Key 配置说明

LifePrint 的 AI 分析功能需要大语言模型 API。支持两种格式：

### OpenAI 格式（推荐）

兼容所有 OpenAI API 格式的服务商：

| 服务商 | Base URL | 推荐模型 |
|--------|----------|----------|
| OpenAI 官方 | `https://api.openai.com/v1` | `gpt-4o` |
| 阿里云 DashScope | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` / `qwen-vl-max` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |

### Anthropic 格式

| 服务商 | Base URL | 推荐模型 |
|--------|----------|----------|
| Anthropic 官方 | `https://api.anthropic.com` | `claude-sonnet-4-20250514` |

> **注意**：视觉模型需要支持多模态（图片输入）。如果文本模型和视觉模型不同，可以分别配置。

## 🤖 本地 AI 模型

以下模型在本地运行，**不需要 API Key**，首次使用时自动下载：

| 模型 | 用途 | 大小 | 说明 |
|------|------|------|------|
| Whisper (small) | 语音转写 | ~500MB | 支持中英文语音识别 |
| InsightFace | 人脸识别 | ~300MB | 自动识别家庭成员 |
| PySceneDetect | 场景检测 | 内置 | 视频关键帧提取 |

---

## 📁 项目目录结构

```
life_print/
├── backend/                  # 后端 (Python FastAPI)
│   ├── app/
│   │   ├── ai/              # AI 分析模块
│   │   │   ├── local/       # 本地模型 (Whisper, InsightFace)
│   │   │   └── remote/      # 远程 API (LLMClient)
│   │   ├── api/v1/          # REST API 路由
│   │   ├── models/          # SQLAlchemy 数据模型
│   │   ├── schemas/         # Pydantic 请求/响应模型
│   │   ├── services/        # 业务逻辑层
│   │   ├── tasks/           # Celery 异步任务
│   │   └── utils/           # 工具函数
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # 前端 (React 18 + TypeScript + Vite 5)
│   ├── src/
│   │   ├── pages/           # 页面组件 (Dashboard/Upload/Timeline)
│   │   ├── components/      # 通用组件
│   │   ├── services/        # API 调用封装
│   │   └── stores/          # Zustand 状态管理
│   ├── Dockerfile
│   └── package.json
├── nginx/                    # Nginx 反向代理配置
├── data/                     # 数据目录 (自动创建，已 gitignore)
│   ├── postgres/            # PostgreSQL 数据
│   ├── redis/               # Redis 数据
│   ├── minio/               # MinIO 对象存储
│   ├── uploads/             # 上传文件
│   ├── temp/                # 临时文件
│   ├── exports/             # 导出文件
│   └── models/              # AI 模型缓存
├── docker-compose.yml        # Docker 编排
├── start.sh                  # 多模式启动脚本
├── .env                      # 环境变量配置
└── .gitignore
```

---

## ⚠️ 启动注意事项

### 数据库相关

- **首次启动**会自动创建数据库表（通过 SQLAlchemy `create_all`），无需手动执行迁移
- **本地开发模式**默认连接 `postgres:postgres@localhost:5432/life_print`，请确保 PostgreSQL 中已创建 `life_print` 数据库：
  ```bash
  createdb life_print
  ```
- **Docker 模式**使用独立的 PostgreSQL 容器，数据库名为 `lifeprint`（用户名/密码: `lifeprint` / `lifeprint_secret`）

### MinIO 相关

- **本地开发模式**默认 MinIO 凭据为 `minioadmin` / `minioadmin`
- **Docker 模式**默认 MinIO 凭据为 `minioadmin` / `minioadmin123`（注意密码不同）
- MinIO Bucket 会在后端启动时自动创建，无需手动操作
- 上传大文件时，确保 Nginx 的 `client_max_body_size` 已设置为 `500M`

### 端口占用

| 端口 | 服务 | 说明 |
|------|------|------|
| 80 | Nginx | Docker 模式下的统一入口 |
| 3000 | Frontend (Docker) | Docker 模式下前端直接访问 |
| 5173 | Frontend (Dev) | 本地开发模式 Vite 开发服务器 |
| 8000 | Backend | FastAPI 后端 |
| 5432 | PostgreSQL | 数据库 |
| 6379 | Redis | 缓存 & 消息队列 |
| 9000 | MinIO API | 对象存储 API |
| 9001 | MinIO Console | 对象存储管理界面 |

> 启动前请确保以上端口未被占用。可用 `lsof -i :端口号` 检查。

### 前端开发注意

- 前端 Vite 开发服务器已配置 API 代理，`/api` 请求会自动转发到 `http://localhost:8000`
- 如果后端端口不是 8000，需要修改 `frontend/vite.config.ts` 中的 proxy 配置
- 前端使用 ECharts 5 渲染雷达图，首次加载可能稍慢

### 后端开发注意

- 后端使用 **异步 SQLAlchemy**（`asyncpg`），所有数据库操作必须使用 `async/await`
- Celery Worker 需要 Redis 作为 Broker，本地开发如不需要异步任务可以不启动
- 环境变量优先级：系统环境变量 > `.env` 文件 > docker-compose.yml 中的默认值

### AI 功能注意

- AI 分析功能需要配置 LLM API Key，可以在 `.env` 中配置或在网页设置页面配置
- 本地 AI 模型（Whisper、InsightFace）首次使用时会自动下载，需要稳定的网络
- 如果网络不佳，可以手动下载模型文件放到 `data/models/` 目录

---

## ❓ 常见问题

### Q: 启动后访问 http://localhost 显示无法连接？

等待约 30 秒让所有服务完全启动。可以用 `docker compose logs -f` 查看启动日志。

### Q: AI 分析功能不工作？

请确保已在设置页面正确配置了 API Key，并点击"测试连接"验证。

### Q: 首次启动很慢？

首次启动需要构建 Docker 镜像和下载依赖，通常需要 5-15 分钟。后续启动会很快。

### Q: 本地 AI 模型下载失败？

Whisper 和 InsightFace 模型会在首次使用时自动下载。如果网络不佳，可以手动下载模型文件放到 `data/models/` 目录。

### Q: Mac 上运行正常吗？

完全支持 macOS（Intel & Apple Silicon）。已移除 NVIDIA GPU 依赖，所有本地 AI 模型使用 CPU 推理（`onnxruntime`）。

### Q: 如何停止服务？

```bash
./start.sh stop            # 停止所有 Docker 容器
./start.sh clean           # 停止并清除所有数据卷（⚠️ 数据会丢失）
```

### Q: 如何备份数据？

所有数据存储在项目目录下的 `data/` 文件夹中，直接备份该文件夹即可。

### Q: Docker 模式和本地模式可以同时运行吗？

不建议。两种模式使用不同的数据库和 MinIO 配置，同时运行会导致端口冲突。请先用 `./start.sh stop` 停止 Docker 服务后再启动本地开发模式。

### Q: 如何切换 LLM 服务商？

编辑 `.env` 文件中的以下字段：
```bash
LLM_PROVIDER=openai                              # openai 或 anthropic
LLM_API_KEY=your_api_key                          # 你的 API Key
LLM_BASE_URL=https://api.openai.com/v1            # API 地址
LLM_MODEL=gpt-4o                                  # 文本模型
LLM_VISION_MODEL=gpt-4o                           # 视觉模型（需支持多模态）
```

---

## 📄 License

MIT
