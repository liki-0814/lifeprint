FROM node:18-alpine AS builder

WORKDIR /app

# 安装依赖（利用 Docker 缓存层）
COPY package.json package-lock.json* ./
RUN npm install

# 构建
COPY . .
RUN npm run build

# 生产镜像
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
