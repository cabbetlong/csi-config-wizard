<script setup>
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import ScenarioView from './ScenarioView.vue'
import StepView from './StepView.vue'
import ResultView from './ResultView.vue'

const props = defineProps({ store: { type: Object, required: true } })
const { t } = useI18n(props.store)

// 步骤：0=场景问答，1..4=flow（安装/后端/存储类/PVC），5=结果
const steps = computed(() => [
  { id: 'scenario', navKey: 'nav.scenario', view: 'scenario' },
  ...props.store.config.flow.map((s) => ({
    id: s.id,
    navKey: 'nav.' + s.id,
    view: 'step',
    step: s,
  })),
  { id: 'result', navKey: 'nav.result', view: 'result' },
])

const current = computed(() => steps.value[props.store.state.step] ?? steps.value[0])

function go(n) {
  props.store.state.step = Math.max(0, Math.min(steps.value.length - 1, n))
}

function toggleLang() {
  props.store.state.language = props.store.state.language === 'zh' ? 'en' : 'zh'
}

function onReset() {
  const msg = props.store.state.language === 'zh' ? '清空当前所有配置并重新开始？' : 'Clear all configuration and start over?'
  if (typeof confirm === 'undefined' || confirm(msg)) props.store.reset()
}
</script>

<template>
  <div class="shell">
    <header class="navbar">
      <div class="navbar-inner">
        <div class="brand">
          <span class="logo">▣</span>
          <div>
            <h1>{{ t('app.title') }}</h1>
            <p class="navbar-sub">{{ t('app.subtitle') }}</p>
          </div>
        </div>
        <div class="navbar-right">
          <span class="badge badge-dark">CSI {{ store.config.meta.version }}</span>
          <button class="btn navbar-btn" @click="onReset" :title="t('nav.reset')">↺ {{ t('nav.reset') }}</button>
          <button class="btn navbar-btn" @click="toggleLang">{{ t('lang.switch') }}</button>
        </div>
      </div>
    </header>

    <nav class="stepper">
      <button
        v-for="(s, i) in steps"
        :key="s.id"
        class="step"
        :class="{ active: i === store.state.step, done: i < store.state.step }"
        @click="go(i)"
      >
        <span class="step-idx">{{ i < store.state.step ? '✓' : i + 1 }}</span>
        <span>{{ t(s.navKey) }}</span>
      </button>
    </nav>

    <main class="content">
      <ScenarioView v-if="current.view === 'scenario'" :store="store" @next="go(1)" />
      <StepView v-else-if="current.view === 'step'" :store="store" :step="current.step" />
      <ResultView v-else :store="store" />
    </main>

    <footer class="foot muted">
      {{ t('app.title') }} · 适配华为 CSI {{ store.config.meta.version }} ·
      配置数据位于 public/config/（加配置不改代码）
    </footer>
  </div>
</template>
