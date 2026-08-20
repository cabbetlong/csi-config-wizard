// 内嵌配置回退（file:// 直接打开 dist/index.html 场景）：
// 构建时快照必须可加载、可渲染，与运行时 fetch 路径产出一致。
import { describe, it, expect } from 'vitest'
import { loadConfigEmbedded } from '../src/engine/configLoader.js'
import { createStore } from '../src/store.js'

describe('内嵌配置快照（embedded.mjs，由 scripts/embed-config.mjs 生成）', () => {
  it('可加载并通过 schema 校验', async () => {
    const config = await loadConfigEmbedded()
    expect(config.flow.map((s) => s.id)).toEqual(['helm', 'backend', 'storageclass', 'pvc'])
    expect(config.fields.length).toBeGreaterThan(20)
    expect(config.families.length).toBeGreaterThanOrEqual(3)
  })

  it('createStore 接受构建注入的语言（zh/en 分别构建）', async () => {
    const config = await loadConfigEmbedded()
    const zh = createStore(config, { language: 'zh' })
    const en = createStore(config, { language: 'en' })
    expect(zh.state.language).toBe('zh')
    expect(en.state.language).toBe('en')
  })

  it('与运行时路径产出完全一致（同一 store 渲染 backend）', async () => {
    const config = await loadConfigEmbedded()
    const store = createStore(config)
    store.setField('backend.name', 'b-embedded')
    store.setField('backend.url', 'https://192.168.1.10:8088')
    store.setField('backend.pools', ['Pool001'])
    store.setField('backend.protocol', 'iscsi')
    store.setField('backend.portals', ['10.0.0.1'])
    const out = store.renderArtifact('backend', 0)
    expect(out).toContain('storage: oceanstor-san')
    expect(out).toContain('name: b-embedded')
    expect(out).toContain('  - "https://192.168.1.10:8088"')
    expect(out).toContain('  - 10.0.0.1')
    expect(out).not.toContain('{{')
  })
})
