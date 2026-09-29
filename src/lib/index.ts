import type { Backend } from './backend'
import { isSupabaseConfigured } from './config'
import { createLocalBackend } from './local'
import { supabaseBackend } from './supabase'

/**
 * Единая точка входа: если заданы переменные окружения Supabase —
 * работаем с реальной БД, иначе — локальный демо-режим (localStorage).
 */
let cached: Backend | null = null

export function getBackend(): Backend {
  if (!cached) {
    cached = isSupabaseConfigured ? supabaseBackend : createLocalBackend()
  }
  return cached
}
