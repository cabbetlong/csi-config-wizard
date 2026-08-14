// 运行时配置加载：fetch YAML → js-yaml 解析 → JSON Schema 校验 → 钩子/模板引用完整性检查。
// 所有配置错误在此层被拦截并以可读信息抛出（页面显示"配置错误"而不是白屏）。

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

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new ConfigError(`无法加载 ${url}（HTTP ${res.status}）`)
  return res.text()
}

export async function loadConfig(baseUrl = './') {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
  const raw = {}
  for (const file of CONFIG_FILES) {
    const text = await fetchText(`${base}config/${file}`)
    raw[file] = parseYaml(file, text)
  }
  const templates = {}
  for (const step of raw['index.yaml'].flow || []) {
    templates[step.id] = await fetchText(`${base}config/${step.template}`)
    if (step.commands) templates['commands/' + step.id] = await fetchText(`${base}config/${step.commands}`)
  }
  return buildConfig(raw, templates)
}

function parseYaml(file, text) {
  try {
    return yaml.load(text)
  } catch (e) {
    throw new ConfigError(`配置 ${file} 不是合法的 YAML：${e.message}`)
  }
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
