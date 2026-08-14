// 条件 DSL 求值。
//
// 支持两种写法（表单字段规则与模板 {{#if}} 共用）：
//   {field: "backend.protocol", in: [iscsi, fc]}      ← 简写：op 键直接出现
//   {field: "backend.protocol", op: "in", value: [...]}
//   {state: "platform", eq: "cce"}                     ← 引用跨步骤全局状态
//   {all: [...]} / {any: [...]} / {not: {...}}          ← 复合
//   "backend.portals"                                   ← 字符串简写：字段真值检查
//
// ctx 结构：
//   { state: {...派生值}, fields: { 'backend.protocol': v, ... }, family: {...}, this: {...} }
import { getPath, isTruthy } from './paths.js'

const OPS = ['eq', 'neq', 'in', 'not-in', 'exists', 'empty']

function normalizeCondition(cond) {
  if (!cond || typeof cond !== 'object' || Array.isArray(cond)) return cond
  for (const op of OPS) {
    if (op in cond) {
      return { ...cond, op, value: cond[op] }
    }
  }
  return cond
}

function resolvePath(expr, ctx) {
  if (expr === 'this') return ctx.this
  if (expr.startsWith('this.')) return getPath(ctx.this, expr.slice(5))
  if (expr === 'index') return ctx.index
  if (expr.startsWith('state.')) return getPath(ctx.state, expr.slice(6))
  if (expr.startsWith('family.')) return getPath(ctx.family, expr.slice(7))
  if (expr.startsWith('fields.')) return ctx.fields?.[expr.slice(7)]
  return ctx.fields?.[expr]
}

export function evalCondition(cond, ctx) {
  cond = normalizeCondition(cond)
  if (cond == null) return true
  if (typeof cond === 'boolean') return cond
  if (typeof cond === 'string') return isTruthy(resolvePath(cond, ctx))
  if (Array.isArray(cond)) return cond.every((c) => evalCondition(c, ctx))
  if (cond.all) return cond.all.every((c) => evalCondition(c, ctx))
  if (cond.any) return cond.any.some((c) => evalCondition(c, ctx))
  if (cond.not) return !evalCondition(cond.not, ctx)

  const actual =
    cond.field !== undefined
      ? ctx.fields?.[cond.field]
      : cond.state !== undefined
        ? getPath(ctx.state, cond.state)
        : undefined
  const expected = cond.value

  switch (cond.op ?? 'eq') {
    case 'eq':
      return actual === expected
    case 'neq':
      return actual !== expected
    case 'in':
      return Array.isArray(expected) && expected.includes(actual)
    case 'not-in':
      return Array.isArray(expected) && !expected.includes(actual)
    case 'exists':
      return actual !== undefined && actual !== null && actual !== ''
    case 'empty':
      return actual === undefined || actual === null || actual === '' || (Array.isArray(actual) && actual.length === 0)
    default:
      return true
  }
}
