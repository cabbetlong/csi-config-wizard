<script setup>
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import ScenarioView from './ScenarioView.vue'
import StepView from './StepView.vue'
import ResultView from './ResultView.vue'

const props = defineProps({ store: { type: Object, required: true } })
const { t } = useI18n(props.store)

// 步骤：0=场景问答，1..4=flow（安装/后端/存储类/PVC），5=结果
// 每个产物节点标注其应用工具（部署流水线：helm → oceanctl → kubectl）
const TOOL = { helm: 'helm', backend: 'oceanctl', sc: 'kubectl', pvc: 'kubectl' }

const steps = computed(() => [
  { id: 'scenario', navKey: 'nav.scenario', view: 'scenario' },
  ...props.store.config.flow.map((s) => ({
    id: s.id,
    navKey: 'nav.' + s.id,
    view: 'step',
    step: s,
    tool: TOOL[s.artifact] ?? '',
  })),
  { id: 'result', navKey: 'nav.result', view: 'result' },
])

const current = computed(() => steps.value[props.store.state.step] ?? steps.value[0])
const stepsLabel = computed(() => (props.store.state.language === 'zh' ? '步骤' : 'Steps'))

// 已展开错误的步骤 → 步骤条红角标计数（与"错误延迟显示"同规则）
const badgeCounts = computed(() => {
  const out = {}
  const s = props.store.state
  if (!Object.keys(s.showErrors).length) return out
  for (const item of props.store.validateAll()) {
    if (item.errors.length && s.showErrors[item.step.id]) {
      out[item.step.id] = item.errors.length
    }
  }
  return out
})

function go(n) {
  const last = steps.value.length - 1
  // 进入结果页守卫：任何步骤有未通过校验的字段 → 跳到第一个出错步骤并展开错误
  if (n === last) {
    const bad = props.store.firstErrorStep()
    if (bad) {
      props.store.state.showErrors[bad.step.id] = true
      props.store.state.step = bad.flowIdx + 1
      props.store.notify(
        t('result.redirectNotice', {
          step: bad.step[`label_${props.store.state.language}`] ?? bad.step.id,
          n: bad.count,
        }),
      )
      return
    }
  }
  props.store.state.step = Math.max(0, Math.min(last, n))
}

function onReset() {
  const msg = props.store.state.language === 'zh' ? '清空当前所有配置并重新开始？' : 'Clear all configuration and start over?'
  if (typeof confirm === 'undefined' || confirm(msg)) props.store.reset()
}
</script>

<template>
  <div class="shell">
    <header class="doc-header">
      <div class="doc-header-text">
        <h1>{{ t('app.title') }}</h1>
        <p class="muted doc-subtitle">{{ t('app.subtitle') }}</p>
      </div>
      <button class="btn ghost small reset-btn" @click="onReset" :title="t('nav.reset')">↺ {{ t('nav.reset') }}</button>
    </header>

    <nav class="stepper" :aria-label="stepsLabel">
      <button
        v-for="(s, i) in steps"
        :key="s.id"
        class="step"
        :class="{ active: i === store.state.step, done: i < store.state.step }"
        @click="go(i)"
      >
        <span class="step-idx">{{ i < store.state.step ? '✓' : i + 1 }}</span>
        <span class="step-name">{{ t(s.navKey) }}</span>
        <span v-if="s.tool" class="step-tool">{{ s.tool }}</span>
        <span v-if="badgeCounts[s.id]" class="step-badge">{{ badgeCounts[s.id] }}</span>
      </button>
    </nav>

    <main class="content">
      <transition name="toast">
        <div v-if="store.state.notice" :key="store.state.notice.ts" class="toast" role="status" aria-live="polite">
          ⚠ {{ store.state.notice.text }}
        </div>
      </transition>
      <transition name="stepfade" mode="out-in">
        <ScenarioView v-if="current.view === 'scenario'" :key="'scenario'" :store="store" @next="go(1)" />
        <StepView v-else-if="current.view === 'step'" :key="current.id" :store="store" :step="current.step" />
        <ResultView v-else :key="'result'" :store="store" />
      </transition>
    </main>
  </div>
</template>
