# 容器化部署指南（Docker）

向导构建为**纯静态目录**（`dist/index.html` 单文件 + `dist/config/`），任何静态服务器都能服务；容器化用 Nginx 提供一致的部署方式，并支持「改配置不重建镜像」。

## 镜像内容

| 路径 | 内容 |
|------|------|
| `/usr/share/nginx/html/` | 构建产物（单文件 `index.html` + `config/`） |
| `/wizard-config/` | 默认配置备份（`public/config/` 的镜像内副本） |
| `/etc/nginx/conf.d/default.conf` | 站点配置（见下） |

构建是**多阶段**的：`node:20-alpine` 里 `npm ci && npm run build:single`（`prebuild:single` 会自动同步内嵌快照 `src/config/embedded.mjs`），产物交给 `nginx:1.27-alpine` 只做静态服务，镜像里没有 Node、没有源码。Docker 使用单语言单文件构建（`dist/index.html` + `dist/config/`），文档站的双语文档嵌入版用仓库根的 `npm run build`。

## 1. 构建镜像

```bash
docker build -t csi-config-wizard:latest .
```

推荐加版本 tag 再发布：

```bash
docker build -t csi-config-wizard:4.12.0-1 .
docker tag csi-config-wizard:4.12.0-1 registry.example.com/csi-config-wizard:4.12.0-1
docker push registry.example.com/csi-config-wizard:4.12.0-1
```

## 2. 启动

```bash
docker compose up -d --build        # 一键构建+启动 → http://localhost:8080
```

或不用 compose、直接跑：

```bash
docker run -d --name csi-config-wizard -p 8080:80 --restart unless-stopped csi-config-wizard:latest
```

## 3. 改配置：挂载 volume，刷新即生效（推荐）

项目核心工作方式是「配置与代码分离、改 YAML 不重建」。把 `config/` 挂到宿主机后，改 YAML → 浏览器刷新即生效，**无需重建镜像**。

取消 `docker-compose.yml` 中 volumes 段的注释，并确认本地存在配置目录（没有则先建一个空的 `./docker-config`，首次启动会自动回填镜像内默认配置）：

```bash
mkdir -p docker-config
docker compose up -d --build
# 编辑 docker-config/fields.yaml → 浏览器刷新 → 生效
```

首次启动回填由 `docker/30-seed-config.sh` 完成（nginx 官方镜像的 `/docker-entrypoint.d` 启动钩子）：检测到挂载目录缺少 `index.yaml` 时，从 `/wizard-config` 拷贝默认配置。目录里已有配置则原样保留。

> 提示：多节点/多副本部署时，所有副本应指向**同一份配置文件存储**（共享卷或挂配置仓库），避免副本间配置漂移。

## 4. Nginx 站点配置要点（docker/nginx.conf）

- **`/config/` 禁用强缓存**（`no-cache, no-store, must-revalidate`）：保证运行时 fetch 的配置改动刷新即生效
- **首页不缓存**：镜像重建/更新后刷新立即可见
- **`try_files` SPA 回退**：目录请求兜底到 `index.html`
- **gzip**：单文件 index.html 内联 JS 较大，gzip 后显著缩小传输体积
- **`server_tokens off`**：不暴露 Nginx 版本号

## 5. 健康检查与运维

- 镜像内置 `HEALTHCHECK`：每 30s 探测 `http://127.0.0.1/`，失败重试 3 次即标记 unhealthy（编排平台据此重启/摘流量）
- 日志：`docker compose logs -f wizard`
- 升级：重建镜像（新配置/新代码）+ 重启容器，旧配置卷中的数据会保留

## 6. 与直接静态部署的取舍

| 场景 | 方式 |
|------|------|
| 随 css-docs 文档站等挂到任意子路径 | 直接拷贝 `dist/`（`base: './'` 支持子路径） |
| 独立站点、要健康检查/重启策略/统一镜像分发 | **容器化（本指南）** |

两种方式对「改配置」的行为一致：HTTP 下运行时加载 `config/`，改 YAML 刷新即生效。