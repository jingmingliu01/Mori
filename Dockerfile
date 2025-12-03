# --- Stage 1: 构建前端 ---
# 关键修改：从 node:18 改为 node:20
FROM node:20-alpine as client-builder
WORKDIR /app/client

# 1. 安装前端依赖 (保留 devDependencies 以便运行 vite)
COPY client/package*.json ./
RUN npm ci

# 2. 拷贝源码并构建(生成 dist 文件夹)
COPY client/ ./
RUN npm run build

# --- Stage 2: 构建后端并运行 ---
# 关键修改：这里也改成 node:20 保持一致
FROM node:20-alpine
WORKDIR /app

# 3. 复制后端 package.json 并安装后端依赖 (仅生产依赖，为了极速和轻量)
# 这一步完全不受前端代码修改的影响，缓存利用率 MAX
COPY package*.json ./
RUN npm ci --omit=dev

# 4. 拷贝后端代码
COPY server.js ./

# 5. 最后才把 Stage 1 构建好的前端 dist 文件夹拷过来
COPY --from=client-builder /app/client/dist ./client/dist

# 设置环境变量为生产模式
ENV NODE_ENV=production
EXPOSE 3000

# 启动
CMD ["node", "server.js"]