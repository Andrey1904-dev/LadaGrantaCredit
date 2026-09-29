import type { ComponentType } from 'react'
import type { TxCategory } from '../types/domain'
import { CardIcon, DotsIcon, FuelIcon, ShieldIcon, WrenchIcon } from '../components/icons'

interface IconComponentProps {
  className?: string
}

export interface CategoryMeta {
  label: string
  color: string
  Icon: ComponentType<IconComponentProps>
  /** Для топлива пробег обязателен (учёт л/100км и стоимости км) */
  requiresMileage: boolean
  /** Показывать ли поле пробега (необязательно) */
  suggestsMileage: boolean
}

export const CATEGORY_META: Record<TxCategory, CategoryMeta> = {
  fuel: { label: 'Топливо', color: '#F5A623', Icon: FuelIcon, requiresMileage: true, suggestsMileage: true },
  loan: { label: 'Кредит', color: '#005BAA', Icon: CardIcon, requiresMileage: false, suggestsMileage: false },
  maintenance: { label: 'ТО и ремонт', color: '#7C5CFC', Icon: WrenchIcon, requiresMileage: false, suggestsMileage: true },
  insurance: { label: 'Страховка', color: '#12A76D', Icon: ShieldIcon, requiresMileage: false, suggestsMileage: false },
  other: { label: 'Прочее', color: '#8A94A6', Icon: DotsIcon, requiresMileage: false, suggestsMileage: false },
}

export const categoryLabel = (c: TxCategory): string => CATEGORY_META[c].label
