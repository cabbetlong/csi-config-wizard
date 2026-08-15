<script setup>
// 结果页（Q8=A）：按部署顺序展示全部产物（下载/复制）+ 部署命令。
import { computed, ref } from 'vue'
import { useI18n } from '../composables/useI18n.js'

const props = defineProps({ store: { type: Object, required: true } })
const { t } = useI18n(props.store)

const artifacts = computed(() => props.store.artifacts())

function renderFor(a) {
  return props.store.renderArtifact(a.id, a.backendIndex)
}
function commandsFor(a) {
  return props.store.renderCommands(a.id, a.backendIndex)
}

const copied = ref('')

// 全步骤校验状态（兜底：localStorage 恢复直接落在结果页等路径）
const badSteps = computed(() =>
  props.store.validateAll().filter((s) => s.errors.length > 0),
)
function goToStep(step) {
  props.store.state.showErrors[step.id] = true
  props.store.state.step = props.store.config.flow.findIndex((s) => s.id === step.id) + 1
}
async function copy(name, text) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = name
    setTimeout(() => (copied.value = ''), 1500)
  } catch {
    /* ignore */
  }
}
function download(name, text) {
  const blob = new Blob([text], { type: 'application/yaml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// 全部下载：按部署顺序依次触发（错峰避免浏览器拦截）
function downloadAll() {
  artifacts.value.forEach((a, i) => {
    setTimeout(() => download(a.fileName, renderFor(a)), i * 350)
  })
}
</script>

<template>
  <section class="panel">
    <div class="result-head">
      <h2>{{ t('result.title') }}</h2>
      <button class="btn secondary small" @click="downloadAll">⬇ {{ t('result.downloadAll') }}</button>
    </div>
    <p class="muted">{{ t('result.hint') }}</p>

    <!-- 未通过校验的步骤警告（可点击跳转修正） -->
    <div v-if="badSteps.length" class="result-warning">
      <span>⚠ {{ t('result.unresolved') }}</span>
      <button
        v-for="s in badSteps"
        :key="s.step.id"
        class="btn ghost small"
        @click="goToStep(s.step)"
      >
        {{ s.step[`label_${store.state.language}`] }}（{{ s.errors.length }}）
      </button>
    </div>

    <!-- 执行顺序 -->
    <h3>① {{ t('result.order') }}</h3>
    <div class="order-list">
      <div v-for="(a, i) in artifacts" :key="a.id + i" class="order-item">
        <span class="order-idx">{{ i + 1 }}</span>
        <div class="order-body">
          <div class="order-title">
            <strong>{{ a[`label_${store.state.language}`] }}</strong>
            <code>{{ a.fileName }}</code>
            <span v-if="a.multi" class="badge">oceanctl</span>
            <span v-else-if="a.id === 'storageclass'" class="badge">kubectl</span>
            <span v-else-if="a.id === 'pvc'" class="badge">kubectl</span>
            <span v-else class="badge">helm</span>
          </div>
          <details class="yaml-collapse">
            <summary>YAML</summary>
            <div class="yaml-wrap">
              <button class="btn ghost small yaml-copy" @click="copy(a.fileName, renderFor(a))">
                {{ copied === a.fileName ? t('copied') : t('copy') }}
              </button>
              <pre class="yaml">{{ renderFor(a) }}</pre>
            </div>
          </details>
          <div class="row">
            <button class="btn secondary small" @click="download(a.fileName, renderFor(a))">{{ t('download') }}</button>
          </div>
          <div v-if="commandsFor(a).length" class="commands">
            <div v-for="(c, ci) in commandsFor(a)" :key="ci" class="cmd-block">
              <p class="muted">{{ c[`text_${store.state.language}`] ?? c.text_zh ?? c.text_en }}</p>
              <pre class="code">{{ c.code }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
