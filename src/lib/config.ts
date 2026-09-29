/**
 * Конфигурация Supabase.
 *
 * Приоритет: переменные окружения Vite (.env / GitHub Secrets) → значения
 * по умолчанию ниже. Fallback нужен, потому что сборка на GitHub Pages
 * без заданных секретов раньше молча уходила в демо-режим, и регистрация
 * «создавала» только локального демо-пользователя.
 *
 * Хранить anon (publishable) ключ в репозитории безопасно: он по дизайну
 * Supabase публичный и попадает в JS-бандл клиента, а доступ к данным
 * ограничивают политики RLS (см. supabase/schema.sql).
 * Секретный service_role ключ сюда класть НЕЛЬЗЯ.
 */
const FALLBACK_SUPABASE_URL = 'https://dcgurmwvpgzmlfivxoso.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_R5w5GPMfKZSVrEohLPw1Mw_Ot79EMn8'

const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

const isPlaceholder = (v: string): boolean =>
  !v || v.includes('your-project-ref') || v.includes('your-anon-public-key')

export const SUPABASE_URL = isPlaceholder(envUrl) ? FALLBACK_SUPABASE_URL : envUrl
export const SUPABASE_ANON_KEY = isPlaceholder(envKey) ? FALLBACK_SUPABASE_ANON_KEY : envKey

/** Supabase считается настроенным, только если заданы обе переменные */
export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !isPlaceholder(SUPABASE_URL) && SUPABASE_URL.startsWith('http'),
)
