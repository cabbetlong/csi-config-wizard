// 代码钩子注册表（Q6=B：数据为主 + 少量代码钩子）。
// 配置中 hook: <id> 引用；配置加载时校验所有引用均存在，否则视为配置错误。
// 钩子返回 null 表示通过，返回字符串表示错误消息的 i18n key。

export const hooks = {
  'validate-json': (value) => {
    if (value == null || value === '') return null
    try {
      JSON.parse(value)
      return null
    } catch {
      return 'err.invalidJson'
    }
  },
}

export function checkHooks(fieldDefs) {
  const missing = []
  for (const f of fieldDefs || []) {
    if (f.hook && !hooks[f.hook]) missing.push(`${f.id} → ${f.hook}`)
  }
  return missing
}

export function runHook(id, value) {
  const fn = hooks[id]
  if (!fn) return 'err.unknownHook'
  return fn(value)
}
