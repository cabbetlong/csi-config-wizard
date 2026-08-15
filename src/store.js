// 全局响应式状态（Q15=A）：四份产物是状态的实时视图，
// 场景选择（家族/业务类型/协议/平台）自动带出推荐值，全部可覆盖。
import { reactive, watch } from 'vue'
import yaml from 'js-yaml'
import { renderTemplate } from './engine/renderer.js'
import { evalCondition } from './engine/conditions.js'

const STORAGE_KEY = 'huawei-csi-config-wizard:v1'

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v))
}

function artifactKey(id) {
  const dot = id.indexOf('.')
  return { artifact: id.slice(0, dot), key: id.slice(dot + 1) }
}

export function createStore(config) {
  // ---------- 初始状态 ----------
  const firstFamily = config.families[0]
  const firstServiceType = firstFamily ? Object.keys(firstFamily.serviceTypes)[0] : null
  const firstService = firstFamily?.serviceTypes?.[firstServiceType]
  const defaultPlatform =
    config.helm.defaultPlatform ?? config.helm.platforms[0]?.id ?? null

  function helmDefaults(platform) {
    const preset =
      config.helm.platforms.find((p) => p.id === platform)?.presets ?? {}
    const out = { ...preset }
    for (const f of config.fields) {
      if (!f.id.startsWith('helm.')) continue
      const key = f.id.slice(5)
      if (f.default !== undefined && out[key] === undefined) out[key] = clone(f.default)
    }
    return out
  }

  let saved = {}
  if (typeof localStorage !== 'undefined') {
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch {
      /* ignore */
    }
  }

  const state = reactive({
    language: saved.language ?? 'zh',
    scenario: {
      familyId: saved.scenario?.familyId ?? firstFamily?.id ?? null,
      serviceType: saved.scenario?.serviceType ?? firstServiceType,
      protocol: saved.scenario?.protocol ?? firstService?.defaultProtocol ?? null,
      platform: saved.scenario?.platform ?? defaultPlatform,
    },
    helm: { ...helmDefaults(defaultPlatform), ...(saved.helm ?? {}) },
    backends: Array.isArray(saved.backends) ? saved.backends : [],
    activeBackend: saved.activeBackend ?? 0,
    sc: saved.sc ?? {},
    pvc: saved.pvc ?? {},
    step: saved.step ?? 0,
    // UX：字段错误只在"触碰过"（blur/change）或点击"下一步"后显示
    touched: {},          // fieldId -> true
    showErrors: {},       // stepId -> true（点下一步时展开该步全部错误）
  })

  // 应用字段默认值（仅对当前可见的字段；visibility 由 buildCtx 判定）
  applyFieldDefaults()

  // 优化：默认预置一个后端，进入存储后端步骤即可直接配置（无需先点"添加"）
  if (!state.backends.length) addBackend()

  function applyFieldDefaults() {
    const ctx = buildCtx()
    for (const f of config.fields) {
      if (f.default === undefined) continue
      if (f.visible_when && !evalCondition(f.visible_when, ctx)) continue
      const { artifact, key } = artifactKey(f.id)
      if (artifact === 'backend') continue // 后端默认值在 addBackend 中按当时上下文应用
      if (artifact === 'scenario') {
        if (state.scenario[key] === undefined) state.scenario[key] = clone(f.default)
      } else if (state[artifact] && state[artifact][key] === undefined) {
        state[artifact][key] = clone(f.default)
      }
    }
  }

  watch(
    state,
    () => {
      if (typeof localStorage === 'undefined') return
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            language: state.language,
            scenario: state.scenario,
            helm: state.helm,
            backends: state.backends,
            activeBackend: state.activeBackend,
            sc: state.sc,
            pvc: state.pvc,
            step: state.step,
          }),
        )
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  )

  // ---------- 上下文（渲染/校验共用） ----------
  function buildCtx(backendIndex) {
    const family = config.families.find((f) => f.id === state.scenario.familyId)
    const serviceType = state.scenario.serviceType
    const service = family?.serviceTypes?.[serviceType]
    const backend =
      backendIndex != null
        ? state.backends[backendIndex]
        : state.backends[state.activeBackend] ?? {}
    const backendNames = state.backends.map((b) => b.name)
    const imagePrefix = state.helm.imageRepo
      ? String(state.helm.imageRepo).replace(/\/+$/, '') + '/'
      : ''

    const fields = {}
    for (const [k, v] of Object.entries(state.scenario)) fields['scenario.' + k] = v
    for (const [k, v] of Object.entries(state.helm)) fields['helm.' + k] = v
    for (const [k, v] of Object.entries(backend)) fields['backend.' + k] = v
    for (const [k, v] of Object.entries(state.sc)) fields['sc.' + k] = v
    for (const [k, v] of Object.entries(state.pvc)) fields['pvc.' + k] = v

    return {
      state: {
        platform: state.scenario.platform,
        serviceType,
        familyId: state.scenario.familyId,
        protocol: state.scenario.protocol,
        backends: backendNames,
        scName: state.sc.name,
        scBackend: state.sc.backend,
        driverName: state.helm.driverName,
        namespace: state.helm.namespace,
        imagePrefix,
        backendName: backend.name,
        volumeType: service?.volumeType,
        storage: service?.storage,
      },
      fields,
      family: {
        id: family?.id,
        label_zh: family?.label_zh,
        label_en: family?.label_en,
        storage: service?.storage,
        volumeType: service?.volumeType,
        protocols: service?.protocols,
        features: service?.features,
        service,
      },
    }
  }

  // ---------- 字段读写 ----------
  function getField(id) {
    return buildCtx().fields[id]
  }

  function setField(id, value) {
    const { artifact, key } = artifactKey(id)
    if (artifact === 'scenario') state.scenario[key] = value
    else if (artifact === 'helm') state.helm[key] = value
    else if (artifact === 'sc') {
      state.sc[key] = value
      // 优化：切换关联后端后，存储池属于旧后端，重置为未选（自动选择）
      if (key === 'backend') state.sc.pool = undefined
    } else if (artifact === 'pvc') state.pvc[key] = value
    else if (artifact === 'backend' && state.backends[state.activeBackend]) {
      state.backends[state.activeBackend][key] = value
    }
  }

  // ---------- 场景级联 ----------
  function referencesScenario(cond) {
    if (cond == null) return false
    if (typeof cond !== 'object') return false
    if (Array.isArray(cond)) return cond.some(referencesScenario)
    if (cond.all) return cond.all.some(referencesScenario)
    if (cond.any) return cond.any.some(referencesScenario)
    if (cond.not) return referencesScenario(cond.not)
    if ('state' in cond) {
      const k = String(cond.state)
      return ['platform', 'serviceType', 'familyId', 'protocol'].some((s) => k === s || k.startsWith(s + '.'))
    }
    return false
  }

  function resetScenarioDependents() {
    for (const f of config.fields) {
      if (!f.visible_when || !referencesScenario(f.visible_when)) continue
      const { artifact, key } = artifactKey(f.id)
      const visible = evalCondition(f.visible_when, buildCtx())
      const target = state[artifact]
      if (!target) continue
      if (!visible) target[key] = undefined
      else if (f.default !== undefined && target[key] === undefined) target[key] = clone(f.default)
    }
  }

  function setScenario(key, value) {
    state.scenario[key] = value
    if (key === 'familyId') {
      const family = config.families.find((f) => f.id === value)
      const st = family ? Object.keys(family.serviceTypes)[0] : null
      state.scenario.serviceType = st
      state.scenario.protocol = family?.serviceTypes?.[st]?.defaultProtocol ?? null
    } else if (key === 'serviceType') {
      const family = config.families.find((f) => f.id === state.scenario.familyId)
      state.scenario.protocol = family?.serviceTypes?.[value]?.defaultProtocol ?? null
    }
    // 协议由场景统一驱动（优化）：同步所有后端，并清空协议相关的条件字段
    if (key === 'protocol' || key === 'serviceType' || key === 'familyId') {
      for (const b of state.backends) {
        b.protocol = state.scenario.protocol
        b.portals = []
        b.scsiHosts = []
      }
    }
    resetScenarioDependents()
  }

  function setPlatform(id) {
    state.scenario.platform = id
    const preset = config.helm.platforms.find((p) => p.id === id)?.presets ?? {}
    for (const [k, v] of Object.entries(preset)) state.helm[k] = v
  }

  // ---------- 后端管理 ----------
  function addBackend() {
    const family = config.families.find((f) => f.id === state.scenario.familyId)
    const service = family?.serviceTypes?.[state.scenario.serviceType]
    const nb = {
      name: `backend-${state.backends.length + 1}`,
      url: '',
      pools: [],
      protocol: state.scenario.protocol ?? service?.defaultProtocol ?? null,
      portals: [],
      scsiHosts: [],
      alua: false,
      maxClientThreads: 30,
      authenticationMode: 'local',
    }
    // 应用 backend.* 字段默认值（按当前可见性）
    const ctx = buildCtx()
    for (const f of config.fields) {
      if (!f.id.startsWith('backend.') || f.default === undefined) continue
      if (f.visible_when && !evalCondition(f.visible_when, ctx)) continue
      const key = f.id.slice('backend.'.length)
      if (nb[key] === undefined) nb[key] = clone(f.default)
    }
    state.backends.push(nb)
    state.activeBackend = state.backends.length - 1
    // SC 的关联后端默认带出第一个后端名（用户可改）
    if (!state.sc.backend) state.sc.backend = nb.name
    return nb
  }

  function removeBackend(idx) {
    state.backends.splice(idx, 1)
    if (state.activeBackend >= state.backends.length) {
      state.activeBackend = Math.max(0, state.backends.length - 1)
    }
  }

  // ---------- 渲染 ----------
  function renderArtifact(stepId, backendIndex) {
    const tmpl = config.templates[stepId]
    if (!tmpl) return ''
    return renderTemplate(tmpl, buildCtx(backendIndex))
  }

  function renderCommands(stepId, backendIndex) {
    const tmpl = config.templates['commands/' + stepId]
    if (!tmpl) return []
    const ctx = buildCtx(backendIndex)
    const text = renderTemplate(tmpl, ctx)
    let data
    try {
      data = yaml.load(text)
    } catch {
      return []
    }
    const list = Array.isArray(data) ? data : data?.commands ?? []
    return list
      .filter((c) => !c.when || evalCondition(c.when, ctx))
      .map((c) => ({ ...c }))
  }

  // 结果页产物列表（backend 每后端一个文件）
  function artifacts() {
    return config.flow.flatMap((step) => {
      if (step.multi) {
        return state.backends.map((b, i) => ({
          ...step,
          backendIndex: i,
          fileName: `backend-${(b.name || 'unnamed-' + (i + 1)).toLowerCase()}.yaml`,
        }))
      }
      return [{ ...step, fileName: step.file }]
    })
  }

  // ---------- 场景选项 ----------
  // 存储类步骤：存储池选项来自所选后端（优化 3）
  function backendPools() {
    const name = state.sc.backend
    const b =
      state.backends.find((x) => x.name === name) ?? state.backends[state.activeBackend]
    return b?.pools ?? []
  }

  function serviceOptions() {
    const fam = config.families.find((f) => f.id === state.scenario.familyId)
    return fam
      ? Object.entries(fam.serviceTypes).map(([id, s]) => ({
          id,
          label_zh: s.label_zh,
          label_en: s.label_en,
        }))
      : []
  }
  function protocolOptions() {
    const fam = config.families.find((f) => f.id === state.scenario.familyId)
    return fam?.serviceTypes?.[state.scenario.serviceType]?.protocols ?? []
  }
  function currentFamily() {
    return config.families.find((f) => f.id === state.scenario.familyId)
  }
  function currentService() {
    return currentFamily()?.serviceTypes?.[state.scenario.serviceType]
  }

  // ---------- UX 辅助 ----------
  function markTouched(fieldId) {
    state.touched[fieldId] = true
  }

  function markAllVisibleTouched(fields, ctx) {
    for (const f of fields) {
      if (f.visible_when && !evalCondition(f.visible_when, ctx)) continue
      state.touched[f.id] = true
    }
  }

  // 重新开始：清空 localStorage 并刷新（预置后端等默认值会重建）
  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    if (typeof location !== 'undefined') location.reload()
  }

  return {
    state,
    config,
    buildCtx,
    getField,
    setField,
    setScenario,
    setPlatform,
    addBackend,
    removeBackend,
    backendPools,
    renderArtifact,
    renderCommands,
    artifacts,
    serviceOptions,
    protocolOptions,
    currentFamily,
    currentService,
    markTouched,
    markAllVisibleTouched,
    reset,
  }
}
