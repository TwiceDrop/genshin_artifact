import type { CapacitorConfig } from '@capacitor/cli'
import base from './capacitor.config.json'
const mobileTest = process.env.MONA_ANDROID_UI === 'mobiletest'
export default {
  ...base,
  appId: base.appId + (mobileTest ? '.mobiletest' : ''),
  appName: base.appName + (mobileTest ? ' · 新UI测试' : ''),
  webDir: mobileTest ? 'dist-mobile' : 'dist',
} as CapacitorConfig
