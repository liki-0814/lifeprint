FROM python:3.11-slim-bookworm

WORKDIR /app

# 系统依赖：ffmpeg（视频处理）、OpenCV 运行时库、PostgreSQL 客户端库
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖（核心依赖 + AI 可选依赖分开安装）
COPY requirements.txt requirements-ai.txt* ./
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ -f requirements-ai.txt ]; then pip install --no-cache-dir -r requirements-ai.txt || echo "⚠️ AI dependencies install failed, skipping..."; fi

COPY . .

# 创建数据目录
RUN mkdir -p /app/data/{temp,uploads,exports,models}

EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
