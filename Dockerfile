# --- Stage 1: 构建前端 ---
FROM node:18-alpine as client-builder
WORKDIR /app/client
# 复制前端 package.json 并安装依赖
COPY client/package*.json ./
RUN npm install
# 复制前端源代码并构建 (生成 dist 文件夹)
COPY client/ ./
RUN npm run build

# --- Stage 2: 构建后端并运行 ---
FROM node:18-alpine
WORKDIR /app
# 复制后端 package.json 并安装生产依赖
COPY package*.json ./
RUN npm install --production

# 复制后端代码
COPY server.js ./
# 关键：把 Stage 1 构建好的前端 dist 文件夹拷过来
COPY --from=client-builder /app/client/dist ./client/dist

# 设置环境变量为生产模式
ENV NODE_ENV=production
EXPOSE 3000

# 启动
CMD ["node", "server.js"]