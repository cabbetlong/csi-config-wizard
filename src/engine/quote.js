// YAML 标量安全引号。
// CSI 场景下绝大多数值都是字符串（含端口号、URL、容量等），
// 规则：数字/布尔原样输出；危险字符（冒号、花括号、引号等）自动加引号；
// 字符串 "true"/"false" 等会被加引号以保证仍是字符串语义。
export function quoteScalar(value) {
  if (value === null || value === undefined) return '""'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  const s = String(value)
  if (s === '') return '""'
  if (s.includes('\n')) {
    const body = s
      .split('\n')
      .map((l) => '  ' + l)
      .join('\n')
    return '|\n' + body
  }
  if (
    /[:{}\[\],#&*!|>'"%@`\t]|^\s|\s$|^[-?:]$|^[~]$|^(true|false|null|yes|no|on|off)$/i.test(s)
  ) {
    if (s.includes('"')) {
      return "'" + s.replace(/'/g, "''") + "'"
    }
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
  }
  return s
}

// 用于已带外层引号的内嵌占位符（如 "{{repo}}/huawei-csi:4.12.0"）：
// 只转义值内会破坏外层引号的字符。
export function escapeInline(value) {
  const s = String(value ?? '')
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}
