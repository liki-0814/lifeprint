### LifePrint 本地运行适配与 README ###
重构 AI 模块支持 OpenAI/Anthropic 双格式 API，添加用户级 API 配置页面，适配 MacBook 本地运行（数据存储在项目目录），创建完整 README。


## 需要修改的内容概览

本次改动涉及 **后端配置/模型/API/AI模块** + **前端设置页面** + **Docker/启动脚本** + **README** 共 4 大块。

---

## 1. 后端：重构 AI 远程调用，支持 OpenAI 和 Anthropic 双格式

### 1.1 修改 `backend/app/config.py`
- 新增配置项：`LLM_PROVIDER`（openai / anthropic）、`LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`（文本模型）、`LLM_VISION_MODEL`（视觉模型）
- 保留 `DASHSCOPE_API_KEY` 作为向后兼容
- 新增 `DATA_DIR` 配置项，默认值为项目根目录下的 `./data`，所有产生的数据文件（上传文件、临时文件、导出文件等）都存放在此目录

### 1.2 新建 `backend/app/ai/remote/llm_client.py` - 统一 LLM 客户端
- 封装一个统一的 `LLMClient` 类，根据 `LLM_PROVIDER` 配置自动选择调用方式
- **OpenAI 格式**：使用 `openai` SDK，支持自定义 `base_url`（兼容 DashScope、DeepSeek、Groq 等所有 OpenAI 兼容 API）
- **Anthropic 格式**：使用 `anthropic` SDK，支持自定义 `base_url`
- 提供两个核心方法：
  - `chat(messages, model)` - 纯文本对话
  - `vision(messages_with_images, model)` - 多模态视觉分析
- 支持用户级别覆盖（从数据库读取用户自己配置的 API Key）

### 1.3 重构 3 个 AI 远程分析模块
- `backend/app/ai/remote/behavior_analyzer.py` - 改用 `LLMClient.vision()` 替代硬编码 httpx 调用
- `backend/app/ai/remote/emotion_analyzer.py` - 同上
- `backend/app/ai/remote/report_generator.py` - 改用 `LLMClient.chat()` 替代硬编码 httpx 调用

### 1.4 修改 `backend/requirements.txt`
- 新增 `anthropic` 依赖包

### 1.5 修改 `backend/.env.example`
- 新增 LLM 相关配置项示例

---

## 2. 后端：用户级 API 配置存储

### 2.1 修改 `backend/app/models/user.py`
- User 模型新增字段：`llm_provider`、`llm_api_key`、`llm_base_url`、`llm_model`、`llm_vision_model`
- 这些字段允许为空，为空时使用系统级默认配置

### 2.2 修改 `backend/app/schemas/user.py`
- 新增 `UserSettingsRequest` 和 `UserSettingsResponse` schema

### 2.3 新建 `backend/app/api/v1/settings.py` - 用户设置 API
- `GET /api/v1/settings` - 获取当前用户的 API 配置
- `PUT /api/v1/settings` - 更新用户的 API 配置（provider、api_key、base_url、model、vision_model）
- `POST /api/v1/settings/test` - 测试 API 连通性

### 2.4 修改 `backend/app/main.py`
- 注册 settings 路由

---

## 3. 后端：数据目录本地化

### 3.1 修改 `docker-compose.yml`
- PostgreSQL、Redis、MinIO 的数据卷改为绑定到项目目录下的 `./data/postgres`、`./data/redis`、`./data/minio`
- 临时文件目录绑定到 `./data/temp`

### 3.2 新建 `backend/app/utils/data_dir.py`
- 提供 `ensure_data_dirs()` 函数，启动时自动创建 `data/` 下的子目录（uploads、temp、exports、models）

### 3.3 修改 `backend/app/main.py`
- 启动时调用 `ensure_data_dirs()`

---

## 4. 前端：注册流程 + API 设置页面

### 4.1 修改 `frontend/src/App.tsx`
- 添加路由守卫：未登录用户强制跳转到 `/register`（而非 `/login`）
- 新增 `/settings` 路由

### 4.2 修改 `frontend/src/pages/Register/index.tsx`
- 注册成功后自动跳转到 `/settings` 页面（引导用户配置 API Key）

### 4.3 新建 `frontend/src/pages/Settings/index.tsx` - API 设置页面
- 表单字段：
  - LLM Provider 下拉选择（OpenAI / Anthropic）
  - API Key 输入框（密码模式）
  - Base URL 输入框（带默认值提示）
  - 文本模型名称输入框
  - 视觉模型名称输入框
- "测试连接" 按钮
- 保存按钮
- 页面顶部提示说明

### 4.4 修改 `frontend/src/services/api.ts`
- 新增 `settingsApi` 模块（get、update、test）

### 4.5 修改侧边栏菜单
- 在 `App.tsx` 的 menuItems 中添加"设置"菜单项

---

## 5. MacBook 本地运行适配

### 5.1 修改 `backend/requirements.txt`
- `onnxruntime-gpu` 改为 `onnxruntime`（Mac 没有 NVIDIA GPU）
- 新增 `anthropic` 包

### 5.2 修改 `docker-compose.yml`
- celery-worker 的 GPU 设备映射改为可选（通过环境变量控制）
- 数据卷全部绑定到 `./data/` 目录

### 5.3 新建 `start.sh` - 本地一键启动脚本
- 检查 Docker 和 Docker Compose 是否安装
- 自动创建 `./data` 目录结构
- 如果 `.env` 不存在，从 `.env.example` 复制
- 执行 `docker-compose up -d --build`
- 等待服务就绪后打印访问地址

### 5.4 新建 `.gitignore`

---

## 6. 创建 README.md

内容包括：
- 项目简介和核心功能
- 技术架构图（文字版）
- 环境要求（Docker Desktop for Mac / Linux Docker）
- 快速开始（3 步：clone -> 配置 .env -> ./start.sh）
- API Key 配置说明（OpenAI 格式 vs Anthropic 格式，各自的 base_url 和模型名）
- 本地 AI 模型说明（Whisper、InsightFace 不需要 API Key，首次运行自动下载）
- 项目目录结构
- 常见问题

---

## 7. 关于打包成独立程序的说明

**结论：不建议打包成单个可执行文件**，原因：
- 依赖 PostgreSQL + Redis + MinIO 三个外部服务，无法内嵌
- 本地 AI 模型文件较大（Whisper ~1GB、InsightFace ~300MB）
- 前端需要 Node.js 构建

**推荐方案**：使用 `docker-compose up -d` 一键启动，Mac 和 Linux 通用，`start.sh` 脚本会自动处理所有初始化工作。这是最接近"双击运行"的体验。

---

## 执行顺序

Step 1 -> Step 2 -> Step 3 -> Step 4 -> Step 5 -> Step 6

其中 Step 1（AI 模块重构）和 Step 2（用户设置）有依赖关系需串行；Step 3（数据目录）、Step 4（前端设置页）可在 Step 2 之后并行；Step 5、Step 6 最后执行。


updateAtTime: 2026/2/12 22:31:35

planId: 

plan_status: review