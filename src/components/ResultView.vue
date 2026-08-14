<script setup>
// 结果页（Q8=A）：按部署顺序展示全部产物（下载/复制）+ 部署命令 + 一致性检查 + 自检清单。
import { computed, ref } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { evalCondition } from '../engine/conditions.js'
import { runCrossChecks } from '../engine/validator.js'

const props = defineProps({ store: { type: Object, required: true } })
const { t } = useI18n(props.store)

const artifacts = computed(() => props.store.artifacts())

function renderFor(a) {
  return props.store.renderArtifact(a.id, a.backendIndex)
}
function commandsFor(a) {
  return props.store.renderCommands(a.id, a.backendIndex)
}

const crossChecks = computed(() => runCrossChecks(props.store.buildCtx()))

// 自检清单：按产物过滤 + when 条件判定适用性（backend 项对任一后端适用即显示）
const pitfalls = computed(() => {
  const out = []
  for (const p of props.store.config.pitfalls) {
    let applicable = false
    const step = props.store.config.flow.find((s) => s.artifact === p.artifact)
    if (!step) continue
    if (p.when) {
      if (step.multi) {
        applicable = props.store.state.backends.some((_, i) =>
          evalCondition(p.when, props.store.buildCtx(i)),
        )
      } else {
        applicable = evalCondition(p.when, props.store.buildCtx())
      }
    } else {
      applicable = true
    }
    if (applicable) {
      out.push({
        ...p,
        text: p[`text_${props.store.state.language}`] ?? p[`text_${props.store.state.language === 'zh' ? 'en' : 'zh'}`],
        stepLabel: step[`label_${props.store.state.language}`],
      })
    }
  }
  return out
})

const copied = ref('')
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
</script>

<template>
  <section class="panel">
    <h2>{{ t('result.title') }}</h2>
    <p class="muted">{{ t('result.hint') }}</p>

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
          <pre class="yaml">{{ renderFor(a) }}</pre>
          <div class="row">
            <button class="btn ghost small" @click="copy(a.fileName, renderFor(a))">
              {{ copied === a.fileName ? t('copied') : t('copy') }}
            </button>
            <button class="btn ghost small" @click="download(a.fileName, renderFor(a))">{{ t('download') }}</button>
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

    <!-- 一致性检查 -->
    <h3>② {{ t('result.cross') }}</h3>
    <ul class="check-list">
      <li v-for="c in crossChecks" :key="c.id" :class="c.pass ? 'ok' : 'bad'">
        <span class="mark">{{ c.pass ? '✔' : '✘' }}</span>
        <div>
          <div>{{ c[`text_${store.state.language}`] ?? c.text_zh ?? c.text_en }}</div>
          <div v-if="c.detail_zh" class="muted small">{{ c.detail_zh }}</div>
        </div>
      </li>
    </ul>

    <!-- 自检清单 -->
    <h3>③ {{ t('result.checks') }}</h3>
    <ul class="check-list">
      <li v-for="p in pitfalls" :key="p.id">
        <span class="mark">☐</span>
        <div>
          <div>{{ p.text }}</div>
          <div class="muted small">{{ p.stepLabel }}</div>
        </div>
      </li>
      <li v-if="pitfalls.length === 0" class="muted">—</li>
    </ul>
  </section>
</template>
