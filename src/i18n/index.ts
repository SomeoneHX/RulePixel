import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zhCN from './locales/zh-CN'

export type Locale = 'zh-CN' | 'en'

const STORAGE_KEY = 'rulepixel-locale'

function getInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'zh-CN' || stored === 'en') return stored
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages: { en, 'zh-CN': zhCN },
})

export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
}
