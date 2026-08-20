<script setup>
import { ref, onMounted } from 'vue'
import { loadConfig } from './engine/configLoader.js'
import { createStore } from './store.js'
import { useI18n } from './composables/useI18n.js'
import AppShell from './components/AppShell.vue'

const loading = ref(true)
const configError = ref(null)
const store = ref(null)
const t = (key, vars) => key // placeholder，AppShell 内使用真实 t

onMounted(async () => {
  try {
    const base = import.meta.env.BASE_URL || './'
    const config = await loadConfig(base)
    const language = import.meta.env.VITE_WIZARD_LANG || 'zh'
    store.value = createStore(config, { language })
  } catch (e) {
    configError.value = e?.message || String(e)
  }
  loading.value = false
})
</script>

<template>
  <div v-if="loading" class="center-page muted">
    <span class="loading-dot" aria-hidden="true"></span>{{ t('loading') }}
  </div>
  <div v-else-if="configError" class="center-page">
    <p class="config-error" role="alert">⚠️ {{ t('configError.title') }}</p>
    <p class="mono small">{{ configError }}</p>
    <p class="muted small">{{ t('configError.hint') }}</p>
  </div>
  <AppShell v-else :store="store" />
</template>
