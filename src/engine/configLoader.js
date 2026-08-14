// 运行时配置加载：fetch YAML → js-yaml 解析 → JSON Schema 校验 → 钩子/模板引用完整性检查。
//
// 加载策略（支持 file:// 直接打开 dist/index.html）：
//   1. file: 协议 → 直接用构建时内嵌快照（src/config/embedded.mjs）
//   2. HTTP 部署 → 优先运行时 fetch（改配置无需重新构建）
//   3. fetch 失败（如静态服务器没带 config/ 目录）→ 回退内嵌快照 + 控制台警告
// 配置本身的 schema/引用错误不回退（那是真实配置问题，必须暴露给用户）。

import yaml from 'js-yaml'
import { buildSchemas, ConfigError } from './schemas.js'
import { checkHooks } from '../hooks/index.js'

const CONFIG_FILES = [
  'index.yaml',
  'fields.yaml',
  'families.yaml',
  'helm.yaml',
  'pitfalls.yaml',
  'i18n/zh.yaml',
  'i18n/en.yaml',
]

// 加载类错误（fetch/404/YAML 解析）→ 可回退到内嵌快照
class LoadError extends ConfigError {}

async function fetchText(url) {
  let res
  try {
    res = await fetch(url)
  } catch {
    throw new LoadError(`无法加载 ${url}（网络或 file:// 协议不支持 fetch）`)
  }
  if (!res.ok) throw new LoadError(`无法加载 ${url}（HTTP ${res.status}）`)
  return res.text()
}

function parseYaml(file, text) {
  try {
    return yaml.load(text)
  } catch (e) {
    throw new LoadError(`配置 ${file} 不是合法的 YAML：${e.message}`)
  }
}

export async function loadConfig(baseUrl = './') {
  const isFileProtocol =
    typeof location !== 'undefined' && location.protocol === 'file:'
  if (isFileProtocol) return loadConfigEmbedded()

  try {
    return await loadConfigFromFetch(baseUrl)
  } catch (e) {
    if (e instanceof LoadError) {
      console.warn('[csi-wizard] 运行时配置加载失败，回退到构建时内嵌配置：', e.message)
      return loadConfigEmbedded()
    }
    throw e
  }
}

async function loadConfigFromFetch(baseUrl) {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
  const raw = {}
  for (const file of CONFIG_FILES) {
    raw[file] = parseYaml(file, await fetchText(`${base}config/${file}`))
  }
  const templates = {}
  for (const step of raw['index.yaml'].flow || []) {
    templates[step.id] = await fetchText(`${base}config/${step.template}`)
    if (step.commands) templates['commands/' + step.id] = await fetchText(`${base}config/${step.commands}`)
  }
  return buildConfig(raw, templates)
}

// 构建时内嵌快照（scripts/embed-config.mjs 生成）
export async function loadConfigEmbedded() {
  const { embeddedConfig } = await import('../config/embedded.mjs')
  const raw = {}
  for (const [file, text] of Object.entries(embeddedConfig.raw)) {
    raw[file] = parseYaml(file, text)
  }
  return buildConfig(raw, embeddedConfig.templates)
}

// 纯构建（无 fetch）：浏览器由 loadConfig 调用，测试由磁盘读取后调用。
export function buildConfig(raw, templates) {
  const { validators } = buildSchemas()
  for (const file of CONFIG_FILES) validators[file](raw[file])

  const flow = raw['index.yaml'].flow
  if (templates) {
    for (const step of flow) {
      if (!templates[step.id]) throw new ConfigError(`缺少模板：${step.template}`)
    }
  }

  // 钩子引用完整性
  const missing = checkHooks(raw['fields.yaml'].fields)
  if (missing.length) {
    throw new ConfigError(`配置引用了未注册的代码钩子：${missing.join('、')}`)
  }

  // 模板占位符引用完整性（字段 id / state.* / family.* / this / index）
  const fieldIds = new Set(raw['fields.yaml'].fields.map((f) => f.id))
  if (templates) {
    for (const [id, tmpl] of Object.entries(templates)) {
      for (const token of extractTokens(tmpl)) {
        if (token === 'this' || token === 'index') continue
        if (token.startsWith('state.') || token.startsWith('family.')) continue
        if (token.startsWith('this.')) continue
        if (!fieldIds.has(token)) {
          throw new ConfigError(`模板 ${id} 引用了未定义的字段：{{${token}}}（fields.yaml 中无此字段）`)
        }
      }
    }
  }

  return {
    meta: raw['index.yaml'],
    fields: raw['fields.yaml'].fields,
    families: raw['families.yaml'].families,
    helm: raw['helm.yaml'],
    pitfalls: raw['pitfalls.yaml'].pitfalls,
    i18n: { zh: raw['i18n/zh.yaml'], en: raw['i18n/en.yaml'] },
    templates: templates ?? {},
    flow,
  }
}

export function extractTokens(template) {
  const tokens = new Set()
  const re = /\{\{([\w.]+)\}\}/g
  let m
  while ((m = re.exec(template))) tokens.add(m[1])
  return [...tokens]
}
