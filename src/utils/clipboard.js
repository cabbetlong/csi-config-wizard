// 复制到剪贴板：优先 navigator.clipboard（https 环境），
// 失败时回退 textarea + execCommand —— 产物支持 file:// 双击打开，
// 该场景下 clipboard API 不可用，回退保证"复制"始终可用。
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 落到回退 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
