/**
 * Транспортный налог: ставки регионов и расчёт.
 *
 * Формула ФНС:  налог = мощность (л.с.) × ставка региона × (месяцы владения / 12).
 * Ставки устанавливают субъекты РФ (НК РФ задаёт лишь базовые значения, которые
 * регион вправе менять до 10 раз), поэтому за одну и ту же Гранту в Москве и в
 * Крыму начисляют суммы, отличающиеся в разы. Таблица ниже — ориентир на 2026 год
 * по данным ФНС и сводным таблицам (nalog-nalog.ru, fd.ru, calcal.ru);
 * точную ставку всегда можно проверить в сервисе ФНС по своему региону.
 *
 * Гранта попадает в две первые категории: 8-клапанные моторы (87/90 л.с.) —
 * «до 100 л.с.», 16-клапанные (106/122 л.с.) — «свыше 100 до 150 л.с.».
 */

export interface TaxBracket {
  /** Верхняя граница мощности включительно, л.с. */
  upTo: number
  /** Ставка, ₽ за 1 л.с. */
  rate: number
}

export interface TaxRegion {
  id: string
  label: string
  brackets: TaxBracket[]
}

export const TAX_REGIONS: TaxRegion[] = [
  {
    id: 'msk',
    label: 'Москва',
    brackets: [
      { upTo: 100, rate: 14 },
      { upTo: 125, rate: 31 },
      { upTo: 150, rate: 35 },
      { upTo: 200, rate: 50 },
      { upTo: Infinity, rate: 75 },
    ],
  },
  {
    id: 'mo',
    label: 'Московская область',
    brackets: [
      { upTo: 100, rate: 12 },
      { upTo: 150, rate: 25 },
      { upTo: 200, rate: 45 },
      { upTo: Infinity, rate: 75 },
    ],
  },
  {
    id: 'spb',
    label: 'Санкт-Петербург',
    brackets: [
      { upTo: 100, rate: 24 },
      { upTo: 150, rate: 35 },
      { upTo: 200, rate: 50 },
      { upTo: Infinity, rate: 75 },
    ],
  },
  {
    id: 'sverdlovsk',
    label: 'Свердловская область',
    brackets: [
      { upTo: 100, rate: 10.4 },
      { upTo: 150, rate: 14.6 },
      { upTo: 200, rate: 35 },
      { upTo: Infinity, rate: 99.2 },
    ],
  },
  {
    id: 'rostov',
    label: 'Ростовская область',
    brackets: [
      { upTo: 100, rate: 15 },
      { upTo: 150, rate: 25 },
      { upTo: 200, rate: 45 },
      { upTo: Infinity, rate: 75 },
    ],
  },
  {
    id: 'crimea',
    label: 'Республика Крым',
    brackets: [
      { upTo: 100, rate: 5 },
      { upTo: 150, rate: 7 },
      { upTo: 200, rate: 15 },
      { upTo: Infinity, rate: 50 },
    ],
  },
  {
    id: 'nk',
    label: 'Базовые ставки НК РФ',
    brackets: [
      { upTo: 100, rate: 2.5 },
      { upTo: 150, rate: 3.5 },
      { upTo: 200, rate: 5 },
      { upTo: 250, rate: 7.5 },
      { upTo: Infinity, rate: 15 },
    ],
  },
]

export const DEFAULT_TAX_REGION = 'msk'

export const findTaxRegion = (id: string): TaxRegion =>
  TAX_REGIONS.find((r) => r.id === id) ?? TAX_REGIONS[0]

/** Ставка ₽/л.с. для мощности в выбранном регионе */
export function taxRateFor(regionId: string, hp: number): number {
  const region = findTaxRegion(regionId)
  const bracket = region.brackets.find((b) => hp <= b.upTo) ?? region.brackets[region.brackets.length - 1]
  return bracket.rate
}

/** Транспортный налог за год: мощность × ставка × (месяцы владения / 12) */
export function transportTax(hp: number, rate: number, monthsOwned = 12): number {
  const months = Math.min(12, Math.max(0, monthsOwned))
  return hp * rate * (months / 12)
}

/**
 * Срок уплаты: налог за прошедший год платят до 1 декабря текущего.
 * Для 2026 года это 1 декабря 2026-го за 2025-й.
 */
export function taxDueDate(from: Date = new Date()): Date {
  const year = from.getMonth() === 11 && from.getDate() > 1 ? from.getFullYear() + 1 : from.getFullYear()
  return new Date(year, 11, 1)
}
