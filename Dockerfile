# syntax=docker/dockerfile:1

# ============================================================
# 华为 CSI 配置向导（csi-config-wizard）Docker 镜像
# 多阶段构建：Node 构建产物 → Nginx 静态服务
#
# 构建：docker build -t csi-config-wizard:latest .
# 完整说明见 docs/DEPLOY-DOCKER.md
# ============================================================

# ---------- 阶段 1：构建 ----------
FROM node:20-alpine AS build
WORKDIR /app

# 先拷贝依赖清单，利用 Docker 层缓存（依赖不变则跳过 npm ci）
COPY package.json package-lock.json ./
RUN npm ci

# 再拷贝源码与配置（public/config 会同时打进内嵌快照与 dist/config/）
COPY . .
RUN npm run build:single

# ---------- 阶段 2：运行 ----------
FROM nginx:1.27-alpine
LABEL org.opencontainers.image.title="csi-config-wizard" \
      org.opencontainers.image.description="Huawei CSI config wizard - 华为 CSI 配置向导" \
      org.opencontainers.image.source="https://github.com/cabbetlong/csi-config-wizard"

# 构建产物：单文件 index.html + config/ 目录（运行时 fetch 加载）
COPY --from=build /app/dist /usr/share/nginx/html

# 默认配置备份：首次启动时回填到挂载的 config 卷（支持不改镜像、直接改 YAML）
COPY --from=build /app/public/config /wizard-config

# Nginx 站点配置：SPA 回退 + config/ 禁强缓存（改配置刷新即生效）
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# 启动钩子（nginx 官方镜像约定）：config 卷为空时回填默认配置
COPY docker/30-seed-config.sh /docker-entrypoint.d/30-seed-config.sh
RUN chmod +x /docker-entrypoint.d/30-seed-config.sh

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1