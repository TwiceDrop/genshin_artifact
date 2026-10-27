<template>
  <header class="m-app-header">
    <div class="m-app-heading">
      <span class="m-app-brand">莫娜占卜铺</span>
      <h1>{{ route.meta.title }}</h1>
    </div>
    <Button variant="outline" size="icon" aria-label="全部功能" @click="menuOpen = true"><MenuIcon /></Button>
  </header>
  <main class="m-app-main">
    <router-view v-slot="{ Component }">
      <template v-if="Component">
        <transition mode="out-in" name="el-fade-in-linear">
          <keep-alive><component :is="Component" :key="route.path" /></keep-alive>
        </transition>
      </template>
    </router-view>
    <MonaFooter class="m-app-footer" />
  </main>
  <nav class="m-app-nav" aria-label="手机主导航">
    <router-link v-for="item in primary" :key="item.path" :to="item.path" :aria-current="route.path === item.path ? 'page' : undefined">
      <component :is="item.icon" /><span>{{ item.label }}</span>
    </router-link>
    <button type="button" :class="{ active: menuOpen || !primary.some(i => i.path === route.path) }" @click="menuOpen = true"><MenuIcon /><span>全部功能</span></button>
  </nav>
  <Sheet v-model:open="menuOpen" :title="t('nav.nav')">
    <nav class="m-all-navigation" aria-label="全部功能">
      <template v-for="group in groups" :key="group.title">
        <h2>{{ group.title }}</h2>
        <router-link v-for="item in group.items" :key="item.path" :to="item.path" :aria-current="route.path === item.path ? 'page' : undefined" @click="menuOpen = false">
          <component :is="item.icon" />
          <span>{{ item.label }}<span v-if="item.path === '/account'" class="m-account-name">{{ account.currentAccountName.value }}</span></span>
          <span aria-hidden="true">›</span>
        </router-link>
      </template>
    </nav>
  </Sheet>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from '@/i18n/i18n'
import { useAccountStore } from '@/store/pinia/account'
import { Button, Sheet } from './ui'
import MonaFooter from '@/pages/MainPage/Footer.vue'
import MenuIcon from '~icons/ep/menu'
import CalculatorIcon from '~icons/ep/cpu'
import ArtifactIcon from '~icons/ep/help-filled'
import UserIcon from '~icons/ep/user'
import HomeIcon from '~icons/ep/home-filled'
import SetupIcon from '~icons/ep/setting'
import FolderIcon from '~icons/ep/folder'
import TerminalIcon from '~icons/fa6-solid/terminal'
import HelpIcon from '~icons/ep/question-filled'
const menuOpen = ref(false), route = useRoute(), account = useAccountStore()
const { t } = useI18n()
const primary = computed(() => [
  { path:'/calculate',label:t('nav.calculate'),icon:CalculatorIcon },
  { path:'/artifacts',label:t('nav.artifact'),icon:ArtifactIcon },
  { path:'/uid-data',label:'UID 数据',icon:UserIcon },
])
const groups = computed(() => [
  {title:t('nav.compute'),items:[{path:'/calculate',label:t('nav.calculate'),icon:CalculatorIcon},{path:'/team-optimization',label:t('nav.teamOptimize'),icon:CalculatorIcon},{path:'/playground',label:t('nav.playground'),icon:TerminalIcon}]},
  {title:t('nav.repo'),items:[{path:'/artifacts',label:t('nav.artifact'),icon:ArtifactIcon},{path:'/artifacts-kumi',label:t('nav.kumi'),icon:FolderIcon},{path:'/presets',label:t('nav.preset'),icon:FolderIcon},{path:'/uid-data',label:'UID 数据 / 手机互传',icon:UserIcon}]},
  {title:t('nav.other'),items:[{path:'/intro',label:t('nav.home'),icon:HomeIcon},{path:'/account',label:t('nav.account'),icon:UserIcon},{path:'/setup',label:t('nav.setup'),icon:SetupIcon},{path:'/help/export-tools',label:t('nav.exportTool'),icon:HelpIcon}]},
])
</script>
