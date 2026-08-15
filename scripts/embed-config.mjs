// 构建时生成 src/config/embedded.mjs（配置内嵌快照）。
// 用途：file:// 直接打开 dist/index.html，或静态服务器缺失 config/ 目录时，
//       运行时 fetch 无法加载配置 → 回退到这份构建时快照。
// 注意：HTTP 部署下运行时仍优先 fetch（可免构建修改配置），快照只是兜底。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/config')
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/config/embedded.mjs')

const DATA_FILES = [
  'index.yaml',
  'fields.yaml',
  'families.yaml',
  'helm.yaml',
  'i18n/zh.yaml',
  'i18n/en.yaml',
]

const TPL_MAP = {
  'templates/helm-values.yaml': 'helm',
  'templates/backend.yaml': 'backend',
  'templates/storageclass.yaml': 'storageclass',
  'templates/pvc.yaml': 'pvc',
  'templates/commands/helm.yaml': 'commands/helm',
  'templates/commands/backend.yaml': 'commands/backend',
  'templates/commands/storageclass.yaml': 'commands/storageclass',
  'templates/commands/pvc.yaml': 'commands/pvc',
}

// 反引号模板字符串转义：反引号、反斜杠、${}
function jsString(s) {
  return (
    '`' +
    s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') +
    '`'
  )
}

const lines = []
lines.push('// 本文件由 scripts/embed-config.mjs 自动生成（构建/测试前），请勿手改。')
lines.push('// 来源：public/config/ 下的配置与模板（运行时 fetch 失败的兜底快照）。')
lines.push('export const embeddedConfig = {')
lines.push('  raw: {')
for (const f of DATA_FILES) {
  const content = fs.readFileSync(path.join(ROOT, f), 'utf8')
  lines.push(`    ${JSON.stringify(f)}: ${jsString(content)},`)
}
lines.push('  },')
lines.push('  templates: {')
for (const [file, key] of Object.entries(TPL_MAP)) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8')
  lines.push(`    ${JSON.stringify(key)}: ${jsString(content)},`)
}
lines.push('  },')
lines.push('}')

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, lines.join('\n') + '\n')
console.log(`[embed-config] ${lines.length} 行配置快照 → ${OUT}`)
