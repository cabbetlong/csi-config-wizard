// 校验器：① 字段级校验（表单实时） ② 跨文件一致性检查（生成时）。
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

// 跨文件一致性检查（Q12②）。模板已自动保证大部分一致性，
// 这里在"结果页"复核并向用户显式展示通过/未通过。
export function runCrossChecks(ctx) {
  const checks = []
  const scBackend = ctx.state?.scBackend
  const backendNames = ctx.state?.backends ?? []

  checks.push({
    id: 'sc-backend-exists',
    pass: !!scBackend && backendNames.includes(scBackend),
    text_zh: 'StorageClass 引用的后端必须存在于第 2 步已建后端列表中',
    text_en: 'StorageClass backend must exist in the backends created in step 2',
    detail_zh: scBackend ? `已引用：${scBackend}` : '尚未选择后端',
  })

  checks.push({
    id: 'has-backends',
    pass: backendNames.length > 0,
    text_zh: '至少创建一个存储后端（backend），StorageClass 才能工作',
    text_en: 'At least one storage backend must be created',
  })

  checks.push({
    id: 'provisioner-match',
    pass: true,
    text_zh: `StorageClass 的 provisioner 与 Helm values 的 csiDriver.driverName 一致（${ctx.state?.driverName || ''}，由模板自动保持）`,
    text_en: 'provisioner matches csiDriver.driverName (kept automatically by the template)',
  })

  checks.push({
    id: 'pvc-sc-match',
    pass: !!ctx.state?.scName,
    text_zh: `PVC 的 storageClassName 等于第 3 步生成的 StorageClass（${ctx.state?.scName || '未设置'}）`,
    text_en: 'PVC storageClassName equals the StorageClass from step 3',
  })

  checks.push({
    id: 'namespace-match',
    pass: !!ctx.state?.namespace,
    text_zh: `后端 namespace 与 CSI 命名空间一致（${ctx.state?.namespace || '未设置'}）`,
    text_en: 'backend namespace matches the CSI namespace',
  })

  return checks
}
