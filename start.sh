#!/bin/bash
set -e

echo "🌱 LifePrint - 儿童成长记录平台"
echo "================================"
echo ""

MODE="${1:-docker}"


show_help() {
    echo "用法: ./start.sh [模式]"
    echo ""
    echo "可用模式："
    echo "  docker    Docker Compose 一键启动（默认，适合部署）"
    echo "  dev       本地开发模式（需要本地安装 Python/Node.js）"
    echo "  infra     仅启动基础设施（PostgreSQL + Redis + MinIO）"
    echo "  stop      停止所有服务"
    echo "  clean     停止并清除所有数据"
    echo "  help      显示此帮助信息"
    echo ""
    echo "示例："
    echo "  ./start.sh              # Docker 一键启动"
    echo "  ./start.sh dev          # 本地开发模式"
    echo "  ./start.sh infra        # 仅启动数据库等基础设施"
    echo "  ./start.sh stop         # 停止所有服务"
}

# 检测 Docker Compose 命令
detect_compose() {
    if docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        echo "❌ 未检测到 Docker Compose"
        exit 1
    fi
}

# 创建数据目录
ensure_data_dirs() {
    echo "📁 创建数据目录..."
    mkdir -p ./data/{postgres,redis,minio,uploads,temp,exports,models}
    echo "✅ 数据目录已就绪"
}

# 确保 nginx 配置存在
ensure_nginx_conf() {
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
}

# ========== Docker 一键启动 ==========
start_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ 未检测到 Docker，请先安装 Docker Desktop"
        echo "   Mac: https://docs.docker.com/desktop/install/mac-install/"
        echo "   Linux: https://docs.docker.com/engine/install/"
        exit 1
    fi
    detect_compose
    echo "✅ Docker 已就绪"

    ensure_data_dirs
    ensure_nginx_conf

    echo ""
    echo "🚀 正在启动所有服务（Docker 模式）..."
    $COMPOSE_CMD up -d --build

    echo ""
    echo "⏳ 等待服务就绪..."
    sleep 10

    echo ""
    echo "📊 服务状态："
    $COMPOSE_CMD ps

    echo ""
    echo "================================"
    echo "🎉 LifePrint 启动完成！"
    echo ""
    echo "🌐 访问地址：http://localhost"
    echo "📡 后端 API：http://localhost:8000/docs"
    echo "💾 MinIO 控制台：http://localhost:9001 (minioadmin / minioadmin123)"
    echo ""
    echo "首次使用请：1. 注册账号  2. 在设置页面配置 API Key"
    echo ""
    echo "停止服务：./start.sh stop"
    echo "查看日志：$COMPOSE_CMD logs -f"
    echo "================================"
}

# ========== 仅启动基础设施 ==========
start_infra() {
    if ! command -v docker &> /dev/null; then
        echo "❌ 未检测到 Docker"
        exit 1
    fi
    detect_compose
    ensure_data_dirs

    echo "🚀 正在启动基础设施（PostgreSQL + Redis + MinIO）..."
    $COMPOSE_CMD up -d postgres redis minio

    echo ""
    echo "⏳ 等待服务就绪..."
    sleep 5

    echo ""
    echo "✅ 基础设施已启动："
    echo "   PostgreSQL: localhost:5432 (lifeprint / lifeprint_secret)"
    echo "   Redis:      localhost:6379"
    echo "   MinIO:      localhost:9000 (minioadmin / minioadmin123)"
    echo "   MinIO 控制台: http://localhost:9001"
    echo ""
    echo "现在可以用以下命令启动后端和前端："
    echo "   后端: cd backend && uvicorn app.main:app --reload --port 8000"
    echo "   前端: cd frontend && npm run dev"
}

# ========== 本地开发模式 ==========
start_dev() {
    echo "🔧 本地开发模式"
    echo ""

    ensure_data_dirs

    # 检查 Python
    if ! command -v python3 &> /dev/null; then
        echo "❌ 未检测到 Python3，请先安装 Python 3.11+"
        exit 1
    fi
    echo "✅ Python: $(python3 --version)"

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ 未检测到 Node.js，请先安装 Node.js 18+"
        exit 1
    fi
    echo "✅ Node.js: $(node --version)"

    # 检查 MinIO
    MINIO_RUNNING=false
    if command -v minio &> /dev/null; then
        echo "✅ MinIO 已安装"
    else
        echo "⚠️  MinIO 未安装，请安装: brew install minio/stable/minio"
    fi

    # 检查 PostgreSQL
    if pg_isready &> /dev/null 2>&1; then
        echo "✅ PostgreSQL 已运行"
    else
        echo "⚠️  PostgreSQL 未运行，请启动: brew services start postgresql@15"
        echo "   或使用 Docker: ./start.sh infra"
    fi

    echo ""
    echo "📦 安装后端依赖..."
    cd backend
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        echo "✅ 已创建虚拟环境"
    fi
    source venv/bin/activate
    pip install -r requirements.txt -q
    echo "✅ 后端依赖已安装"
    cd ..

    echo ""
    echo "📦 安装前端依赖..."
    cd frontend
    npm install --silent
    echo "✅ 前端依赖已安装"
    cd ..

    echo ""
    echo "================================"
    echo "✅ 开发环境准备完成！"
    echo ""
    echo "请在不同终端窗口中分别启动："
    echo ""
    echo "  终端1 - MinIO（如果未运行）："
    echo "    minio server ./data/minio --console-address ':9001'"
    echo ""
    echo "  终端2 - 后端："
    echo "    cd backend && source venv/bin/activate"
    echo "    uvicorn app.main:app --reload --port 8000"
    echo ""
    echo "  终端3 - 前端："
    echo "    cd frontend && npm run dev"
    echo ""
    echo "🌐 前端访问：http://localhost:5173"
    echo "📡 后端 API：http://localhost:8000/docs"
    echo "💾 MinIO 控制台：http://localhost:9001"
    echo "================================"
}

# ========== 停止服务 ==========
stop_services() {
    detect_compose
    echo "🛑 正在停止所有服务..."
    $COMPOSE_CMD down
    echo "✅ 所有服务已停止"
}

# ========== 清除数据 ==========
clean_all() {
    detect_compose
    echo "⚠️  即将停止所有服务并清除数据！"
    read -p "确认继续？(y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        $COMPOSE_CMD down -v
        echo "✅ 所有服务已停止，数据卷已清除"
        echo "💡 本地 data/ 目录未删除，如需彻底清除请手动执行: rm -rf ./data"
    else
        echo "已取消"
    fi
}

# ========== 主逻辑 ==========
case "$MODE" in
    docker)
        start_docker
        ;;
    dev)
        start_dev
        ;;
    infra)
        start_infra
        ;;
    stop)
        stop_services
        ;;
    clean)
        clean_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "❌ 未知模式: $MODE"
        echo ""
        show_help
        exit 1
        ;;
esac
