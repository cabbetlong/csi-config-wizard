// 构建 css-docs 文档嵌入版：中/英两套单文件页面，输出到 Hugo content 对应路径。
//
// 输出结构（可直接拷入 css-docs 仓库）：
//   dist/zh-cn/docs/quick-start/wizard/index.html
//     └── config/                      # 该语言页面的运行时配置
//   dist/en/docs/quick-start/wizard/index.html
//     └── config/
//   dist/index.html                    # 便于本地/Docker 打开的根入口（重定向到中文版）
//
// 语言由 Hugo 的 URL（/zh-cn/…、/en/…）区分：本脚本用 VITE_WIZARD_LANG 分别
// 构建一次，页面内不再提供语言切换。
import { build } from 'vite'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 先生成内嵌配置快照（src/config/embedded.mjs），file:// 打开也能兜底。
const embed = spawnSync(process.execPath, [path.join(root, 'scripts/embed-config.mjs')], {
  stdio: 'inherit',
})
if (embed.status !== 0) {
  console.error('[build-docs] embed-config 失败，终止构建')
  process.exit(embed.status || 1)
}

// 清空上次产物，避免残留
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true })

const locales = [
  {
    dir: 'zh-cn',
    lang: 'zh',
    title: '华为 CSI 配置向导',
    desc: '华为 CSI 配置向导：引导生成 helm-values / 存储后端 / StorageClass / PVC 配置',
  },
  {
    dir: 'en',
    lang: 'en',
    title: 'Huawei CSI Config Wizard',
    desc: 'Huawei CSI Config Wizard: guided generation of helm-values / Storage Backend / StorageClass / PVC configs',
  },
]

for (const loc of locales) {
  process.env.VITE_WIZARD_LANG = loc.lang
  process.env.VITE_WIZARD_TITLE = loc.title
  process.env.VITE_WIZARD_DESC = loc.desc

  const outDir = path.join('dist', loc.dir, 'docs', 'quick-start', 'wizard')
  console.log(`\n[build-docs] 构建 ${loc.lang} → ${outDir}`)
  await build({
    root,
    configFile: path.join(root, 'vite.config.js'),
    build: {
      outDir,
      emptyOutDir: true,
      assetsInlineLimit: 100000000,
    },
  })
}

// 根入口：重定向到中文版，并附上英文链接（本地/Docker 打开仍可用）
const landing = `<!DOCTYPE html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="refresh" content="0; url=./zh-cn/docs/quick-start/wizard/" />
    <title>华为 CSI 配置向导 / Huawei CSI Config Wizard</title>
  </head>
  <body style="margin:0;font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;display:grid;place-items:center;min-height:100vh;background:#f7f8fa;color:#1f2937">
    <p style="margin:0 0 12px;font-size:15px">正在进入中文版…</p>
    <p style="margin:0;font-size:13px;color:#5f6b7a">
      <a href="./en/docs/quick-start/wizard/">Huawei CSI Config Wizard (English)</a>
    </p>
  </body>
</html>
`
fs.writeFileSync(path.join(root, 'dist', 'index.html'), landing)
console.log('\n[build-docs] 完成。产物：')
for (const loc of locales) {
  console.log(`  dist/${loc.dir}/docs/quick-start/wizard/index.html`)
}
console.log('  dist/index.html（根入口，重定向到中文版）')
