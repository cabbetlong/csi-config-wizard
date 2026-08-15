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

function setScenario(key, value) {
  props.store.setScenario(key, value)
}
function setPlatform(value) {
  props.store.setPlatform(value)
}
</script>

<template>
  <section class="panel">
    <h2>{{ t('scenario.title') }}</h2>
    <p class="muted">{{ t('scenario.hint') }}</p>

    <div class="form-grid">
      <label class="field">
        <span class="field-label">{{ t('nav.scenario') }} · 1 — {{ fieldLabel('scenario.familyId') }}</span>
        <select
          :value="store.state.scenario.familyId"
          @change="setScenario('familyId', $event.target.value)"
        >
          <option v-for="f in families" :key="f.id" :value="f.id">
            {{ f[`label_${store.state.language}`] }}
          </option>
        </select>
        <span class="help">{{ t('scenario.help.family') }}</span>
      </label>

      <label class="field">
        <span class="field-label">2 — {{ fieldLabel('scenario.serviceType') }}</span>
        <select
          :value="store.state.scenario.serviceType"
          @change="setScenario('serviceType', $event.target.value)"
        >
          <option v-for="s in serviceTypes" :key="s.id" :value="s.id">
            {{ s[`label_${store.state.language}`] }}
          </option>
        </select>
        <span class="help">{{ t('scenario.help.serviceType') }}</span>
      </label>

      <label class="field">
        <span class="field-label">3 — {{ fieldLabel('scenario.protocol') }}</span>
        <select
          :value="store.state.scenario.protocol"
          @change="setScenario('protocol', $event.target.value)"
        >
          <option v-for="p in protocols" :key="p" :value="p">
            {{ t('protocol.' + p) }}
          </option>
        </select>
        <span class="help">{{ t('scenario.help.protocol') }}</span>
      </label>

      <label class="field">
        <span class="field-label">4 — {{ fieldLabel('scenario.platform') }}</span>
        <select :value="store.state.scenario.platform" @change="setPlatform($event.target.value)">
          <option v-for="p in platforms" :key="p.id" :value="p.id">
            {{ p[`label_${store.state.language}`] }}
          </option>
        </select>
        <span class="help">{{ t('scenario.help.platform') }}</span>
      </label>
    </div>

    <div class="summary-line muted">
      <template v-if="currentFamily && currentService">
        {{ currentFamily[`label_${store.state.language}`] }} ·
        {{ currentService[`label_${store.state.language}`] }} ·
        {{ t('protocol.' + store.state.scenario.protocol) }}
      </template>
    </div>

    <div class="actions">
      <button class="btn primary" @click="emit('next')">{{ t('scenario.start') }}</button>
    </div>
  </section>
</template>
