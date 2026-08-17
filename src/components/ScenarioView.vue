<script setup>
// 场景问答（Q17=B / Q18=A）：产品系列 → 业务类型 → 协议 → 容器平台。
// 选项与预设全部来自配置数据（families.yaml / helm.yaml）。
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'

const props = defineProps({ store: { type: Object, required: true } })
const emit = defineEmits(['next'])
const { t } = useI18n(props.store)

const families = computed(() => props.store.config.families)
const serviceTypes = computed(() => props.store.serviceOptions())
const protocols = computed(() => props.store.protocolOptions())
const platforms = computed(() => props.store.config.helm.platforms)

const currentFamily = computed(() => props.store.currentFamily())
const currentService = computed(() => props.store.currentService())

function fieldLabel(id) {
  const f = props.store.config.fields.find((x) => x.id === id)
  if (!f) return id
  const l = props.store.state.language
  return f[`label_${l}`] ?? f[`label_${l === 'zh' ? 'en' : 'zh'}`] ?? id
}

function labelOf(obj) {
  if (!obj) return ''
  const l = props.store.state.language
  return obj[`label_${l}`] ?? obj[`label_${l === 'zh' ? 'en' : 'zh'}`] ?? ''
}

function setScenario(key, value) {
  props.store.setScenario(key, value)
}
function setPlatform(value) {
  props.store.setPlatform(value)
}

const currentPlatform = computed(() =>
  platforms.value.find((p) => p.id === props.store.state.scenario.platform),
)
</script>

<template>
  <section class="panel">
    <h2>{{ t('scenario.title') }}</h2>
    <p class="muted scenario-hint">{{ t('scenario.hint') }}</p>

    <div class="scenario-grid">
      <label class="field q">
        <span class="q-num">01</span>
        <span class="field-label">{{ fieldLabel('scenario.familyId') }}</span>
        <select
          :value="store.state.scenario.familyId"
          @change="setScenario('familyId', $event.target.value)"
        >
          <option v-for="f in families" :key="f.id" :value="f.id">{{ labelOf(f) }}</option>
        </select>
        <span class="help">{{ t('scenario.help.family') }}</span>
      </label>

      <label class="field q">
        <span class="q-num">02</span>
        <span class="field-label">{{ fieldLabel('scenario.serviceType') }}</span>
        <select
          :value="store.state.scenario.serviceType"
          @change="setScenario('serviceType', $event.target.value)"
        >
          <option v-for="s in serviceTypes" :key="s.id" :value="s.id">{{ labelOf(s) }}</option>
        </select>
        <span class="help">{{ t('scenario.help.serviceType') }}</span>
      </label>

      <label class="field q">
        <span class="q-num">03</span>
        <span class="field-label">{{ fieldLabel('scenario.protocol') }}</span>
        <select
          :value="store.state.scenario.protocol"
          @change="setScenario('protocol', $event.target.value)"
        >
          <option v-for="p in protocols" :key="p" :value="p">{{ t('protocol.' + p) }}</option>
        </select>
        <span class="help">{{ t('scenario.help.protocol') }}</span>
      </label>

      <label class="field q">
        <span class="q-num">04</span>
        <span class="field-label">{{ fieldLabel('scenario.platform') }}</span>
        <select :value="store.state.scenario.platform" @change="setPlatform($event.target.value)">
          <option v-for="p in platforms" :key="p.id" :value="p.id">{{ labelOf(p) }}</option>
        </select>
        <span class="help">{{ t('scenario.help.platform') }}</span>
      </label>
    </div>

    <div class="token-bar">
      <span class="token-label">{{ t('scenario.summary') }}</span>
      <span v-if="currentFamily" class="token">{{ labelOf(currentFamily) }}</span>
      <span v-if="currentService" class="token">{{ labelOf(currentService) }}</span>
      <span v-if="store.state.scenario.protocol" class="token">
        {{ t('protocol.' + store.state.scenario.protocol) }}
      </span>
      <span v-if="currentPlatform" class="token">{{ labelOf(currentPlatform) }}</span>
    </div>

    <div class="actions">
      <button class="btn primary btn-lg" @click="emit('next')">
        {{ t('scenario.start') }} <span class="arrow">→</span>
      </button>
    </div>
  </section>
</template>
