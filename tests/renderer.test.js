import { describe, it, expect } from 'vitest'
import { renderTemplate } from '../src/engine/renderer.js'

const ctx = {
  state: { imagePrefix: '', scName: 'mysc', namespace: 'huawei-csi' },
  fields: {
    'backend.name': 'backend-demo',
    'backend.url': 'https://192.168.1.10:8088',
    'backend.pools': ['Pool001', 'Pool002'],
    'backend.protocol': 'iscsi',
    'backend.portals': ['10.0.0.1', '10.0.0.2'],
    'helm.driverName': 'csi.huawei.com',
    'helm.controllerCount': 1,
    'helm.imagePullSecrets': undefined,
    'helm.logLevel': 'info',
    'sc.qos': '{"MAXBANDWIDTH":999}',
    'sc.allowVolumeExpansion': false,
  },
  family: { storage: 'oceanstor-san', volumeType: 'lun' },
}

describe('renderTemplate', () => {
  it('内嵌占位符：保持外层引号', () => {
    const out = renderTemplate('huaweiCSIService: "{{state.imagePrefix}}huawei-csi:4.12.0"', ctx)
    expect(out).toBe('huaweiCSIService: "huawei-csi:4.12.0"')
  })

  it('整值占位符（带引号）：按 YAML 安全引号重写', () => {
    expect(renderTemplate('name: "{{backend.name}}"', ctx)).toBe('name: backend-demo')
    expect(renderTemplate('- "{{backend.url}}"', ctx)).toBe('- "https://192.168.1.10:8088"')
  })

  it('数字/布尔整值：原样输出', () => {
    expect(renderTemplate('controllerCount: {{helm.controllerCount}}', ctx)).toBe('controllerCount: 1')
    expect(renderTemplate('allowVolumeExpansion: {{sc.allowVolumeExpansion}}', ctx)).toBe(
      'allowVolumeExpansion: false',
    )
  })

  it('含双引号的字符串自动用单引号风格（qos JSON）', () => {
    expect(renderTemplate('qos: {{sc.qos}}', ctx)).toBe("qos: '{\"MAXBANDWIDTH\":999}'")
  })

  it('超长数字串（ESN）按字符串加引号保留精度', () => {
    const ctx2 = {
      ...ctx,
      fields: { ...ctx.fields, 'backend.storageDeviceSN': '21000000000000000000' },
    }
    expect(renderTemplate('storageDeviceSN: {{backend.storageDeviceSN}}', ctx2)).toBe(
      'storageDeviceSN: "21000000000000000000"',
    )
  })

  it('{{#each}} 渲染列表', () => {
    const tmpl = 'pools:\n{{#each backend.pools}}\n  - "{{this}}"\n{{/each}}\n'
    expect(renderTemplate(tmpl, ctx)).toBe('pools:\n  - Pool001\n  - Pool002\n')
  })

  it('{{#if}} 条件为假时整块消失', () => {
    const tmpl = 'a: 1\n{{#if helm.imagePullSecrets}}\nimagePullSecrets:\n{{/if}}\nb: 2\n'
    expect(renderTemplate(tmpl, ctx)).toBe('a: 1\nb: 2\n')
  })

  it('嵌套 {{#if}} + {{#each}}（backend 结构）', () => {
    const tmpl = [
      'parameters:',
      '  protocol: "{{backend.protocol}}"',
      '  {{#if backend.portals}}',
      '  portals:',
      '  {{#each backend.portals}}',
      '    - "{{this}}"',
      '  {{/each}}',
      '  {{/if}}',
      '',
    ].join('\n')
    const out = renderTemplate(tmpl, ctx)
    expect(out).toBe(
      ['parameters:', '  protocol: iscsi', '  portals:', '    - 10.0.0.1', '    - 10.0.0.2', ''].join('\n'),
    )
  })

  it('{{#each}} 空列表整体不输出', () => {
    const tmpl = 'a: 1\n{{#each missing}}\n  - x\n{{/each}}\nb: 2\n'
    expect(renderTemplate(tmpl, ctx)).toBe('a: 1\nb: 2\n')
  })

  it('缺少闭合标记抛错', () => {
    expect(() => renderTemplate('{{#if x}}\na: 1\n', ctx)).toThrow(/缺少闭合标记/)
  })

  it('键值对行（scsi 字典列表）', () => {
    const tmpl = 'portals:\n{{#each backend.scsiHosts}}\n  - "{{this.key}}": "{{this.value}}"\n{{/each}}\n'
    const ctx2 = {
      ...ctx,
      fields: {
        ...ctx.fields,
        'backend.scsiHosts': [
          { key: 'hostname01', value: '192.168.125.21' },
          { key: 'hostname02', value: '192.168.125.22' },
        ],
      },
    }
    expect(renderTemplate(tmpl, ctx2)).toBe(
      'portals:\n  - "hostname01": "192.168.125.21"\n  - "hostname02": "192.168.125.22"\n',
    )
  })
})
