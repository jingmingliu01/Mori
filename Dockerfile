# # --- Stage 1: Build frontend ---
# FROM oven/bun:1 AS client-builder
# WORKDIR /app/client

# # 1. Copy dependency definitions (repo uses bun.lock)
# COPY client/package.json client/bun.lock ./
# RUN bun ci

# # 2. Build
# COPY client/ ./
# RUN bun run build

# --- Stage 2: Run backend ---
FROM oven/bun:1
WORKDIR /app/server

# 3. Backend dependencies
COPY server/package.json server/bun.lock ./
# Bun installs production by default; no need for extra --omit=dev flags
RUN bun ci --production

# 4. Code and assets
COPY server/server.js ./
COPY server/models/ ./models/
# COPY --from=client-builder /app/client/dist ./client/dist

ENV NODE_ENV=production
EXPOSE 3000

# 5. Launch
CMD ["bun", "server.js"]
