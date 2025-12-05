# --- Stage 1: 构建前端 ---
FROM oven/bun:1 AS client-builder
WORKDIR /app/client

# 1. 拷贝依赖定义 (仓库使用 bun.lock)
COPY client/package.json client/bun.lock ./
RUN bun ci

# 2. 构建
COPY client/ ./
RUN bun run build

# --- Stage 2: 运行后端 ---
FROM oven/bun:1
WORKDIR /app

# 3. 后端依赖
COPY package.json bun.lock ./
# Bun 默认就是生产模式安装，不需要 --omit=dev 这种复杂参数
RUN bun ci --production

# 4. 代码与产物
COPY server.js ./
COPY --from=client-builder /app/client/dist ./client/dist

ENV NODE_ENV=production
EXPOSE 3000

# 5. 启动
CMD ["bun", "server.js"]