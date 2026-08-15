// 校验器：字段级校验（表单实时 + 全步骤守卫）。
// 字段规则全部来自 fields.yaml 配置数据（Q11/Q12）。

import { evalCondition } from './conditions.js'
import { runHook } from '../hooks/index.js'

// 返回 [{ fieldId, key, vars }] —— key 为 i18n 消息 key
// 只校验传入的字段集合（结果页/全局校验用）
export function validateFields(fieldDefs, ctx) {
  const errors = []
  for (const f of fieldDefs) {
    if (f.visible_when && !evalCondition(f.visible_when, ctx)) continue
    const value = ctx.fields?.[f.id]
    const required =
      f.required || (f.required_when && evalCondition(f.required_when, ctx))

    if (required && (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0))) {
      errors.push({ fieldId: f.id, key: 'err.required', vars: {} })
      continue
    }
    if (value === undefined || value === null || value === '') continue

    if (f.validate?.pattern && !new RegExp(f.validate.pattern).test(String(value))) {
      errors.push({ fieldId: f.id, key: 'err.pattern', vars: {} })
    }
    if (f.validate?.min != null && Number(value) < f.validate.min) {
      errors.push({ fieldId: f.id, key: 'err.min', vars: { min: f.validate.min } })
    }
    if (f.validate?.max != null && Number(value) > f.validate.max) {
      errors.push({ fieldId: f.id, key: 'err.max', vars: { max: f.validate.max } })
    }
    if (f.validate?.enum && !f.validate.enum.includes(value)) {
      errors.push({ fieldId: f.id, key: 'err.enum', vars: {} })
    }
    if (f.hook) {
      const key = runHook(f.hook, value)
      if (key) errors.push({ fieldId: f.id, key, vars: {} })
    }
  }
  return errors
}

export function validateAllFields(config, ctx) {
  return validateFields(config.fields, ctx)
}

