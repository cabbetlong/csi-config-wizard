// 界面文案（Q11=A：字段 label 就近在 fields.yaml，此处为 UI 通用文案 + 错误消息）
export function useI18n(store) {
  const lang = () => store.state.language

  const t = (key, vars) => {
    const l = lang()
    const fallback = l === 'zh' ? 'en' : 'zh'
    let s = store.config.i18n[l]?.[key] ?? store.config.i18n[fallback]?.[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replaceAll(`{${k}}`, String(v))
      }
    }
    return s
  }

  const fieldLabel = (f) => f[`label_${lang()}`] ?? f[`label_${lang() === 'zh' ? 'en' : 'zh'}`] ?? f.id
  const fieldHelp = (f) => f[`help_${lang()}`] ?? f[`help_${lang() === 'zh' ? 'en' : 'zh'}`] ?? ''
  const fieldPlaceholder = (f) =>
    f[`placeholder_${lang()}`] ?? f[`placeholder_${lang() === 'zh' ? 'en' : 'zh'}`] ?? ''

  return { t, fieldLabel, fieldHelp, fieldPlaceholder }
}
