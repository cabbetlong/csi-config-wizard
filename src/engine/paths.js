// 通用路径取值：'a.b.c' → obj.a.b.c
export function getPath(obj, path) {
  if (obj == null) return undefined
  if (path == null || path === '') return obj
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function setPath(obj, path, value) {
  const keys = path.split('.')
  let o = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {}
    o = o[k]
  }
  o[keys[keys.length - 1]] = value
}

export function isTruthy(v) {
  if (v == null) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}
