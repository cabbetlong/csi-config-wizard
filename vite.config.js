import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// base: './' —— 产出纯静态目录，可挂到任意子路径（随 css-docs 文档站部署）
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
})
