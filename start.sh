#!/bin/bash
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}🌱 LifePrint - 儿童成长记录平台${NC}"
echo "================================"
echo ""

MODE="${1:-help}"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ========== 帮助信息 ==========
show_help() {
    echo -e "用法: ${GREEN}./start.sh [模式]${NC}"
    echo ""
    echo "可用模式："
    echo ""
    echo -e "  ${GREEN}docker${NC}      Docker Compose 一键启动（适合部署，需要 Docker）"
    echo -e "  ${GREEN}local${NC}       纯本地启动（不需要 Docker，自动启动所有服务）"
    echo -e "  ${GREEN}dev${NC}         本地开发模式（Docker 跑基础设施 + 本地跑前后端，支持热重载）"
    echo -e "  ${GREEN}infra${NC}       仅启动基础设施（PostgreSQL + Redis + MinIO）"
    echo -e "  ${GREEN}backend${NC}     仅启动后端（需要基础设施已运行）"
    echo -e "  ${GREEN}frontend${NC}    仅启动前端（需要后端已运行）"
    echo -e "  ${GREEN}stop${NC}        停止所有服务"
    echo -e "  ${GREEN}clean${NC}       停止并清除所有 Docker 数据卷"
    echo -e "  ${GREEN}status${NC}      查看服务运行状态"
    echo -e "  ${GREEN}logs${NC}        查看 Docker 服务日志"
    echo -e "  ${GREEN}help${NC}        显示此帮助信息"
    echo ""
    echo "示例："
    echo -e "  ${CYAN}./start.sh docker${NC}      # Docker 一键启动（最简单）"
    echo -e "  ${CYAN}./start.sh local${NC}       # 纯本地启动（不需要 Docker）"
    echo -e "  ${CYAN}./start.sh dev${NC}         # 开发模式（推荐开发时使用）"
    echo -e "  ${CYAN}./start.sh infra${NC}       # 只启动数据库等"
    echo -e "  ${CYAN}./start.sh stop${NC}        # 停止所有"
    echo ""
    echo "启动方式对比："
    echo "┌──────────┬──────────┬──────────┬──────────────────────────┐"
    echo "│ 模式     │ 需Docker │ 需本地环境│ 适用场景                 │"
    echo "├──────────┼──────────┼──────────┼──────────────────────────┤"
    echo "│ docker   │ ✅       │ ❌       │ 部署、演示、快速体验     │"
    echo "│ local    │ ❌       │ ✅       │ 无Docker环境、纯本地开发 │"
    echo "│ dev      │ ✅       │ ✅       │ 日常开发（推荐）         │"
    echo "└──────────┴──────────┴──────────┴──────────────────────────┘"
    echo ""
    echo -e "本地环境要求：Python 3.11+、Node.js 18+、PostgreSQL 15+、Redis 7+${NC}"
}

# ========== 工具函数 ==========

detect_compose() {
    if docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}❌ 未检测到 Docker Compose${NC}"
        exit 1
    fi
}

ensure_data_dirs() {
    echo "📁 创建数据目录..."
    mkdir -p "$PROJECT_DIR/data"/{postgres,redis,minio,uploads,temp,exports,models}
    echo -e "${GREEN}✅ 数据目录已就绪${NC}"
}

ensure_nginx_conf() {
    mkdir -p "$PROJECT_DIR/nginx"
    if [ ! -f "$PROJECT_DIR/nginx/nginx.conf" ]; then
        cat > "$PROJECT_DIR/nginx/nginx.conf" << 'NGINX_EOF'
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
        echo -e "${GREEN}✅ Nginx 配置已创建${NC}"
    fi
}

ensure_backend_venv() {
    cd "$PROJECT_DIR/backend"
    if [ ! -d "venv" ]; then
        echo "📦 创建 Python 虚拟环境..."
        python3 -m venv venv
    fi
    source venv/bin/activate
    echo "📦 安装后端依赖..."
    pip install -r requirements.txt -q
    if [ -f requirements-ai.txt ]; then
        pip install -r requirements-ai.txt -q 2>/dev/null || echo -e "${YELLOW}⚠️  AI 可选依赖安装失败，不影响核心功能${NC}"
    fi
    echo -e "${GREEN}✅ 后端依赖已安装${NC}"
    cd "$PROJECT_DIR"
}

ensure_frontend_deps() {
    cd "$PROJECT_DIR/frontend"
    if [ ! -d "node_modules" ]; then
        echo "📦 安装前端依赖..."
        npm install --silent
    fi
    echo -e "${GREEN}✅ 前端依赖已就绪${NC}"
    cd "$PROJECT_DIR"
}

check_port() {
    local port=$1
    local name=$2
    if lsof -i :"$port" &>/dev/null; then
        echo -e "${YELLOW}⚠️  端口 $port ($name) 已被占用${NC}"
        return 1
    fi
    return 0
}

wait_for_service() {
    local host=$1
    local port=$2
    local name=$3
    local max_wait=${4:-30}
    local count=0
    echo -n "   等待 $name ($host:$port) "
    while ! nc -z "$host" "$port" 2>/dev/null; do
        sleep 1
        count=$((count + 1))
        echo -n "."
        if [ $count -ge $max_wait ]; then
            echo -e " ${RED}超时${NC}"
            return 1
        fi
    done
    echo -e " ${GREEN}就绪${NC}"
    return 0
}

print_success_banner() {
    local frontend_url=$1
    local backend_url=$2
    local minio_url=${3:-"http://localhost:9001"}

    echo ""
    echo "================================"
    echo -e "${GREEN}🎉 LifePrint 启动完成！${NC}"
    echo ""
    echo -e "🌐 前端访问：${CYAN}${frontend_url}${NC}"
    echo -e "📡 后端 API：${CYAN}${backend_url}/docs${NC}"
    echo -e "💾 MinIO 控制台：${CYAN}${minio_url}${NC} (minioadmin / minioadmin123)"
    echo ""
    echo "首次使用请：1. 注册账号  2. 在设置页面配置 API Key"
    echo ""
    echo -e "停止服务：${GREEN}./start.sh stop${NC}"
    echo "================================"
}

# ========== Docker 一键启动 ==========
start_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ 未检测到 Docker，请先安装 Docker Desktop${NC}"
        echo "   Mac: https://docs.docker.com/desktop/install/mac-install/"
        echo "   Linux: https://docs.docker.com/engine/install/"
        echo ""
        echo -e "   或使用纯本地模式：${GREEN}./start.sh local${NC}"
        exit 1
    fi
    detect_compose
    echo -e "${GREEN}✅ Docker 已就绪${NC}"

    ensure_data_dirs
    ensure_nginx_conf

    echo ""
    echo -e "🚀 正在启动所有服务（${BLUE}Docker 模式${NC}）..."
    $COMPOSE_CMD up -d --build

    echo ""
    echo "⏳ 等待服务就绪..."
    sleep 10

    echo ""
    echo "📊 服务状态："
    $COMPOSE_CMD ps

    print_success_banner "http://localhost" "http://localhost:8000" "http://localhost:9001"
    echo -e "查看日志：${GREEN}$COMPOSE_CMD logs -f${NC}"
}

# ========== 纯本地启动（不需要 Docker） ==========
start_local() {
    echo -e "🔧 ${BLUE}纯本地启动模式${NC}（不需要 Docker）"
    echo ""

    # 检查必要工具
    local missing=0

    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}❌ 未检测到 Python3，请安装 Python 3.11+${NC}"
        echo "   Mac: brew install python@3.11"
        missing=1
    else
        echo -e "${GREEN}✅ Python: $(python3 --version)${NC}"
    fi

    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ 未检测到 Node.js，请安装 Node.js 18+${NC}"
        echo "   Mac: brew install node@18"
        missing=1
    else
        echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
    fi

    if [ $missing -eq 1 ]; then
        exit 1
    fi

    ensure_data_dirs

    # 检查并启动 PostgreSQL
    echo ""
    echo "📋 检查基础设施..."
    if pg_isready &> /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL 已运行${NC}"
    else
        echo -e "${YELLOW}⚠️  PostgreSQL 未运行，尝试启动...${NC}"
        if command -v brew &> /dev/null; then
            brew services start postgresql@15 2>/dev/null || brew services start postgresql 2>/dev/null || true
            sleep 2
            if pg_isready &> /dev/null 2>&1; then
                echo -e "${GREEN}✅ PostgreSQL 已启动${NC}"
            else
                echo -e "${RED}❌ PostgreSQL 启动失败，请手动启动${NC}"
                echo "   Mac: brew install postgresql@15 && brew services start postgresql@15"
                echo "   Linux: sudo systemctl start postgresql"
                exit 1
            fi
        else
            echo -e "${RED}❌ 请手动启动 PostgreSQL${NC}"
            exit 1
        fi
    fi

    # 检查并启动 Redis
    if redis-cli ping &> /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis 已运行${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis 未运行，尝试启动...${NC}"
        if command -v brew &> /dev/null; then
            brew services start redis 2>/dev/null || true
            sleep 2
            if redis-cli ping &> /dev/null 2>&1; then
                echo -e "${GREEN}✅ Redis 已启动${NC}"
            else
                echo -e "${RED}❌ Redis 启动失败${NC}"
                echo "   Mac: brew install redis && brew services start redis"
                exit 1
            fi
        else
            echo -e "${RED}❌ 请手动启动 Redis${NC}"
            exit 1
        fi
    fi

    # 检查并启动 MinIO
    if curl -s http://localhost:9000/minio/health/live &> /dev/null; then
        echo -e "${GREEN}✅ MinIO 已运行${NC}"
    else
        echo -e "${YELLOW}⚠️  MinIO 未运行，尝试后台启动...${NC}"
        if command -v minio &> /dev/null; then
            mkdir -p "$PROJECT_DIR/data/minio"
            MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin123 \
                nohup minio server "$PROJECT_DIR/data/minio" --console-address ":9001" \
                > "$PROJECT_DIR/data/minio.log" 2>&1 &
            echo $! > "$PROJECT_DIR/data/minio.pid"
            sleep 2
            if curl -s http://localhost:9000/minio/health/live &> /dev/null; then
                echo -e "${GREEN}✅ MinIO 已启动 (PID: $(cat "$PROJECT_DIR/data/minio.pid"))${NC}"
            else
                echo -e "${RED}❌ MinIO 启动失败，请检查日志: data/minio.log${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ MinIO 未安装${NC}"
            echo "   Mac: brew install minio/stable/minio"
            exit 1
        fi
    fi

    # 创建数据库（如果不存在）
    echo ""
    echo "📋 检查数据库..."
    if command -v createdb &> /dev/null; then
        createdb life_print 2>/dev/null && echo -e "${GREEN}✅ 数据库 life_print 已创建${NC}" \
            || echo -e "${GREEN}✅ 数据库 life_print 已存在${NC}"
    fi

    # 安装依赖
    echo ""
    ensure_backend_venv
    ensure_frontend_deps

    # 启动后端
    echo ""
    echo "🚀 启动后端服务..."
    cd "$PROJECT_DIR/backend"
    source venv/bin/activate
    nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload \
        > "$PROJECT_DIR/data/backend.log" 2>&1 &
    echo $! > "$PROJECT_DIR/data/backend.pid"
    echo -e "${GREEN}✅ 后端已启动 (PID: $(cat "$PROJECT_DIR/data/backend.pid"))${NC}"
    cd "$PROJECT_DIR"

    # 启动 Celery Worker
    echo "🚀 启动 Celery Worker..."
    cd "$PROJECT_DIR/backend"
    source venv/bin/activate
    nohup celery -A app.celery_app:celery_app worker --loglevel=info --concurrency=2 \
        > "$PROJECT_DIR/data/celery-worker.log" 2>&1 &
    echo $! > "$PROJECT_DIR/data/celery-worker.pid"
    echo -e "${GREEN}✅ Celery Worker 已启动 (PID: $(cat "$PROJECT_DIR/data/celery-worker.pid"))${NC}"
    cd "$PROJECT_DIR"

    # 启动前端
    echo "🚀 启动前端服务..."
    cd "$PROJECT_DIR/frontend"
    nohup npm run dev -- --host 0.0.0.0 --port 5173 \
        > "$PROJECT_DIR/data/frontend.log" 2>&1 &
    echo $! > "$PROJECT_DIR/data/frontend.pid"
    echo -e "${GREEN}✅ 前端已启动 (PID: $(cat "$PROJECT_DIR/data/frontend.pid"))${NC}"
    cd "$PROJECT_DIR"

    sleep 3
    print_success_banner "http://localhost:5173" "http://localhost:8000" "http://localhost:9001"
    echo ""
    echo "日志文件："
    echo "   后端: tail -f data/backend.log"
    echo "   前端: tail -f data/frontend.log"
    echo "   Celery: tail -f data/celery-worker.log"
    echo "   MinIO: tail -f data/minio.log"
}

# ========== 开发模式（Docker 基础设施 + 本地前后端） ==========
start_dev() {
    echo -e "🔧 ${BLUE}开发模式${NC}（Docker 基础设施 + 本地前后端）"
    echo ""

    # 检查环境
    local missing=0
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}❌ 未检测到 Python3${NC}"
        missing=1
    else
        echo -e "${GREEN}✅ Python: $(python3 --version)${NC}"
    fi

    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ 未检测到 Node.js${NC}"
        missing=1
    else
        echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
    fi

    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ 未检测到 Docker（基础设施需要 Docker）${NC}"
        echo -e "   如果不想用 Docker，请使用：${GREEN}./start.sh local${NC}"
        missing=1
    fi

    if [ $missing -eq 1 ]; then
        exit 1
    fi

    # 启动基础设施
    detect_compose
    ensure_data_dirs

    echo ""
    echo "🚀 启动基础设施（PostgreSQL + Redis + MinIO）..."
    $COMPOSE_CMD up -d postgres redis minio

    echo ""
    echo "⏳ 等待基础设施就绪..."
    wait_for_service localhost 5432 "PostgreSQL"
    wait_for_service localhost 6379 "Redis"
    wait_for_service localhost 9000 "MinIO"

    # 安装依赖
    echo ""
    ensure_backend_venv
    ensure_frontend_deps

    # 启动后端
    echo ""
    echo "🚀 启动后端服务（热重载）..."
    cd "$PROJECT_DIR/backend"
    source venv/bin/activate
    nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload \
        > "$PROJECT_DIR/data/backend.log" 2>&1 &
    echo $! > "$PROJECT_DIR/data/backend.pid"
    echo -e "${GREEN}✅ 后端已启动 (PID: $(cat "$PROJECT_DIR/data/backend.pid"))${NC}"
    cd "$PROJECT_DIR"

    # 启动 Celery Worker
    echo "🚀 启动 Celery Worker..."
    cd "$PROJECT_DIR/backend"
    source venv/bin/activate
    nohup celery -A app.celery_app:celery_app worker --loglevel=info --concurrency=2 \
        > "$PROJECT_DIR/data/celery-worker.log" 2>&1 &
    echo $! > "$PROJECT_DIR/data/celery-worker.pid"
    echo -e "${GREEN}✅ Celery Worker 已启动 (PID: $(cat "$PROJECT_DIR/data/celery-worker.pid"))${NC}"
    cd "$PROJECT_DIR"

    # 启动前端
    echo "🚀 启动前端服务（热重载）..."
    cd "$PROJECT_DIR/frontend"
    nohup npm run dev -- --host 0.0.0.0 --port 5173 \
        > "$PROJECT_DIR/data/frontend.log" 2>&1 &
    echo $! > "$PROJECT_DIR/data/frontend.pid"
    echo -e "${GREEN}✅ 前端已启动 (PID: $(cat "$PROJECT_DIR/data/frontend.pid"))${NC}"
    cd "$PROJECT_DIR"

    sleep 3
    print_success_banner "http://localhost:5173" "http://localhost:8000" "http://localhost:9001"
    echo ""
    echo "日志文件："
    echo "   后端: tail -f data/backend.log"
    echo "   前端: tail -f data/frontend.log"
    echo "   Celery: tail -f data/celery-worker.log"
}

# ========== 仅启动基础设施 ==========
start_infra() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ 未检测到 Docker${NC}"
        exit 1
    fi
    detect_compose
    ensure_data_dirs

    echo -e "🚀 正在启动基础设施（${BLUE}PostgreSQL + Redis + MinIO${NC}）..."
    $COMPOSE_CMD up -d postgres redis minio

    echo ""
    echo "⏳ 等待服务就绪..."
    wait_for_service localhost 5432 "PostgreSQL"
    wait_for_service localhost 6379 "Redis"
    wait_for_service localhost 9000 "MinIO"

    echo ""
    echo -e "${GREEN}✅ 基础设施已启动：${NC}"
    echo "   PostgreSQL: localhost:5432 (lifeprint / lifeprint_secret)"
    echo "   Redis:      localhost:6379"
    echo "   MinIO:      localhost:9000 (minioadmin / minioadmin123)"
    echo "   MinIO 控制台: http://localhost:9001"
    echo ""
    echo "现在可以启动前后端："
    echo -e "   ${GREEN}./start.sh backend${NC}    # 启动后端"
    echo -e "   ${GREEN}./start.sh frontend${NC}   # 启动前端"
}

# ========== 仅启动后端 ==========
start_backend() {
    echo -e "🚀 ${BLUE}启动后端服务${NC}"
    echo ""

    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}❌ 未检测到 Python3${NC}"
        exit 1
    fi

    ensure_backend_venv

    cd "$PROJECT_DIR/backend"
    source venv/bin/activate

    echo ""
    echo "🚀 启动 uvicorn（热重载）..."
    echo -e "   API 文档：${CYAN}http://localhost:8000/docs${NC}"
    echo -e "   按 ${YELLOW}Ctrl+C${NC} 停止"
    echo ""
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
}

# ========== 仅启动前端 ==========
start_frontend() {
    echo -e "🚀 ${BLUE}启动前端服务${NC}"
    echo ""

    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ 未检测到 Node.js${NC}"
        exit 1
    fi

    ensure_frontend_deps

    cd "$PROJECT_DIR/frontend"
    echo ""
    echo "🚀 启动 Vite 开发服务器..."
    echo -e "   访问地址：${CYAN}http://localhost:5173${NC}"
    echo -e "   按 ${YELLOW}Ctrl+C${NC} 停止"
    echo ""
    npm run dev -- --host 0.0.0.0 --port 5173
}

# ========== 停止服务 ==========
stop_services() {
    echo "🛑 正在停止所有服务..."
    echo ""

    # 停止本地进程
    local stopped_local=0
    for service in backend frontend celery-worker minio; do
        local pidfile="$PROJECT_DIR/data/${service}.pid"
        if [ -f "$pidfile" ]; then
            local pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
                echo -e "   ${GREEN}✅ 已停止 $service (PID: $pid)${NC}"
                stopped_local=1
            fi
            rm -f "$pidfile"
        fi
    done

    if [ $stopped_local -eq 0 ]; then
        echo "   未发现本地运行的服务进程"
    fi

    # 停止 Docker 服务
    if command -v docker &> /dev/null; then
        detect_compose 2>/dev/null
        if [ -n "$COMPOSE_CMD" ]; then
            echo ""
            echo "🐳 停止 Docker 服务..."
            $COMPOSE_CMD down 2>/dev/null || true
            echo -e "${GREEN}✅ Docker 服务已停止${NC}"
        fi
    fi

    echo ""
    echo -e "${GREEN}✅ 所有服务已停止${NC}"
}

# ========== 清除数据 ==========
clean_all() {
    detect_compose
    echo -e "${RED}⚠️  即将停止所有服务并清除 Docker 数据卷！${NC}"
    read -p "确认继续？(y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        stop_services
        $COMPOSE_CMD down -v 2>/dev/null || true
        echo -e "${GREEN}✅ Docker 数据卷已清除${NC}"
        echo -e "💡 本地 data/ 目录未删除，如需彻底清除请执行: ${YELLOW}rm -rf ./data${NC}"
    else
        echo "已取消"
    fi
}

# ========== 查看状态 ==========
show_status() {
    echo "📊 服务运行状态："
    echo ""

    # 本地进程状态
    echo "── 本地进程 ──"
    for service in backend frontend celery-worker minio; do
        local pidfile="$PROJECT_DIR/data/${service}.pid"
        if [ -f "$pidfile" ]; then
            local pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "   ${GREEN}●${NC} $service (PID: $pid)"
            else
                echo -e "   ${RED}●${NC} $service (已退出，PID 文件残留)"
                rm -f "$pidfile"
            fi
        else
            echo -e "   ${YELLOW}○${NC} $service (未通过脚本启动)"
        fi
    done

    # Docker 状态
    if command -v docker &> /dev/null; then
        detect_compose 2>/dev/null
        if [ -n "$COMPOSE_CMD" ]; then
            echo ""
            echo "── Docker 容器 ──"
            $COMPOSE_CMD ps 2>/dev/null || echo "   无 Docker 服务运行"
        fi
    fi

    # 端口检查
    echo ""
    echo "── 端口检查 ──"
    for port_info in "5432:PostgreSQL" "6379:Redis" "9000:MinIO" "8000:Backend" "5173:Frontend(dev)" "3000:Frontend(docker)" "80:Nginx"; do
        local port="${port_info%%:*}"
        local name="${port_info##*:}"
        if lsof -i :"$port" &>/dev/null; then
            echo -e "   ${GREEN}●${NC} :$port $name"
        else
            echo -e "   ${RED}○${NC} :$port $name"
        fi
    done
}

# ========== 查看日志 ==========
show_logs() {
    if command -v docker &> /dev/null; then
        detect_compose 2>/dev/null
        if [ -n "$COMPOSE_CMD" ]; then
            $COMPOSE_CMD logs -f --tail=100
            return
        fi
    fi
    echo "Docker 未运行，查看本地日志："
    echo "   tail -f data/backend.log"
    echo "   tail -f data/frontend.log"
    echo "   tail -f data/celery-worker.log"
}

# ========== 主逻辑 ==========
case "$MODE" in
    docker)
        start_docker
        ;;
    local)
        start_local
        ;;
    dev)
        start_dev
        ;;
    infra)
        start_infra
        ;;
    backend)
        start_backend
        ;;
    frontend)
        start_frontend
        ;;
    stop)
        stop_services
        ;;
    clean)
        clean_all
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ 未知模式: $MODE${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
