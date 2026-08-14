<script setup>
// 通用产物步骤：左侧字段表单（basic 平铺 + advanced 折叠），右侧实时 YAML 预览 + 校验。
// backend 步骤支持多个后端（卡片切换）。
import { computed, ref } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { evalCondition } from '../engine/conditions.js'
import { validateAllFields } from '../engine/validator.js'
import FieldInput from './FieldInput.vue'

const props = defineProps({
  store: { type: Object, required: true },
  step: { type: Object, required: true },
})
const { t, fieldLabel } = useI18n(props.store)

const stepIndex = computed(() =>
  props.store.config.flow.findIndex((s) => s.id === props.step.id),
)

// 该产物（artifact）的字段，按 level 分组
const artifact = computed(() => props.step.artifact)
const basicFields = computed(() =>
  props.store.config.fields.filter(
    (f) =>
      f.id.startsWith(artifact.value + '.') &&
      f.level !== 'advanced' &&
      f.type !== 'select-family' &&
      f.type !== 'select-service' &&
      f.type !== 'select-protocol' &&
      f.type !== 'select-platform',
  ),
)
const advancedFields = computed(() =>
  props.store.config.fields.filter(
    (f) =>
      f.id.startsWith(artifact.value + '.') &&
      f.level === 'advanced' &&
      f.type !== 'select-family' &&
      f.type !== 'select-service' &&
      f.type !== 'select-protocol' &&
      f.type !== 'select-platform',
  ),
)

const errors = computed(() => {
  const ctx = props.store.buildCtx()
  const raw = validateAllFields(props.store.config, ctx)
  const map = {}
  // 只展示当前产物（artifact）的错误
  for (const e of raw) {
    if (e.fieldId.startsWith(artifact.value + '.')) map[e.fieldId] = t(e.key, e.vars)
  }
  return map
})

const hasErrors = computed(() => Object.keys(errors.value).length > 0)

// 当前生效的字段（visible_when 为真；backend 步骤以当前活动后端为上下文）。
// 注意：模板里 ref/computed 会自动解包，这里用 computed 持有过滤结果，避免把
// computed 当数组传给函数（list.value 会变 undefined）。
function filterVisible(fields) {
  const ctx = props.store.buildCtx()
  return fields.filter((f) => !f.visible_when || evalCondition(f.visible_when, ctx))
}
const visibleBasicFields = computed(() => filterVisible(basicFields.value))
const visibleAdvancedFields = computed(() => filterVisible(advancedFields.value))

// 后端多卡片
const isMulti = computed(() => !!props.step.multi)
function addBackend() {
  props.store.addBackend()
}
function removeBackend(i) {
  if (props.store.state.backends.length <= 1) return
  props.store.removeBackend(i)
}

const previewText = computed(() => {
  if (isMulti.value) {
    const b = props.store.state.backends[props.store.state.activeBackend]
    if (!b) return ''
    return props.store.renderArtifact(props.step.id, props.store.state.activeBackend)
  }
  return props.store.renderArtifact(props.step.id)
})

function download() {
  const name =
    isMulti.value && props.store.state.backends[props.store.state.activeBackend]
      ? `backend-${(props.store.state.backends[props.store.state.activeBackend].name || 'unnamed').toLowerCase()}.yaml`
      : props.step.file
  const blob = new Blob([previewText.value], { type: 'application/yaml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(previewText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* ignore */
  }
}

function next() {
  props.store.state.step = Math.min(props.store.config.flow.length + 1, stepIndex.value + 2)
}
function prev() {
  props.store.state.step = Math.max(0, stepIndex.value)
}
</script>

<template>
  <section class="panel split">
    <div class="form-col">
      <h2>{{ fieldLabel(step) }}</h2>

      <!-- 多后端：卡片切换 -->
      <div v-if="isMulti" class="cards">
        <button
          v-for="(b, i) in store.state.backends"
          :key="i"
          class="chip"
          :class="{ active: i === store.state.activeBackend }"
          @click="store.state.activeBackend = i"
        >
          {{ t('backend.card', { n: i + 1 }) }}: {{ b.name || '…' }}
        </button>
        <button class="chip add" @click="addBackend">+ {{ t('backend.add') }}</button>
      </div>
      <button v-if="isMulti && store.state.backends.length > 1" class="btn ghost small" @click="removeBackend(store.state.activeBackend)">
        {{ t('backend.remove') }} {{ t('backend.card', { n: store.state.activeBackend + 1 }) }}
      </button>

      <div class="fields">
        <FieldInput
          v-for="f in visibleBasicFields"
          :key="f.id"
          :store="store"
          :field="f"
          :value="store.getField(f.id)"
          :error="errors[f.id] || ''"
          @update="(v) => store.setField(f.id, v)"
        />
      </div>

      <details v-if="advancedFields.length" class="advanced">
        <summary>{{ t('advanced.toggle') }}</summary>
        <div class="fields">
          <FieldInput
            v-for="f in visibleAdvancedFields"
            :key="f.id"
            :store="store"
            :field="f"
            :value="store.getField(f.id)"
            :error="errors[f.id] || ''"
            @update="(v) => store.setField(f.id, v)"
          />
        </div>
      </details>

      <div v-if="hasErrors" class="err-summary">⚠ {{ t('err.summary', { n: Object.keys(errors).length }) }}</div>

      <div class="actions">
        <button class="btn secondary" @click="prev">{{ t('step.back') }}</button>
        <button class="btn primary" @click="next">{{ t('step.next') }}</button>
      </div>
    </div>

    <div class="preview-col">
      <div class="preview-head">
        <span>{{ t('preview.title') }}</span>
        <span class="spacer"></span>
        <button class="btn ghost small" @click="copy">{{ copied ? t('copied') : t('copy') }}</button>
        <button class="btn secondary small" @click="download">{{ t('download') }}</button>
      </div>
      <pre class="yaml">{{ previewText }}</pre>
    </div>
  </section>
</template>
