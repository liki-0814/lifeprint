### LifePrint 儿童成长记录平台技术架构方案 ###
基于已完成的基础配置、数据模型和 Schemas，继续创建后端 API 路由、业务逻辑、AI 流水线、前端项目和 Docker 部署配置。


## 已完成

- Step 1: 后端基础配置文件 (requirements.txt, config.py, database.py, celery_app.py, .env.example)
- Step 2: 后端 SQLAlchemy 数据模型 (user, family, child, media, analysis, report)
- Step 3: 后端 Pydantic Schemas (user, family, child, media, analysis, report)

---

## Step 4: 后端工具函数 + 认证服务

- `backend/app/utils/__init__.py`
- `backend/app/utils/deps.py` - 通用依赖注入
  - `get_current_user`: 从 JWT Token 解析当前用户
  - `get_current_family`: 验证用户对家庭的访问权限
- `backend/app/services/__init__.py`
- `backend/app/services/auth_service.py` - 认证服务
  - `hash_password`: bcrypt 密码哈希
  - `verify_password`: 密码验证
  - `create_access_token`: JWT Token 生成
  - `decode_access_token`: JWT Token 解析

## Step 5: 后端 API 路由

- `backend/app/api/__init__.py`
- `backend/app/api/v1/__init__.py`
- `backend/app/main.py` - FastAPI 主入口，CORS，路由注册，健康检查
- `backend/app/api/v1/auth.py` - POST /register, POST /login, POST /refresh
- `backend/app/api/v1/families.py` - POST /, GET /{id}, 家庭 CRUD
- `backend/app/api/v1/children.py` - POST /, GET /, PUT /{id}, 孩子 CRUD
- `backend/app/api/v1/media.py` - POST /upload/init, POST /upload/{id}/part, POST /upload/{id}/complete, GET /, GET /{id}, DELETE /{id}
- `backend/app/api/v1/analysis.py` - GET /{media_id}/analysis, GET /{media_id}/analysis/status, POST /{media_id}/reanalyze
- `backend/app/api/v1/reports.py` - GET /{child_id}/reports, GET /{child_id}/reports/{id}, GET /{child_id}/reports/{id}/pdf, POST /{child_id}/reports/generate
- `backend/app/api/v1/autonomy.py` - GET /{child_id}/skills, GET /{child_id}/initiative
- `backend/app/api/v1/export.py` - POST /{child_id}/export, GET /{child_id}/export/status, GET /{child_id}/export/download

## Step 6: 后端媒体服务 + 报告服务

- `backend/app/services/media_service.py` - MinIO 文件操作封装（初始化 bucket、上传、下载、删除、生成预签名 URL）
- `backend/app/services/analysis_service.py` - 分析结果聚合查询、成长指标趋势计算
- `backend/app/services/report_service.py` - 月度报告数据汇总、雷达图数据计算、火花卡片检测逻辑

## Step 7: 后端 AI 分析流水线 + Celery 任务

本地模型封装：
- `backend/app/ai/__init__.py`
- `backend/app/ai/local/__init__.py`
- `backend/app/ai/local/scene_detector.py` - PySceneDetect 关键帧提取
- `backend/app/ai/local/face_engine.py` - InsightFace 人脸检测/识别
- `backend/app/ai/local/whisper_engine.py` - Whisper 语音转文字

大模型 API 调用：
- `backend/app/ai/remote/__init__.py`
- `backend/app/ai/remote/behavior_analyzer.py` - 行为识别（通义千问 VL API + Prompt）
- `backend/app/ai/remote/emotion_analyzer.py` - 情感分析
- `backend/app/ai/remote/report_generator.py` - 月度报告生成

流水线编排 + Celery 任务：
- `backend/app/ai/pipeline.py` - 视频分析全流程编排
- `backend/app/tasks/__init__.py`
- `backend/app/tasks/preprocess.py` - 视频预处理任务
- `backend/app/tasks/analyze.py` - AI 深度分析任务
- `backend/app/tasks/report.py` - 月度报告定时生成任务

## Step 8: 前端项目骨架

配置文件：
- `frontend/package.json`
- `frontend/tsconfig.json`
- `frontend/tsconfig.node.json`
- `frontend/vite.config.ts`
- `frontend/index.html`

入口和核心文件：
- `frontend/src/main.tsx`
- `frontend/src/App.tsx` - 路由 + Ant Design ConfigProvider
- `frontend/src/index.css`
- `frontend/src/vite-env.d.ts`
- `frontend/src/services/api.ts` - Axios + JWT 拦截器
- `frontend/src/stores/authStore.ts` - Zustand 认证状态

## Step 9: 前端页面组件

- `frontend/src/pages/Dashboard/index.tsx`
- `frontend/src/pages/Upload/index.tsx`
- `frontend/src/pages/Timeline/index.tsx`
- `frontend/src/pages/Report/index.tsx`
- `frontend/src/pages/SkillTree/index.tsx`
- `frontend/src/pages/Compare/index.tsx`
- `frontend/src/pages/Login/index.tsx`
- `frontend/src/pages/Register/index.tsx`

## Step 10: Docker Compose + Nginx + Alembic

- `backend/alembic.ini`
- `backend/alembic/env.py`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `docker-compose.yml`
- `nginx/nginx.conf`

---

## 执行顺序

Step 4 -> Step 5 -> Step 6 -> Step 7 -> Step 8 -> Step 9 -> Step 10

使用 sub agent 并行执行独立的 Step，加快进度。


updateAtTime: 2026/2/12 21:45:28

planId: 

plan_status: review