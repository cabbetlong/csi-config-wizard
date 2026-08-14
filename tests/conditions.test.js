import { describe, it, expect } from 'vitest'
import { evalCondition } from '../src/engine/conditions.js'

const ctx = {
  state: {
    platform: 'cce',
    serviceType: 'block',
    familyId: 'flash',
    protocol: 'iscsi',
    backends: ['b1'],
  },
  fields: {
    'backend.protocol': 'iscsi',
    'backend.portals': ['10.0.0.1'],
    'backend.scsiHosts': [],
    'sc.fsType': 'ext4',
  },
}

describe('evalCondition', () => {
  it('eq / neq', () => {
    expect(evalCondition({ field: 'backend.protocol', eq: 'iscsi' }, ctx)).toBe(true)
    expect(evalCondition({ field: 'backend.protocol', eq: 'fc' }, ctx)).toBe(false)
    expect(evalCondition({ state: 'platform', neq: 'cce' }, ctx)).toBe(false)
    expect(evalCondition({ state: 'platform', neq: 'k8s' }, ctx)).toBe(true)
  })

  it('in / not-in', () => {
    expect(evalCondition({ field: 'backend.protocol', in: ['fc', 'iscsi'] }, ctx)).toBe(true)
    expect(evalCondition({ field: 'backend.protocol', in: ['fc', 'nfs'] }, ctx)).toBe(false)
    expect(evalCondition({ field: 'backend.protocol', 'not-in': ['fc', 'nfs'] }, ctx)).toBe(true)
  })

  it('exists / empty', () => {
    expect(evalCondition({ field: 'backend.portals', exists: true }, ctx)).toBe(true)
    expect(evalCondition({ field: 'backend.scsiHosts', empty: true }, ctx)).toBe(true)
  })

  it('op + value 显式写法', () => {
    expect(evalCondition({ field: 'backend.protocol', op: 'in', value: ['fc', 'iscsi'] }, ctx)).toBe(true)
  })

  it('字符串简写 = 字段真值检查', () => {
    expect(evalCondition('backend.portals', ctx)).toBe(true)
    expect(evalCondition('backend.scsiHosts', ctx)).toBe(false) // 空数组为假
    expect(evalCondition('backend.not-exists', ctx)).toBe(false)
  })

  it('复合：all / any / not', () => {
    const all = { all: [{ field: 'backend.protocol', eq: 'iscsi' }, { state: 'serviceType', eq: 'block' }] }
    expect(evalCondition(all, ctx)).toBe(true)
    const any = { any: [{ field: 'backend.protocol', eq: 'fc' }, { state: 'familyId', eq: 'flash' }] }
    expect(evalCondition(any, ctx)).toBe(true)
    const not = { not: { field: 'backend.protocol', eq: 'fc' } }
    expect(evalCondition(not, ctx)).toBe(true)
  })

  it('null 条件恒真', () => {
    expect(evalCondition(null, ctx)).toBe(true)
    expect(evalCondition(undefined, ctx)).toBe(true)
  })
})
