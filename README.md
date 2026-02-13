# 🌱 LifePrint - 儿童成长记录平台

LifePrint 是一个基于 AI 的儿童成长记录与分析平台。通过上传孩子的日常视频和照片，自动分析行为模式、情绪状态、兴趣偏好，生成可视化的成长报告，帮助家长科学地记录和理解孩子的成长轨迹。

## ✨ 核心功能

- **📹 视频/照片上传** - 支持大文件分片上传，自动提取关键帧
- **🧠 AI 行为分析** - 多模态大模型识别孩子的活动类型（运动、学习、艺术、社交等）
- **😊 情绪识别** - 分析面部表情和语音，追踪情绪变化趋势
- **🗣️ 语音转写** - 本地 Whisper 模型自动转写语音内容
- **👤 人脸识别** - 本地 InsightFace 模型自动识别家庭成员
- **📊 成长雷达图** - 多维度可视化展示兴趣、天赋、心理特质
- **🌟 天赋火花卡** - 自动发现并记录孩子的天赋闪光点
- **📝 月度成长报告** - AI 生成专业的成长叙事报告，支持 PDF 导出
- **📈 成长时间轴** - 按时间线浏览所有成长记录
- **👨‍👩‍👧‍👦 家庭协作** - 多成员共同记录，支持多孩子管理

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────┐
│                   Nginx (反向代理)                │
├────────────────────┬────────────────────────────┤
│   React 前端        │       FastAPI 后端          │
│   - Ant Design 5   │       - SQLAlchemy 2.0     │
│   - ECharts        │       - Celery 异步任务      │
│   - Zustand        │       - JWT 认证            │
├────────────────────┴────────────────────────────┤
│                  基础设施层                       │
│  PostgreSQL │ Redis │ MinIO (S3 对象存储)         │
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

- **Docker Desktop** (Mac) 或 **Docker Engine + Docker Compose** (Linux)
- 至少 **8GB 内存**（本地 AI 模型需要较多内存）
- 至少 **10GB 磁盘空间**（AI 模型 + 数据存储）

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url> life_print
cd life_print
```

### 2. 配置环境变量（可选）

```bash
cp backend/.env.example .env
# 编辑 .env 文件，配置系统级默认 API Key（也可以启动后在网页中配置）
```

### 3. 一键启动

```bash
chmod +x start.sh
./start.sh
```

启动完成后访问 **http://localhost** ，注册账号后在设置页面配置您的 API Key。

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

## 📁 项目目录结构

```
life_print/
├── backend/                  # 后端 (FastAPI)
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
├── frontend/                 # 前端 (React + TypeScript)
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # 通用组件
│   │   ├── services/        # API 调用
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
├── start.sh                  # 一键启动脚本
└── .env                      # 环境变量 (从 .env.example 复制)
```

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

完全支持。已移除 NVIDIA GPU 依赖，所有本地 AI 模型使用 CPU 推理（`onnxruntime`）。

### Q: 如何停止服务？

```bash
docker compose down        # 停止并移除容器
docker compose down -v     # 停止并清除所有数据
```

### Q: 如何备份数据？

所有数据存储在项目目录下的 `data/` 文件夹中，直接备份该文件夹即可。

## 📄 License

MIT
