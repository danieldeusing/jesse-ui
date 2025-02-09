<template>
  <div class="mb-4">
    <div class="hidden sm:block">
      <nav
        class="relative rounded-lg shadow flex divide-x divide-gray-200 dark:divide-gray-700"
        aria-label="Tabs">
        <div
          v-for="tab in tabs" :key="tab.id"
          class="relative group min-w-0 flex-1 overflow-hidden text-center flex items-center"
          @click.middle="emit('close', tab.id)">
          <NuxtLink
            :to="`/backtest/${tab.id}`"
            :class="[tab.id === pageId ? 'text-gray-900 dark:text-gray-100 font-bold ' : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 font-medium ', 'py-3 px-4 inline-block select-none cursor-pointer focus:outline-none w-full text-xs bg-gray-50 dark:bg-backdrop-dark']">
            <span>
              {{ getTitle(tab) }}
            </span>
            <span
              aria-hidden="true"
              :class="[tab.id === pageId && (Object.keys(tabs).length > 1) ? 'bg-indigo-400' : 'bg-transparent dark:bg-gray-600', 'absolute inset-x-0 bottom-0 h-0.5']" />
          </NuxtLink>

          <!-- Tab close button -->
          <button
            v-show="Object.keys(tabs).length > 1" class="absolute right-[1em] focus:outline-none"
            @click="emit('close', tab.id)">
            <XMarkIcon
              class="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 bg-gray-100 dark:bg-gray-700 rounded-full"
              aria-hidden="true" />
          </button>
        </div>

        <!-- New Tab Button -->
        <div
          class="select-none cursor-pointer text-gray-400 dark:text-gray-100 hover:text-gray-600 focus:outline-none group relative w-14 overflow-hidden bg-gray-50 dark:bg-backdrop-dark py-3 px-4 font-medium hover:bg-white dark:hover:bg-gray-800 flex items-center justify-center "
          @click="useBacktestStore().addTab(currentTab)">
          <button class="absolute right-[1em] focus:outline-none ">
            <PlusIcon class="h-6 w-6 rounded-full" aria-hidden="true" />
          </button>
          <span aria-hidden="true" class="absolute inset-x-0 bottom-0 h-0.5 bg-transparent dark:bg-gray-600" />
        </div>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { PlusIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { useBacktestStore } from '~/stores/backtestStore'

const route = useRoute()
const pageId = ref(route.params.id as string)

const emit = defineEmits(['close'])

defineProps<{
  tabs: BacktestTabs
  currentTab: string | null
}>()

function getTitle(tab: BacktestTab) {
  if (!tab.form.routes.length) {
    return `New Tab`
  }

  // if error, show error
  if (tab.results.exception.error && tab.results.executing) {
    return 'Error'
  }

  const firstRoute = tab.form.routes[0]
  let k = ''
  if (firstRoute.strategy) {
    k += `${firstRoute.strategy} • `
  }
  if (firstRoute.symbol) {
    k += `${firstRoute.symbol} • `
  }
  if (firstRoute.timeframe) {
    k += `${firstRoute.timeframe}`
  }
  // Remove trailing ' • ' if exists
  k = k.endsWith(' • ') ? k.slice(0, -3) : k

  if (tab.results.executing) {
    return `${k} | ${tab.results.progressbar.current}%`
  }
  if (tab.results.showResults) {
    return `${k} | Results`
  }
  return k
}
</script>
