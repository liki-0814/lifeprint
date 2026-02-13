#!/bin/bash
set -e

echo "🌱 LifePrint - 儿童成长记录平台"
echo "================================"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 未检测到 Docker，请先安装 Docker Desktop"
    echo "   Mac: https://docs.docker.com/desktop/install/mac-install/"
    echo "   Linux: https://docs.docker.com/engine/install/"
    exit 1
fi

# 检查 Docker Compose 是否可用
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ 未检测到 Docker Compose，请确保 Docker Desktop 已正确安装"
    exit 1
fi

echo "✅ Docker 已就绪"

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p ./data/{postgres,redis,minio,uploads,temp,exports,models}
echo "✅ 数据目录已就绪"

# 检查 .env 文件
if [ ! -f .env ]; then
    if [ -f backend/.env.example ]; then
        cp backend/.env.example .env
        echo "📝 已从 .env.example 创建 .env 文件"
        echo "⚠️  请编辑 .env 文件配置您的 API Key（也可以启动后在网页设置页面配置）"
    else
        echo "⚠️  未找到 .env.example，将使用默认配置启动"
    fi
else
    echo "✅ .env 文件已存在"
fi

# 创建 nginx 配置目录
mkdir -p ./nginx
if [ ! -f ./nginx/nginx.conf ]; then
    cat > ./nginx/nginx.conf << 'NGINX_EOF'
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8000;
    }

    upstream frontend {
        server frontend:80;
    }

    server {
        listen 80;

        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 300s;
            client_max_body_size 500M;
        }

        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
NGINX_EOF
    echo "✅ Nginx 配置已创建"
fi

# 启动服务
echo ""
echo "🚀 正在启动所有服务..."
$COMPOSE_CMD up -d --build

echo ""
echo "⏳ 等待服务就绪..."
sleep 10

# 检查服务状态
echo ""
echo "📊 服务状态："
$COMPOSE_CMD ps

echo ""
echo "================================"
echo "🎉 LifePrint 启动完成！"
echo ""
echo "🌐 访问地址：http://localhost"
echo "📡 后端 API：http://localhost:8000/docs"
echo "💾 MinIO 控制台：http://localhost:9001"
echo ""
echo "首次使用请：1. 注册账号  2. 在设置页面配置 API Key"
echo ""
echo "停止服务：$COMPOSE_CMD down"
echo "查看日志：$COMPOSE_CMD logs -f"
echo "================================"
