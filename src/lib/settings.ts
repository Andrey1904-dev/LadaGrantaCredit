import { useCallback, useEffect, useState } from 'react'
import type { EngineId } from './service'
import { DEFAULT_TAX_REGION } from './tax'

/**
 * Пользовательские настройки гаража, которых нет в схеме БД
 * (двигатель, режим регламента, цена литра, сезон шин, дата покупки).
 *
 * Хранятся в localStorage: это не «данные аккаунта», а предпочтения
 * конкретного браузера — и, что важнее, их можно добавить, не требуя
 * от владельца проекта миграции таблиц в Supabase.
 */

export type PlanMode = 'factory' | 'forum'
export type TyreSeason = 'summer' | 'winter'

export interface AppSettings {
  /** Двигатель: от него зависят регламентные работы (8V/16V) */
  engine: EngineId
  /** Чей интервал показывать: завода или сообщества владельцев */
  planMode: PlanMode
  /** Цена литра АИ-95, ₽ — нужна для оценки расхода л/100 км по чекам */
  fuelPrice: number
  /** Объём бака, л (Granta — 50 л) */
  tankLiters: number
  /** Дата покупки — точка отсчёта для интервалов «по времени» */
  purchaseDate: string | null
  /** Какая резина стоит сейчас */
  tyreSeason: TyreSeason
  /** Когда и на каком пробеге переобувались */
  tyreChangedDate: string | null
  tyreChangedKm: number | null
  /** Диагностическая карта (техосмотр) действует до */
  inspectionUntil: string | null
  /** Водительское удостоверение действует до */
  licenseUntil: string | null
  /** Регион регистрации — от него зависит ставка транспортного налога */
  taxRegion: string
  /** Своя ставка ₽/л.с., если региона нет в списке */
  taxRateOverride: number | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  engine: '21127',
  planMode: 'forum',
  fuelPrice: 62,
  tankLiters: 50,
  purchaseDate: null,
  tyreSeason: 'summer',
  tyreChangedDate: null,
  tyreChangedKm: null,
  inspectionUntil: null,
  licenseUntil: null,
  taxRegion: DEFAULT_TAX_REGION,
  taxRateOverride: null,
}

const KEY = 'lgc_settings_v1'
const EVENT = 'lgc-settings-change'

export function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function writeSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...readSettings(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }))
  } catch {
    /* ignore storage errors */
  }
  return next
}

/** Реактивные настройки: `const [settings, update] = useSettings()` */
export function useSettings(): [AppSettings, (patch: Partial<AppSettings>) => void] {
  const [settings, setSettings] = useState<AppSettings>(() => readSettings())

  useEffect(() => {
    const sync = () => setSettings(readSettings())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(writeSettings(patch))
  }, [])

  return [settings, update]
}
