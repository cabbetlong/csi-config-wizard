<script setup>
// 通用字段渲染器：按 type 渲染 text / number / select / bool / list / key-value-list / json-text。
// 选项解析（select）：静态 options 或 options_from（family.protocols / state.backends）。
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'

const props = defineProps({
  store: { type: Object, required: true },
  field: { type: Object, required: true },
  value: { type: null, required: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['update'])

const { t, fieldLabel, fieldHelp, fieldPlaceholder } = useI18n(props.store)

const options = computed(() => {
  const f = props.field
  if (f.options) return f.options.map((o) => ({ value: o, label: o }))
  if (f.options_from === 'family.protocols') {
    return props.store.protocolOptions().map((p) => ({ value: p, label: t('protocol.' + p) }))
  }
  if (f.options_from === 'state.backends') {
    return props.store.state.backends.map((b) => ({
      value: b.name,
      label: b.name || t('result.noBackends'),
    }))
  }
  if (f.options_from === 'state.backendPools') {
    return props.store.backendPools().map((p) => ({ value: p, label: p }))
  }
  return []
})

const isList = computed(() => props.field.type === 'list')
const isKV = computed(() => props.field.type === 'key-value-list')

function set(v) {
  emit('update', v)
}
function setListItem(idx, v) {
  const arr = [...(props.value ?? [])]
  arr[idx] = v
  set(arr)
}
function addListItem() {
  set([...(props.value ?? []), ''])
}
function removeListItem(idx) {
  set([...(props.value ?? [])].filter((_, i) => i !== idx))
}
function setKV(idx, k, v) {
  const arr = [...(props.value ?? [])]
  arr[idx] = { ...(arr[idx] ?? {}), [k]: v }
  set(arr)
}
function addKV() {
  set([...(props.value ?? []), { key: '', value: '' }])
}
</script>

<template>
  <div class="field" :class="{ 'has-error': error }">
    <span class="field-label">
      {{ fieldLabel(field) }}<span v-if="field.required || field.required_when" class="req">*</span>
    </span>

    <!-- text -->
    <input
      v-if="field.type === 'text'"
      type="text"
      :value="value ?? ''"
      :placeholder="fieldPlaceholder(field)"
      @input="set($event.target.value)"
    />

    <!-- number -->
    <input
      v-else-if="field.type === 'number'"
      type="number"
      :value="value ?? ''"
      @input="set($event.target.value === '' ? undefined : Number($event.target.value))"
    />

    <!-- select -->
    <select v-else-if="field.type === 'select'" :value="value ?? ''" @change="set($event.target.value)">
      <option value=""></option>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>

    <!-- bool -->
    <label v-else-if="field.type === 'bool'" class="check">
      <input type="checkbox" :checked="!!value" @change="set($event.target.checked)" />
      <span>{{ value ? 'true' : 'false' }}</span>
    </label>

    <!-- textarea / json-text -->
    <textarea
      v-else-if="field.type === 'textarea' || field.type === 'json-text'"
      rows="2"
      :value="value ?? ''"
      :placeholder="fieldPlaceholder(field)"
      @input="set($event.target.value)"
    ></textarea>

    <!-- list of strings -->
    <div v-else-if="isList" class="list-editor">
      <div v-for="(item, i) in value ?? []" :key="i" class="list-row">
        <input type="text" :value="item" @input="setListItem(i, $event.target.value)" />
        <button class="btn ghost small" @click="removeListItem(i)">✕</button>
      </div>
      <button class="btn ghost small" @click="addListItem">+ {{ t('list.add') }}</button>
    </div>

    <!-- key-value list -->
    <div v-else-if="isKV" class="list-editor">
      <div v-for="(row, i) in value ?? []" :key="i" class="list-row">
        <input type="text" :value="row.key" placeholder="hostname" @input="setKV(i, 'key', $event.target.value)" />
        <input type="text" :value="row.value" placeholder="IP" @input="setKV(i, 'value', $event.target.value)" />
        <button class="btn ghost small" @click="removeListItem(i)">✕</button>
      </div>
      <button class="btn ghost small" @click="addKV">+ {{ t('list.add') }}</button>
    </div>

    <span v-if="error" class="err">{{ error }}</span>
    <span v-if="fieldHelp(field) && !error" class="help">{{ fieldHelp(field) }}</span>
  </div>
</template>
