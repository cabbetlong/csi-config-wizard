// Golden 测试：真实配置数据 + 全链路渲染（配置加载 → store → 模板 → 期望 YAML）。
// 维护者加配置后跑 npm test 即可确认没有破坏输出（Q14 保障）。
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { describe, it, expect } from 'vitest'
import { buildConfig } from '../src/engine/configLoader.js'
import { createStore } from '../src/store.js'

const CONFIG_DIR = path.join(process.cwd(), 'public/config')
const DATA_FILES = [
  'index.yaml',
  'fields.yaml',
  'families.yaml',
  'helm.yaml',
  'i18n/zh.yaml',
  'i18n/en.yaml',
]
const TPL_FILES = [
  'helm-values.yaml',
  'backend.yaml',
  'storageclass.yaml',
  'pvc.yaml',
  'commands/helm.yaml',
  'commands/backend.yaml',
  'commands/storageclass.yaml',
  'commands/pvc.yaml',
]

function loadConfigFromDisk() {
  const raw = {}
  for (const f of DATA_FILES) {
    raw[f] = yaml.load(fs.readFileSync(path.join(CONFIG_DIR, f), 'utf8'))
  }
  // 模板文件名 → 流程步骤 id 映射
  const KEY = {
    'helm-values.yaml': 'helm',
    'backend.yaml': 'backend',
    'storageclass.yaml': 'storageclass',
    'pvc.yaml': 'pvc',
    'commands/helm.yaml': 'commands/helm',
    'commands/backend.yaml': 'commands/backend',
    'commands/storageclass.yaml': 'commands/storageclass',
    'commands/pvc.yaml': 'commands/pvc',
  }
  const tpl = {}
  for (const f of TPL_FILES) {
    tpl[KEY[f]] = fs.readFileSync(path.join(CONFIG_DIR, 'templates', f), 'utf8')
  }
  return buildConfig(raw, tpl)
}

function makeStore() {
  const store = createStore(loadConfigFromDisk())
  // 场景默认：flash / block / iscsi / k8s；默认后端已由 store 预置（backend[0]）
  store.setField('backend.name', 'backend-demo')
  store.setField('backend.url', 'https://192.168.1.10:8088')
  store.setField('backend.pools', ['Pool001', 'Pool002'])
  store.setField('backend.protocol', 'iscsi')
  store.setField('backend.portals', ['10.0.0.1', '10.0.0.2'])
  store.setField('sc.name', 'mysc')
  store.setField('sc.backend', 'backend-demo')
  store.setField('sc.fsType', 'xfs')
  store.setField('pvc.name', 'mypvc')
  store.setField('pvc.storage', '100Gi')
  return store
}

describe('配置完整性', () => {
  it('buildConfig 不抛错（schema + 钩子 + 模板引用）', () => {
    expect(() => loadConfigFromDisk()).not.toThrow()
  })
})

describe('Golden：闪存块服务 iSCSI + Kubernetes', () => {
  const store = makeStore()
  const r = (id, i) => store.renderArtifact(id, i)

  it('backend.yaml', () => {
    expect(r('backend', 0)).toBe(
      [
        '# 由华为 CSI 配置向导生成（后端：backend-demo · 协议 iscsi）',
        '# 创建命令：oceanctl create backend -f backend-demo.yaml -i yaml',
        'storage: oceanstor-san',
        'name: backend-demo',
        'namespace: huawei-csi',
        'urls:',
        '  - "https://192.168.1.10:8088"',
        'pools:',
        '  - Pool001',
        '  - Pool002',
        'parameters:',
        '  protocol: iscsi',
        '  portals:',
        '    - 10.0.0.1',
        '    - 10.0.0.2',
        'maxClientThreads: 30',
        'authenticationMode: local',
        '',
      ].join('\n'),
    )
  })

  it('storageclass.yaml', () => {
    expect(r('storageclass')).toBe(
      [
        '# 由华为 CSI 配置向导生成',
        'kind: StorageClass',
        'apiVersion: storage.k8s.io/v1',
        'metadata:',
        '  name: mysc',
        'provisioner: csi.huawei.com',
        'parameters:',
        '  backend: backend-demo',
        '  volumeType: lun',
        '  allocType: thin',
        '  fsType: xfs',
        '  cloneSpeed: 3',
        '  disableVerifyCapacity: "true"',
        'reclaimPolicy: Delete',
        'allowVolumeExpansion: true',
        '',
      ].join('\n'),
    )
  })

  it('pvc.yaml', () => {
    expect(r('pvc')).toBe(
      [
        '# 由华为 CSI 配置向导生成',
        'kind: PersistentVolumeClaim',
        'apiVersion: v1',
        'metadata:',
        '  name: mypvc',
        'spec:',
        '  accessModes:',
        '    - ReadWriteOnce',
        '  volumeMode: Filesystem',
        '  storageClassName: mysc',
        '  resources:',
        '    requests:',
        '      storage: 100Gi',
        '',
      ].join('\n'),
    )
  })

  it('helm-values.yaml 关键行 + 可被 YAML 解析', () => {
    const out = r('helm')
    expect(out).toContain('controllerCount: 1')
    expect(out).toContain('driverName: csi.huawei.com')
    expect(out).toContain('kubeletConfigDir: /var/lib/kubelet')
    expect(out).toContain('namespace: huawei-csi')
    expect(out).toContain('huaweiCSIService: "huawei-csi:4.12.0"')
    expect(out).toContain('level: info')
    expect(() => yaml.load(out)).not.toThrow()
  })

  it('全部产物均可被 YAML 解析（round-trip）', () => {
    for (const id of ['helm', 'backend', 'storageclass', 'pvc']) {
      const text = r(id, id === 'backend' ? 0 : undefined)
      expect(() => yaml.load(text), id).not.toThrow()
    }
  })

  it('命令：k8s 平台走 helm install', () => {
    const cmds = store.renderCommands('helm')
    expect(cmds.length).toBe(1)
    expect(cmds[0].code).toContain('helm install helm-huawei-csi ./ -n huawei-csi --create-namespace')
  })
})

describe('Golden：CCE 平台预设联动', () => {
  const store = makeStore()
  store.setPlatform('cce')

  it('helm-values 带出 CCE 预设（driverName / kubeletConfigDir）', () => {
    const out = store.renderArtifact('helm')
    expect(out).toContain('driverName: csi.oceanstor.com')
    expect(out).toContain('kubeletConfigDir: /mnt/paas/kubernetes/kubelet')
  })

  it('StorageClass 的 provisioner 跟随 driverName（跨产物一致性）', () => {
    expect(store.renderArtifact('storageclass')).toContain('provisioner: csi.oceanstor.com')
  })

  it('命令：CCE 平台走 helm package 上传，不出现 helm install', () => {
    const cmds = store.renderCommands('helm')
    expect(cmds.some((c) => c.code.includes('helm package'))).toBe(true)
    expect(cmds.some((c) => c.code.includes('helm install'))).toBe(false)
  })
})

describe('Golden：文件服务（flash / file / NFS）', () => {
  const store = makeStore()
  store.setScenario('familyId', 'flash')
  store.setScenario('serviceType', 'file')
  store.setScenario('protocol', 'nfs')
  store.addBackend()
  store.setField('backend.name', 'nas-backend')
  store.setField('backend.url', 'https://192.168.1.20:8088')
  store.setField('backend.pools', ['FS001'])
  store.setField('backend.portals', ['10.0.0.10'])
  store.setField('sc.name', 'mysc-nfs')
  store.setField('sc.backend', 'nas-backend')

  it('volumeType=fs、无 fsType、authClient 默认 *、NFS 仅一个 portal', () => {
    const sc = store.renderArtifact('storageclass')
    expect(sc).toContain('volumeType: fs')
    expect(sc).not.toContain('fsType')
    expect(sc).toContain('authClient: "*"')
    const b = store.renderArtifact('backend', 1) // 第二个后端（nfs）
    expect(b).toContain('storage: oceanstor-nas')
    expect(b).toContain('  - 10.0.0.10')
  })

  it('字段级联：切回块服务后 authClient 被清除', () => {
    store.setScenario('serviceType', 'block')
    store.setScenario('protocol', 'iscsi')
    const sc = store.renderArtifact('storageclass')
    expect(sc).toContain('volumeType: lun')
    expect(sc).not.toContain('authClient')
  })
})

describe('校验器', () => {
  it('必填/格式校验（validateAllFields）', async () => {
    const { validateAllFields } = await import('../src/engine/validator.js')
    const store = makeStore()
    store.setField('backend.url', 'not-a-url')
    store.setField('pvc.storage', '100')
    const errors = validateAllFields(store.config, store.buildCtx())
    const ids = errors.map((e) => e.fieldId)
    expect(ids).toContain('backend.url') // 格式
    expect(ids).toContain('pvc.storage') // 格式（缺单位）
  })

  it('存储地址支持 http/https（拒绝其他协议）', async () => {
    const { validateAllFields } = await import('../src/engine/validator.js')
    const s2 = makeStore()
    s2.setField('backend.url', 'http://192.168.1.10:8088')
    const errors = validateAllFields(s2.config, s2.buildCtx())
    expect(errors.map((e) => e.fieldId)).not.toContain('backend.url')
    s2.setField('backend.url', 'ftp://x')
    const errors2 = validateAllFields(s2.config, s2.buildCtx())
    expect(errors2.map((e) => e.fieldId)).toContain('backend.url')
  })

  it('存储池选项来自所选后端；切换后端后存储池重置', () => {
    const store = makeStore()
    expect(store.backendPools()).toEqual(['Pool001', 'Pool002'])
    store.setField('sc.pool', 'Pool001')
    store.addBackend()
    store.setField('backend.name', 'b2')
    store.setField('backend.pools', ['PoolA'])
    store.setField('sc.backend', 'b2')
    expect(store.backendPools()).toEqual(['PoolA'])
    expect(store.state.sc.pool).toBeUndefined() // 重置为未选
  })
})
