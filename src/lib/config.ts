/** Конфигурация Supabase из переменных окружения Vite */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

/** Supabase считается настроенным, только если заданы обе переменные */
export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('your-project-ref') &&
    SUPABASE_URL.startsWith('http'),
)
