#!/bin/sh
# 华为 CSI 配置向导 - 首次启动回填默认配置
#
# 场景：把宿主机目录/空卷挂载到 /usr/share/nginx/html/config 时，
#       挂载目录为空 → 从镜像内备份 /wizard-config 回填默认配置；
#       之后改宿主机上的 YAML，刷新页面即生效（无需重建镜像）。
# 未挂载（用镜像内配置）或挂载目录已有 index.yaml → 本脚本不做任何事。
set -e

TARGET=/usr/share/nginx/html/config
SOURCE=/wizard-config

if [ -d "$TARGET" ] && [ ! -e "$TARGET/index.yaml" ]; then
    echo "[csi-wizard] config 目录为空，回填镜像内默认配置（/wizard-config → $TARGET）"
    cp -a "$SOURCE"/. "$TARGET"/
fi