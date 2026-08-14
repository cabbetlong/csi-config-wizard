// 行级模板引擎。
//
// 占位符：      {{fieldId}} / {{state.x}} / {{family.x}} / {{this}} / {{this.key}} / {{index}}
// 条件块：      {{#if <expr>}} ... {{/if}}        expr = 字段路径（真值检查）或内联 JSON 条件对象
// 循环块：      {{#each <listPath>}} ... {{/each}}  空列表整体不输出
//
// 规则：
//   - 标记行（{{#if}}/{{#each}}/{{/if}}/{{/each}}）整体消失，内容行缩进原样保留（透明标记）。
//   - 整值占位符行（值部分只有 {{x}} 或 "{{x}}"）→ 用 quoteScalar 重写（自动选引号风格）。
//   - 其余含占位符的行 → 在外层引号内做转义替换。
import { getPath } from './paths.js'
import { quoteScalar, escapeInline } from './quote.js'
import { evalCondition } from './conditions.js'

const TOKEN = /\{\{([\w.]+)\}\}/g
const WHOLE_VALUE_LINE =
  /^\s*(?:-\s*|[\w.]+\s*:\s*)?(?:"\{\{[\w.]+\}\}"|\{\{[\w.]+\}\})\s*$/

function resolveToken(token, ctx) {
  if (token === 'this') return ctx.this
  if (token.startsWith('this.')) return getPath(ctx.this, token.slice(5))
  if (token === 'index') return ctx.index
  if (token.startsWith('state.')) return getPath(ctx.state, token.slice(6))
  if (token.startsWith('family.')) return getPath(ctx.family, token.slice(7))
  return ctx.fields?.[token]
}

function renderLine(line, ctx) {
  if (!TOKEN.test(line)) return line
  TOKEN.lastIndex = 0
  if (WHOLE_VALUE_LINE.test(line)) {
    return line.replace(/(?:"\{\{[\w.]+\}\}"|\{\{[\w.]+\}\})/g, (m) => {
      const token = m.replace(/[{}"]/g, '')
      return quoteScalar(resolveToken(token, ctx))
    })
  }
  return line.replace(TOKEN, (_m, token) => escapeInline(resolveToken(token, ctx)))
}

function findBlock(lines, start, kind) {
  const content = []
  let depth = 0
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*\{\{#(if|each)\b/.test(line)) depth++
    else if (/^\s*\{\{\/(if|each)\}\}\s*$/.test(line)) {
      if (depth === 0) return { content, next: i + 1 }
      depth--
    }
    content.push(line)
  }
  throw new Error(`模板缺少闭合标记: {{/${kind}}}`)
}

export function renderLines(lines, ctx) {
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const ifm = line.match(/^\s*\{\{#if\s+(.+?)\s*\}\}\s*$/)
    if (ifm) {
      const expr = ifm[1]
      const cond = parseExpr(expr)
      const { content, next } = findBlock(lines, i + 1, 'if')
      i = next
      if (evalCondition(cond, ctx)) out.push(...renderLines(content, ctx))
      continue
    }
    const eachm = line.match(/^\s*\{\{#each\s+([\w.]+)\s*\}\}\s*$/)
    if (eachm) {
      const { content, next } = findBlock(lines, i + 1, 'each')
      i = next
      const list = resolveToken(eachm[1], ctx) ?? []
      if (!Array.isArray(list)) throw new Error(`{{#each}} 目标不是数组: ${eachm[1]}`)
      for (let idx = 0; idx < list.length; idx++) {
        out.push(...renderLines(content, { ...ctx, this: list[idx], index: idx }))
      }
      continue
    }
    out.push(renderLine(line, ctx))
    i++
  }
  return out
}

function parseExpr(expr) {
  const s = expr.trim()
  if (s.startsWith('{')) {
    try {
      return JSON.parse(s)
    } catch {
      throw new Error(`模板条件不是合法 JSON: ${s}`)
    }
  }
  return s // 字段路径简写（真值检查）
}

export function renderTemplate(template, ctx) {
  return renderLines(template.split('\n'), ctx).join('\n')
}
