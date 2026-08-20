// 语言/文案随构建注入：build-docs 会以中文、英文各构建一次；
// 本机 dev / 单文件构建缺省中文，避免 %VITE_*% 占位符为空。
const WIZARD_LANG = process.env.VITE_WIZARD_LANG || 'zh'
if (process.env.VITE_WIZARD_LANG === undefined) process.env.VITE_WIZARD_LANG = WIZARD_LANG
if (process.env.VITE_WIZARD_TITLE === undefined) {
  process.env.VITE_WIZARD_TITLE =
    WIZARD_LANG === 'en' ? 'Huawei CSI Config Wizard' : '华为 CSI 配置向导'
}
if (process.env.VITE_WIZARD_DESC === undefined) {
  process.env.VITE_WIZARD_DESC =
    WIZARD_LANG === 'en'
      ? 'Huawei CSI Config Wizard: guided generation of helm-values / Storage Backend / StorageClass / PVC configs'
      : '华为 CSI 配置向导：引导生成 helm-values / 存储后端 / StorageClass / PVC 配置'
}

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// base: './' —— 产出纯静态目录，可挂到任意子路径（随 css-docs 文档站部署）
// viteSingleFile —— 构建时把 JS/CSS 全部内联进 index.html（单文件）：
//   file:// 直接双击打开 dist/index.html 也能运行（外部 module 脚本在 file:// 下会被
//   浏览器 CORS 拦截，内联则不受影响）；public/config/ 仍会复制到 dist/ 供运行时编辑。
export default defineConfig({
  base: './',
  plugins: [vue(), viteSingleFile()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
})
