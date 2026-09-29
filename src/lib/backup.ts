import type { Car, Loan, MaintenanceRecord, Transaction } from '../types/domain'
import { CATEGORY_META } from './categories'
import type { AppSettings } from './settings'
import { fmtDate } from '../utils/format'

/**
 * Выгрузка данных гаража.
 *
 * Резервная копия и экспорт в таблицу — то, чего владельцы чаще всего просят
 * у приложений учёта: данные должны оставаться у человека, а не только
 * в чужой базе. Обе выгрузки делаются целиком в браузере, без сервера.
 */

export interface BackupPayload {
  car: Car | null
  loan: Loan | null
  transactions: Transaction[]
  maintenance: MaintenanceRecord[]
  settings: AppSettings
}

export interface Backup extends BackupPayload {
  app: 'lada-granta-credit'
  version: 1
  exportedAt: string
}

export function buildBackup(payload: BackupPayload): string {
  const backup: Backup = {
    app: 'lada-granta-credit',
    version: 1,
    exportedAt: new Date().toISOString(),
    ...payload,
  }
  return JSON.stringify(backup, null, 2)
}

const csvCell = (value: string | number): string => {
  const s = String(value)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV для Excel/Numbers: разделитель «;» и BOM, иначе кириллица ломается */
export function buildExpensesCsv(transactions: Transaction[]): string {
  const rows = [
    ['Дата', 'Категория', 'Сумма, ₽', 'Пробег, км'],
    ...[...transactions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => [
        fmtDate(t.date),
        CATEGORY_META[t.category].label,
        String(t.amount).replace('.', ','),
        t.mileage_at_transaction ?? '',
      ]),
  ]
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n')
}

/** CSV журнала ТО */
export function buildMaintenanceCsv(records: MaintenanceRecord[]): string {
  const rows = [
    ['Дата', 'Пробег, км', 'Работы'],
    ...[...records]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => [fmtDate(m.date), m.mileage, m.description]),
  ]
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n')
}

/** Сохраняет строку как файл (Blob + временная ссылка) */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // отдаём память после того, как браузер начал скачивание
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

/** Имя файла с датой: lada-granta-2026-09-29.json */
export const backupFileName = (ext: string, from: Date = new Date()): string => {
  const y = from.getFullYear()
  const m = String(from.getMonth() + 1).padStart(2, '0')
  const d = String(from.getDate()).padStart(2, '0')
  return `lada-granta-${y}-${m}-${d}.${ext}`
}
