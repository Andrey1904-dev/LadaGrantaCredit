import type { ComponentType } from 'react'
import type { TxCategory } from '../types/domain'
import { CardIcon, DotsIcon, FuelIcon, ShieldIcon, WrenchIcon, type IconProps } from '../components/icons'

export interface CategoryMeta {
  label: string
  /** Различимый семантический цвет для аналитики и DonutChart (без кодирования всех категорий одним красным) */
  color: string
  Icon: ComponentType<IconProps>
  /** Для топлива пробег обязателен (учёт л/100км и стоимости км) */
  requiresMileage: boolean
  /** Показывать ли поле пробега (необязательно) */
  suggestsMileage: boolean
}

export const CATEGORY_META: Record<TxCategory, CategoryMeta> = {
  fuel: {
    label: 'Топливо',
    color: '#F5A623',
    Icon: FuelIcon,
    requiresMileage: true,
    suggestsMileage: true,
  },
  loan: {
    label: 'Кредит',
    color: '#E33337',
    Icon: CardIcon,
    requiresMileage: false,
    suggestsMileage: false,
  },
  maintenance: {
    label: 'ТО и ремонт',
    color: '#38BDF8',
    Icon: WrenchIcon,
    requiresMileage: false,
    suggestsMileage: true,
  },
  insurance: {
    label: 'Страховка',
    color: '#16B374',
    Icon: ShieldIcon,
    requiresMileage: false,
    suggestsMileage: false,
  },
  other: {
    label: 'Прочее',
    color: '#94A3B8',
    Icon: DotsIcon,
    requiresMileage: false,
    suggestsMileage: false,
  },
}

export const categoryLabel = (c: TxCategory): string => CATEGORY_META[c].label
