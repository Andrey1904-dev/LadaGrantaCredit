import { resetStorage } from './setup'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  annuityPayment,
  principalFromPayment,
  rateFromPayment,
  remainingBalance,
  simulatePrepayment,
  termFromPayment,
} from '../src/utils/loan'
import { addMonths, daysUntil, monthsBetween, nextPaymentDate, startOfMonth } from '../src/utils/date'
import { parseLocaleNumber, plural, pluralMonths, toDateInputValue } from '../src/utils/format'
import { computeFuelStats, monthlyMileage } from '../src/utils/fuel'
import { forecastYear, monthlySeries, ownershipCost } from '../src/utils/stats'
import {
  SERVICE_ITEMS,
  buildMileagePlan,
  buildServicePlan,
  computeServiceStatus,
  engineInfo,
  intervalFor,
} from '../src/lib/service'
import { TAX_REGIONS, taxDueDate, taxRateFor, transportTax } from '../src/lib/tax'
import { DEFAULT_SETTINGS, readSettings, writeSettings } from '../src/lib/settings'
import { buildBackup, buildExpensesCsv, buildMaintenanceCsv } from '../src/lib/backup'
import { DEMO_CREDENTIALS, createLocalBackend, resetDemoData } from '../src/lib/local'
import type { MaintenanceRecord, Transaction } from '../src/types/domain'

const near = (actual: number, expected: number, eps = 0.5, msg?: string) =>
  assert.ok(
    Math.abs(actual - expected) <= eps,
    msg ?? `ожидалось ≈${expected}, получено ${actual}`,
  )

const tx = (p: Partial<Transaction> & Pick<Transaction, 'amount' | 'category' | 'date'>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  user_id: 'u1',
  mileage_at_transaction: null,
  ...p,
})

/* ------------------------------------------------------------------ */
describe('аннуитет', () => {
  it('платёж по классической формуле', () => {
    near(annuityPayment(1_000_000, 12, 12), 88_848.79, 0.05)
    near(annuityPayment(1_050_000, 16.9, 60), 26_022, 50)
  })

  it('беспроцентный кредит делится поровну', () => {
    assert.equal(annuityPayment(120_000, 0, 12), 10_000)
  })

  it('некорректные входные данные дают NaN', () => {
    assert.ok(Number.isNaN(annuityPayment(0, 12, 12)))
    assert.ok(Number.isNaN(annuityPayment(100, 12, 0)))
  })

  it('срок и сумма обратны платежу', () => {
    const P = annuityPayment(1_000_000, 12, 24)
    near(termFromPayment(1_000_000, 12, P), 24, 0.01)
    near(principalFromPayment(P, 12, 24), 1_000_000, 1)
  })

  it('платёж меньше процентов — срок не определён', () => {
    assert.ok(Number.isNaN(termFromPayment(1_000_000, 12, 5_000)))
  })

  it('ставка восстанавливается бисекцией', () => {
    const P = annuityPayment(1_000_000, 18.5, 36)
    near(rateFromPayment(1_000_000, P, 36), 18.5, 0.01)
  })

  it('остаток долга: границы и середина', () => {
    assert.equal(remainingBalance(1_000_000, 12, 12, 0), 1_000_000)
    assert.equal(remainingBalance(1_000_000, 12, 12, 12), 0)
    const half = remainingBalance(1_000_000, 12, 12, 6)
    assert.ok(half > 480_000 && half < 520_000, `остаток после 6 из 12: ${half}`)
  })
})

/* ------------------------------------------------------------------ */
describe('досрочное погашение', () => {
  const base = { balance: 1_000_000, annualPercent: 12, payment: 88_848.79, termLeft: 12 }

  it('без досрочных взносов повторяет обычный график', () => {
    const plan = simulatePrepayment({ ...base, mode: 'term' })!
    assert.equal(plan.months, 12)
    near(plan.interest, 66_185, 100)
    near(plan.totalPaid, 1_066_185, 100)
  })

  it('разовый взнос сокращает срок и переплату', () => {
    const plan = simulatePrepayment({ ...base, oneTime: 500_000, mode: 'term' })!
    assert.equal(plan.months, 6)
    near(plan.interest, 17_254, 50)
  })

  it('сокращение срока выгоднее уменьшения платежа', () => {
    const byTerm = simulatePrepayment({ ...base, oneTime: 500_000, mode: 'term' })!
    const byPayment = simulatePrepayment({ ...base, oneTime: 500_000, mode: 'payment' })!
    assert.ok(byTerm.interest < byPayment.interest)
    assert.equal(byPayment.months, 12)
    near(byPayment.payment, 44_424, 5)
  })

  it('регулярная доплата тоже сокращает срок', () => {
    const plain = simulatePrepayment({ ...base, mode: 'term' })!
    const extra = simulatePrepayment({ ...base, monthly: 20_000, mode: 'term' })!
    assert.ok(extra.months < plain.months)
    assert.ok(extra.interest < plain.interest)
  })

  it('взнос больше долга закрывает кредит', () => {
    const plan = simulatePrepayment({ ...base, oneTime: 2_000_000, mode: 'term' })!
    assert.equal(plan.months, 0)
    assert.equal(plan.interest, 0)
  })

  it('платёж меньше процентов — расчёт невозможен', () => {
    assert.equal(simulatePrepayment({ ...base, payment: 1_000, mode: 'term' }), null)
  })
})

/* ------------------------------------------------------------------ */
describe('даты', () => {
  it('addMonths не перескакивает через месяц', () => {
    assert.equal(toDateInputValue(addMonths(new Date(2026, 0, 31), 1)), '2026-02-28')
    assert.equal(toDateInputValue(addMonths(new Date(2024, 0, 31), 1)), '2024-02-29')
    assert.equal(toDateInputValue(addMonths(new Date(2026, 11, 15), 1)), '2027-01-15')
  })

  it('monthsBetween считает полные месяцы', () => {
    assert.equal(monthsBetween(new Date(2026, 0, 15), new Date(2026, 3, 15)), 3)
    assert.equal(monthsBetween(new Date(2026, 0, 15), new Date(2026, 3, 14)), 2)
  })

  it('следующий платёж — ближайший день месяца', () => {
    assert.equal(
      toDateInputValue(nextPaymentDate('2025-01-25', new Date(2026, 8, 29))),
      '2026-10-25',
    )
    // сегодня день платежа — платёж сегодня, а не через месяц
    assert.equal(
      toDateInputValue(nextPaymentDate('2025-01-25', new Date(2026, 8, 25))),
      '2026-09-25',
    )
    // 31-е число в коротком месяце
    assert.equal(
      toDateInputValue(nextPaymentDate('2025-01-31', new Date(2026, 1, 15))),
      '2026-02-28',
    )
  })

  it('daysUntil и startOfMonth', () => {
    assert.equal(daysUntil('2026-10-09', new Date(2026, 8, 29)), 10)
    assert.equal(daysUntil('2026-09-20', new Date(2026, 8, 29)), -9)
    assert.equal(toDateInputValue(startOfMonth(new Date(2026, 8, 29))), '2026-09-01')
  })
})

/* ------------------------------------------------------------------ */
describe('форматирование', () => {
  it('парсит числа в русской раскладке', () => {
    assert.equal(parseLocaleNumber('1 234,5'), 1234.5)
    assert.equal(parseLocaleNumber('27400'), 27400)
    assert.ok(Number.isNaN(parseLocaleNumber('')))
  })

  it('склонения', () => {
    const f: [string, string, string] = ['месяц', 'месяца', 'месяцев']
    assert.equal(plural(1, f), 'месяц')
    assert.equal(plural(2, f), 'месяца')
    assert.equal(plural(5, f), 'месяцев')
    assert.equal(plural(11, f), 'месяцев')
    assert.equal(plural(21, f), 'месяц')
    assert.equal(plural(0, f), 'месяцев')
    assert.ok(pluralMonths(3).endsWith('месяца'))
  })
})

/* ------------------------------------------------------------------ */
describe('топливная аналитика', () => {
  const fills = [
    tx({ amount: 3_000, category: 'fuel', date: '2026-09-01', mileage_at_transaction: 10_000 }),
    tx({ amount: 3_600, category: 'fuel', date: '2026-09-11', mileage_at_transaction: 10_600 }),
    tx({ amount: 3_600, category: 'fuel', date: '2026-09-21', mileage_at_transaction: 11_200 }),
  ]

  it('считает расход между заправками', () => {
    const stats = computeFuelStats(fills, 60, 50)
    assert.equal(stats.legs.length, 2)
    near(stats.avgPer100!, 10, 0.01) // 60 л на 600 км
    near(stats.rubPerKm!, 6, 0.01)
    near(stats.totalLiters, 170, 0.01)
    near(stats.rangePerTank!, 500, 1)
  })

  it('отбрасывает выбросы и пустую историю', () => {
    assert.equal(computeFuelStats([], 60).avgPer100, null)
    const noisy = computeFuelStats(
      [
        tx({ amount: 3_000, category: 'fuel', date: '2026-01-01', mileage_at_transaction: 1_000 }),
        tx({ amount: 3_000, category: 'fuel', date: '2026-06-01', mileage_at_transaction: 40_000 }),
      ],
      60,
    )
    assert.equal(noisy.legs.length, 0, 'отрезок в 39 000 км не должен учитываться')
    assert.equal(noisy.count, 2)
  })

  it('средний пробег в месяц', () => {
    const km = monthlyMileage(fills)
    assert.ok(km && km > 1_500 && km < 2_000, `пробег в месяц: ${km}`)
    assert.equal(monthlyMileage([fills[0]]), null)
  })
})

/* ------------------------------------------------------------------ */
describe('статистика владения', () => {
  const now = new Date(2026, 8, 29)
  const list = [
    tx({ amount: 3_000, category: 'fuel', date: '2026-09-10', mileage_at_transaction: 20_000 }),
    tx({ amount: 27_400, category: 'loan', date: '2026-09-05' }),
    tx({ amount: 5_000, category: 'maintenance', date: '2026-08-15', mileage_at_transaction: 19_000 }),
    tx({ amount: 1_000, category: 'other', date: '2024-01-01' }), // вне окна
  ]

  it('ряд по месяцам содержит нужное число точек', () => {
    const series = monthlySeries(list, 12, now)
    assert.equal(series.length, 12)
    assert.equal(series[11].key, '2026-09')
    assert.equal(series[11].total, 30_400)
    assert.equal(series[11].byCategory.fuel, 3_000)
    assert.equal(series[10].total, 5_000)
    assert.equal(
      series.reduce((s, p) => s + p.total, 0),
      35_400,
      'запись 2024 года не попадает в окно 12 месяцев',
    )
  })

  it('стоимость владения считается по окну с данными', () => {
    const cost = ownershipCost(list, 12, now)
    assert.equal(cost.total, 35_400)
    assert.equal(cost.kmInWindow, 1_000)
    near(cost.perKm!, 35.4, 0.01)
    assert.ok(cost.perMonth > 0)
    assert.equal(cost.byCategory[0].category, 'loan')
    // сравнение с отраслевым ориентиром считают без платежей по кредиту
    assert.equal(cost.totalExLoan, 8_000)
    near(cost.perKmExLoan!, 8, 0.01)
  })

  it('прогноз на год складывает статьи расходов', () => {
    const f = forecastYear({
      loanPayment: 27_400,
      loanMonthsLeft: 6,
      kmPerYear: 12_000,
      per100: 8,
      fuelPrice: 60,
      service: 20_000,
      insurance: 7_000,
      tax: 3_286,
    })
    near(f.loan, 164_400, 1)
    near(f.fuel, 57_600, 1)
    near(f.total, 252_286, 2)
    near(f.perKm!, 21.02, 0.05)
  })
})

/* ------------------------------------------------------------------ */
describe('регламент ТО', () => {
  const ctx = {
    mileage: 47_800,
    mode: 'factory' as const,
    engine: '21127' as const,
    maintenance: [] as MaintenanceRecord[],
    today: new Date(2026, 8, 29),
  }
  const oil = SERVICE_ITEMS.find((i) => i.id === 'oil')!

  it('интервалы завода и форума различаются', () => {
    assert.equal(intervalFor(oil, 'factory').km, 15_000)
    assert.equal(intervalFor(oil, 'forum').km, 8_000)
  })

  it('без записей последнее ТО оценивается по пробегу', () => {
    const s = computeServiceStatus(oil, ctx)
    assert.equal(s.estimated, true)
    assert.equal(s.lastKm, 45_000)
    assert.equal(s.dueKm, 60_000)
    assert.equal(s.remainingKm, 12_200)
    near(s.progress, 0.187, 0.01)
    assert.equal(s.state, 'ok')
  })

  it('запись из журнала уточняет план и снимает оценку', () => {
    const s = computeServiceStatus(oil, {
      ...ctx,
      maintenance: [
        {
          id: 'm1',
          user_id: 'u1',
          date: '2026-06-01',
          mileage: 44_000,
          description: 'Замена масла и масляного фильтра',
        },
      ],
    })
    assert.equal(s.estimated, false)
    assert.equal(s.lastKm, 44_000)
    assert.equal(s.dueKm, 59_000)
    assert.ok(s.record)
  })

  it('просроченная работа получает статус overdue', () => {
    const s = computeServiceStatus(oil, {
      ...ctx,
      maintenance: [
        {
          id: 'm1',
          user_id: 'u1',
          date: '2024-01-10',
          mileage: 10_000,
          description: 'Моторное масло и масляный фильтр',
        },
      ],
    })
    assert.equal(s.state, 'overdue')
    assert.ok(s.remainingKm! < 0)
  })

  it('масло в МКПП не считается моторным', () => {
    const s = computeServiceStatus(oil, {
      ...ctx,
      maintenance: [
        {
          id: 'm1',
          user_id: 'u1',
          date: '2026-06-01',
          mileage: 44_000,
          description: 'Замена масла в МКПП',
        },
      ],
    })
    assert.equal(s.record, null)
  })

  it('план отсортирован по срочности и учитывает мотор', () => {
    const plan = buildServicePlan(ctx)
    assert.ok(plan.length >= 20)
    for (let i = 1; i < plan.length; i++) {
      assert.ok(plan[i - 1].progress >= plan[i].progress, 'план не отсортирован по прогрессу')
    }
    const has8vWork = (engine: '11182' | '21127') =>
      buildServicePlan({ ...ctx, engine }).some((s) => s.item.id === 'valve-clearance')
    assert.equal(has8vWork('11182'), true, 'регулировка клапанов нужна для 8V')
    assert.equal(has8vWork('21127'), false, 'на 16V гидрокомпенсаторы')
  })

  it('карта ТО кратна 15 000 км', () => {
    const stops = buildMileagePlan('21127', 'factory', 6)
    assert.equal(stops.length, 6)
    assert.equal(stops[0].km, 15_000)
    assert.ok(stops[0].items.some((i) => i.id === 'oil'))
    assert.ok(stops[2].items.some((i) => i.id === 'brake-fluid'), 'тормозная жидкость на 45 000')
    assert.ok(!stops[0].items.some((i) => i.id === 'brake-fluid'))
  })

  it('данные каталога заполнены корректно', () => {
    const ids = new Set<string>()
    for (const item of SERVICE_ITEMS) {
      assert.ok(!ids.has(item.id), `дубликат id: ${item.id}`)
      ids.add(item.id)
      assert.ok(item.title.length > 3, item.id)
      assert.ok(item.keywords.length > 0, item.id)
      assert.ok(item.cost[0] > 0 && item.cost[1] >= item.cost[0], `вилка цен: ${item.id}`)
      assert.ok(item.factory.km || item.factory.months, `нет интервала: ${item.id}`)
    }
    assert.equal(engineInfo('21179').power, 122)
  })
})

/* ------------------------------------------------------------------ */
describe('транспортный налог', () => {
  it('ставка зависит от мощности и региона', () => {
    assert.equal(taxRateFor('msk', 90), 14) // 8-клапанная Гранта
    assert.equal(taxRateFor('msk', 106), 31) // 16-клапанная
    assert.equal(taxRateFor('msk', 122), 31)
    assert.equal(taxRateFor('spb', 106), 35)
    assert.equal(taxRateFor('nk', 106), 3.5)
    assert.equal(taxRateFor('неизвестный', 106), 31, 'падаем на первый регион')
  })

  it('налог пропорционален месяцам владения', () => {
    near(transportTax(106, 31, 12), 3_286)
    near(transportTax(106, 31, 6), 1_643)
    assert.equal(transportTax(106, 31, 0), 0)
    near(transportTax(106, 31, 24), 3_286, 0.5, 'больше года не начисляют')
  })

  it('срок уплаты — 1 декабря', () => {
    const due = taxDueDate(new Date(2026, 5, 1))
    assert.equal(due.getMonth(), 11)
    assert.equal(due.getDate(), 1)
    assert.equal(due.getFullYear(), 2026)
    assert.equal(taxDueDate(new Date(2026, 11, 20)).getFullYear(), 2027)
  })

  it('в каждом регионе ставки возрастают с мощностью', () => {
    for (const region of TAX_REGIONS) {
      for (let i = 1; i < region.brackets.length; i++) {
        assert.ok(
          region.brackets[i].rate >= region.brackets[i - 1].rate,
          `${region.label}: ставки не возрастают`,
        )
        assert.ok(region.brackets[i].upTo > region.brackets[i - 1].upTo, region.label)
      }
    }
  })
})

/* ------------------------------------------------------------------ */
describe('настройки', () => {
  it('значения по умолчанию и сохранение', () => {
    resetStorage()
    assert.deepEqual(readSettings(), DEFAULT_SETTINGS)
    writeSettings({ fuelPrice: 70, engine: '21179' })
    assert.equal(readSettings().fuelPrice, 70)
    assert.equal(readSettings().engine, '21179')
    assert.equal(readSettings().tankLiters, DEFAULT_SETTINGS.tankLiters, 'остальное не теряется')
  })

  it('битый JSON не ломает приложение', () => {
    resetStorage()
    localStorage.setItem('lgc_settings_v1', '{не json')
    assert.deepEqual(readSettings(), DEFAULT_SETTINGS)
  })

  it('новые поля добавляются к старым настройкам', () => {
    resetStorage()
    localStorage.setItem('lgc_settings_v1', JSON.stringify({ fuelPrice: 55 }))
    const s = readSettings()
    assert.equal(s.fuelPrice, 55)
    assert.equal(s.taxRegion, DEFAULT_SETTINGS.taxRegion)
    assert.equal(s.licenseUntil, null)
  })
})

/* ------------------------------------------------------------------ */
describe('выгрузка данных', () => {
  const list = [
    tx({ amount: 2_450, category: 'fuel', date: '2026-09-27', mileage_at_transaction: 48_100 }),
    tx({ amount: 27_400, category: 'loan', date: '2026-09-20' }),
  ]

  it('JSON-бэкап содержит подпись приложения', () => {
    const json = JSON.parse(
      buildBackup({
        car: null,
        loan: null,
        transactions: list,
        maintenance: [],
        settings: DEFAULT_SETTINGS,
      }),
    )
    assert.equal(json.app, 'lada-granta-credit')
    assert.equal(json.version, 1)
    assert.equal(json.transactions.length, 2)
    assert.ok(json.exportedAt)
  })

  it('CSV с BOM, заголовком и разделителем «;»', () => {
    const csv = buildExpensesCsv(list)
    assert.ok(csv.startsWith('\uFEFF'), 'нет BOM — Excel сломает кириллицу')
    const rows = csv.replace('\uFEFF', '').split('\r\n')
    assert.equal(rows[0], 'Дата;Категория;Сумма, ₽;Пробег, км')
    assert.equal(rows.length, 3)
    assert.ok(rows[1].includes('27 400') || rows[1].includes('27400'))
  })

  it('CSV журнала ТО экранирует точку с запятой', () => {
    const csv = buildMaintenanceCsv([
      { id: 'm', user_id: 'u', date: '2026-01-01', mileage: 100, description: 'Масло; фильтр' },
    ])
    assert.ok(csv.includes('"Масло; фильтр"'))
  })
})

/* ------------------------------------------------------------------ */
describe('локальный (демо) бэкенд', () => {
  it('вход создаёт сессию и наполняет гараж', async () => {
    resetStorage()
    const backend = createLocalBackend()
    assert.equal(backend.mode, 'demo')
    assert.equal(await backend.auth.getUser(), null)

    const user = await backend.auth.signIn(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)
    assert.equal(user.email, 'demo@lada.ru')
    assert.ok(await backend.auth.getUser())

    const car = await backend.data.getCar(user.id)
    const loan = await backend.data.getLoan(user.id)
    const txs = await backend.data.listTransactions(user.id)
    const mnt = await backend.data.listMaintenance(user.id)
    assert.ok(car && car.current_mileage > 10_000)
    assert.ok(loan && loan.monthly_payment > 0)
    assert.ok(txs.length > 20, `транзакций: ${txs.length}`)
    assert.ok(mnt.length >= 3)
    assert.ok(
      txs.every((t) => t.amount > 0 && !!t.date),
      'в демо-данных есть пустые записи',
    )
  })

  it('CRUD расходов и журнала ТО', async () => {
    resetStorage()
    const backend = createLocalBackend()
    const user = await backend.auth.signIn(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)
    const before = (await backend.data.listTransactions(user.id)).length

    const added = await backend.data.addTransaction(user.id, {
      amount: 1_234,
      category: 'other',
      date: new Date().toISOString(),
      mileage_at_transaction: null,
    })
    assert.equal((await backend.data.listTransactions(user.id)).length, before + 1)
    await backend.data.removeTransaction(added.id)
    assert.equal((await backend.data.listTransactions(user.id)).length, before)

    const rec = await backend.data.addMaintenance(user.id, {
      date: '2026-09-01',
      mileage: 48_000,
      description: 'Тестовая запись',
    })
    assert.ok((await backend.data.listMaintenance(user.id)).some((m) => m.id === rec.id))
    await backend.data.removeMaintenance(rec.id)
    assert.ok(!(await backend.data.listMaintenance(user.id)).some((m) => m.id === rec.id))
  })

  it('обновление автомобиля сохраняется', async () => {
    resetStorage()
    const backend = createLocalBackend()
    const user = await backend.auth.signIn(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)
    const car = (await backend.data.getCar(user.id))!
    const updated = await backend.data.updateCar(car.id, { current_mileage: 50_000 })
    assert.equal(updated.current_mileage, 50_000)
    assert.equal((await backend.data.getCar(user.id))!.current_mileage, 50_000)
  })

  it('регистрация в демо честно отказывает', async () => {
    resetStorage()
    const backend = createLocalBackend()
    await assert.rejects(() => backend.auth.signUp('a@b.ru', 'pass'))
  })

  it('сброс демо-данных возвращает исходный набор', async () => {
    resetStorage()
    const backend = createLocalBackend()
    const user = await backend.auth.signIn(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)
    const car = (await backend.data.getCar(user.id))!
    await backend.data.updateCar(car.id, { current_mileage: 1 })
    resetDemoData()
    assert.ok((await backend.data.getCar(user.id))!.current_mileage > 10_000)
  })

  it('выход очищает сессию, но не данные', async () => {
    resetStorage()
    const backend = createLocalBackend()
    const user = await backend.auth.signIn(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)
    await backend.auth.signOut()
    assert.equal(await backend.auth.getUser(), null)
    assert.ok(await backend.data.getCar(user.id))
  })
})

/* ------------------------------------------------------------------ */
describe('демо-данные согласованы с разделом ТО', () => {
  it('журнал демо распознаётся каталогом работ', async () => {
    resetStorage()
    const backend = createLocalBackend()
    const user = await backend.auth.signIn(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)
    const car = (await backend.data.getCar(user.id))!
    const maintenance = await backend.data.listMaintenance(user.id)

    const plan = buildServicePlan({
      mileage: car.current_mileage,
      mode: 'forum',
      engine: '21127',
      maintenance,
    })
    const matched = plan.filter((s) => s.record !== null)
    assert.ok(matched.length >= 4, `распознано работ: ${matched.length}`)
    assert.ok(plan.some((s) => s.state !== 'ok'), 'в демо должны быть работы, требующие внимания')
    assert.ok(
      plan.every((s) => Number.isFinite(s.progress)),
      'прогресс не должен быть NaN',
    )
  })

  it('в демо есть данные для топливной аналитики', async () => {
    resetStorage()
    const backend = createLocalBackend()
    const user = await backend.auth.signIn(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)
    const txs = await backend.data.listTransactions(user.id)
    const fuel = computeFuelStats(txs, 62, 50)
    assert.ok(fuel.avgPer100 && fuel.avgPer100 > 4 && fuel.avgPer100 < 20, `расход: ${fuel.avgPer100}`)
    assert.ok(monthlyMileage(txs))
    const series = monthlySeries(txs, 12)
    assert.ok(series.filter((p) => p.total > 0).length >= 6, 'история должна покрывать год')
  })
})
