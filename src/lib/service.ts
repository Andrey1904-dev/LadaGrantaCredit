import type { MaintenanceRecord } from '../types/domain'
import { addMonths } from '../utils/date'
import { toDateInputValue } from '../utils/format'
import type { PlanMode } from './settings'

/**
 * База знаний по обслуживанию LADA Granta.
 *
 * Два источника интервалов у каждой работы:
 *  • `factory` — сервисная книжка АВТОВАЗ (ТО каждые 15 000 км или 12 месяцев:
 *    масло и фильтры — 15 000, свечи и топливный фильтр — 30 000, тормозная
 *    жидкость — 45 000 / 3 года, антифриз — 75 000 / 5 лет, ремень ГРМ — 75 000);
 *  • `forum` — что реально делают владельцы на drive2 / drom / клубных форумах:
 *    масло 7 500–10 000, ремень ГРМ вместе с помпой на 60 000, тормозная
 *    жидкость раз в 2 года и т. д.
 *
 * Раздел «ТО» подставляет эти данные автоматически: ничего заполнять руками
 * не нужно — достаточно текущего пробега, а журнал ТО лишь уточняет даты.
 */

/* ------------------------------------------------------------------ */
/*  Двигатели                                                          */
/* ------------------------------------------------------------------ */

export type EngineId = '11182' | '11186' | '21127' | '21127-95' | '21129' | '21179'

export interface EngineInfo {
  id: EngineId
  label: string
  short: string
  valves: 8 | 16
  power: number
  /** Гнёт ли клапана при обрыве ремня ГРМ */
  bendsValves: boolean
  note: string
}

export const ENGINES: EngineInfo[] = [
  {
    id: '11182',
    label: 'ВАЗ-11182 · 1.6 8V · 90 л.с.',
    short: '1.6 8V (11182)',
    valves: 8,
    power: 90,
    bendsValves: true,
    note: 'Требует регулировки тепловых зазоров клапанов — гидрокомпенсаторов нет.',
  },
  {
    id: '11186',
    label: 'ВАЗ-11186 · 1.6 8V · 87 л.с.',
    short: '1.6 8V (11186)',
    valves: 8,
    power: 87,
    bendsValves: true,
    note: 'Регулировка клапанов по регламенту, топливный фильтр меняется отдельно.',
  },
  {
    id: '21127',
    label: 'ВАЗ-21127 · 1.6 16V · 106 л.с.',
    short: '1.6 16V (21127)',
    valves: 16,
    power: 106,
    bendsValves: true,
    note: 'Гидрокомпенсаторы: цокот на холодную — повод проверить масло и его интервал.',
  },
  {
    id: '21127-95',
    label: 'ВАЗ-21127-95 · 1.6 16V · 118 л.с. (Sport)',
    short: '1.6 16V Sport (21127-95)',
    valves: 16,
    power: 118,
    bendsValves: true,
    note: 'Мотор Granta Sport: облегчённый впуск-выпуск, спортивный распредвал, своя прошивка. Только АИ-95 — степень сжатия 11.',
  },
  {
    id: '21129',
    label: 'ВАЗ-21129 · 1.6 16V · 106 л.с.',
    short: '1.6 16V (21129)',
    valves: 16,
    power: 106,
    bendsValves: true,
    note: 'Ремень ГРМ с двумя роликами, помпу принято менять в одном комплекте.',
  },
  {
    id: '21179',
    label: 'ВАЗ-21179 · 1.8 16V · 122 л.с.',
    short: '1.8 16V (21179)',
    valves: 16,
    power: 122,
    bendsValves: true,
    note: 'Мотор Granta Drive Active / Sport: чувствителен к качеству масла и перегреву.',
  },
]

export const engineInfo = (id: EngineId): EngineInfo =>
  ENGINES.find((e) => e.id === id) ?? ENGINES[2]

/* ------------------------------------------------------------------ */
/*  Каталог регламентных работ                                         */
/* ------------------------------------------------------------------ */

export type ServiceGroup = 'engine' | 'brakes' | 'chassis' | 'body' | 'docs'

export const GROUP_LABEL: Record<ServiceGroup, string> = {
  engine: 'Двигатель и жидкости',
  brakes: 'Тормоза',
  chassis: 'Ходовая и колёса',
  body: 'Кузов и салон',
  docs: 'Документы и сезон',
}

export interface Interval {
  km?: number
  months?: number
}

export interface ServiceItem {
  id: string
  title: string
  group: ServiceGroup
  /** Регламент завода (сервисная книжка LADA) */
  factory: Interval
  /** Практика владельцев с форумов */
  forum: Interval
  /** Почему форум расходится с заводом / на что смотреть */
  advice: string
  /** Для каких моторов актуально (по умолчанию — для всех) */
  engines?: EngineId[]
  /** Ключевые слова для распознавания записи в журнале ТО */
  keywords: string[]
  /** Слова-исключения (чтобы «масло в МКПП» не считалось моторным) */
  exclude?: string[]
  severity: 'critical' | 'high' | 'normal'
  /** Ориентировочная стоимость работы с запчастями, ₽ */
  cost: [number, number]
}

export const SERVICE_ITEMS: ServiceItem[] = [
  {
    id: 'oil',
    title: 'Моторное масло и масляный фильтр',
    group: 'engine',
    factory: { km: 15_000, months: 12 },
    forum: { km: 8_000, months: 12 },
    advice:
      'Заводские 15 000 км рассчитаны на идеальные условия. В городе, пробках и зимой владельцы сокращают интервал до 7 500–10 000 км — на 16V это заодно лечит цокот гидрокомпенсаторов.',
    keywords: ['моторное масло', 'масло двиг', 'масляный фильтр', 'замена масла', 'то-'],
    exclude: ['мкпп', 'акпп', 'коробк', 'трансмис'],
    severity: 'high',
    cost: [2_500, 5_500],
  },
  {
    id: 'cabin-filter',
    title: 'Салонный фильтр',
    group: 'body',
    factory: { km: 15_000, months: 12 },
    forum: { km: 10_000, months: 6 },
    advice:
      'Дешёвая деталь, которую меняют чаще регламента: после пыльного лета и перед зимой, иначе запотевают стёкла и слабее греет печка.',
    keywords: ['салонный фильтр', 'фильтр салона', 'салонн'],
    severity: 'normal',
    cost: [600, 1_500],
  },
  {
    id: 'air-filter',
    title: 'Воздушный фильтр двигателя',
    group: 'engine',
    factory: { km: 30_000, months: 24 },
    forum: { km: 15_000, months: 12 },
    advice:
      'У дилера фильтр меняют на каждом ТО (15 000 км). На грунтовках и в пыли — раньше: забитый фильтр даёт провалы и рост расхода.',
    keywords: ['воздушный фильтр', 'воздушн'],
    severity: 'normal',
    cost: [700, 1_800],
  },
  {
    id: 'spark-plugs',
    title: 'Свечи зажигания',
    group: 'engine',
    factory: { km: 30_000, months: 24 },
    forum: { km: 20_000, months: 24 },
    advice:
      'Регламент — 30 000 км, но на форумах свечи часто меняют на 15 000–20 000: троение на холодную и рост расхода обычно начинаются раньше срока.',
    keywords: ['свеч'],
    severity: 'normal',
    cost: [1_200, 3_000],
  },
  {
    id: 'fuel-filter',
    title: 'Топливный фильтр',
    group: 'engine',
    factory: { km: 30_000 },
    forum: { km: 20_000 },
    advice:
      'На 8-клапанных меняется отдельным элементом, на 16V — в сборе с модулем бензонасоса. При плохом топливе владельцы меняют каждые 15 000–20 000 км.',
    keywords: ['топливный фильтр', 'топливн'],
    severity: 'normal',
    cost: [900, 2_500],
  },
  {
    id: 'brake-fluid',
    title: 'Тормозная жидкость DOT-4',
    group: 'brakes',
    factory: { km: 45_000, months: 36 },
    forum: { km: 45_000, months: 24 },
    advice:
      'Жидкость гигроскопична: на форумах советуют менять раз в 2 года — иначе закисают задние тормозные цилиндры и их приходится менять парами.',
    keywords: ['тормозная жидкость', 'тормозную жидкость', 'dot'],
    severity: 'high',
    cost: [1_200, 2_800],
  },
  {
    id: 'coolant',
    title: 'Охлаждающая жидкость (антифриз G12)',
    group: 'engine',
    factory: { km: 75_000, months: 60 },
    forum: { km: 60_000, months: 48 },
    advice:
      'Первая замена по книжке — 75 000 км или 5 лет, дальше каждые 40 000 км / 3 года. Помутнел или порыжел — меняют сразу, не дожидаясь пробега.',
    keywords: ['антифриз', 'охлаждающ', 'тосол', 'ож'],
    severity: 'high',
    cost: [1_500, 3_500],
  },
  {
    id: 'timing-belt',
    title: 'Ремень ГРМ с роликами',
    group: 'engine',
    factory: { km: 75_000, months: 60 },
    forum: { km: 60_000, months: 48 },
    advice:
      'Самая дорогая ошибка владельца Гранты: при обрыве гнёт клапана на всех моторах, кроме 11183. На форумах ремень меняют на 50 000–60 000 км сразу с роликами и помпой.',
    keywords: ['грм', 'ремень газораспредел'],
    severity: 'critical',
    cost: [4_000, 9_000],
  },
  {
    id: 'water-pump',
    title: 'Помпа (насос охлаждающей жидкости)',
    group: 'engine',
    factory: { km: 75_000 },
    forum: { km: 60_000 },
    advice:
      'В отзывах владельцев помпа — рекордсмен по внеплановым заменам (встречаются течи уже на 15 000–40 000 км). Меняют в одном комплекте с ремнём ГРМ, чтобы не платить за работу дважды.',
    keywords: ['помпа', 'водяной насос', 'насос охлажд'],
    severity: 'critical',
    cost: [2_500, 6_000],
  },
  {
    id: 'alt-belt',
    title: 'Ремень привода генератора',
    group: 'engine',
    factory: { km: 90_000, months: 60 },
    forum: { km: 45_000, months: 36 },
    advice:
      'Свист при запуске в мороз и трещины на рёбрах — повод менять раньше. Ремень дешёвый, а его обрыв оставляет без зарядки и без усилителя.',
    keywords: ['ремень генератор', 'приводной ремень', 'ремень навесн'],
    severity: 'normal',
    cost: [900, 2_500],
  },
  {
    id: 'gearbox-oil',
    title: 'Масло в коробке передач',
    group: 'engine',
    factory: { km: 75_000, months: 60 },
    forum: { km: 60_000, months: 48 },
    advice:
      'Формально «залито на весь срок службы», но гул и хруст второй передачи — типичная жалоба. После замены масла на 45 000–60 000 км коробка заметно тише.',
    keywords: ['масло в мкпп', 'масло мкпп', 'масло в акпп', 'масло в коробк', 'трансмиссионное'],
    severity: 'normal',
    cost: [2_000, 5_000],
  },
  {
    id: 'valve-clearance',
    title: 'Регулировка тепловых зазоров клапанов',
    group: 'engine',
    factory: { km: 90_000, months: 60 },
    forum: { km: 45_000, months: 36 },
    advice:
      'Только для 8-клапанных моторов (гидрокомпенсаторов нет). Признак — звонкий цокот на прогретом двигателе; на форумах регулируют каждые 45 000–60 000 км.',
    engines: ['11182', '11186'],
    keywords: ['клапан', 'зазор'],
    severity: 'normal',
    cost: [2_500, 5_000],
  },
  {
    id: 'oxygen-sensor',
    title: 'Датчик кислорода (лямбда-зонд)',
    group: 'engine',
    factory: { km: 75_000 },
    forum: { km: 90_000 },
    advice:
      'Меняют по симптомам: плавающие обороты, рост расхода, ошибка по смеси. Ресурс сильно зависит от качества бензина.',
    keywords: ['кислород', 'лямбда', 'датчик кислород'],
    severity: 'normal',
    cost: [2_500, 6_000],
  },
  {
    id: 'front-pads',
    title: 'Передние тормозные колодки',
    group: 'brakes',
    factory: { km: 15_000 },
    forum: { km: 35_000 },
    advice:
      'Осмотр — на каждом ТО, реальный ресурс в городе 30 000–40 000 км. Диски обычно выдерживают два комплекта колодок.',
    keywords: ['колодк', 'тормозные диск'],
    exclude: ['задн'],
    severity: 'high',
    cost: [2_000, 5_000],
  },
  {
    id: 'rear-brakes',
    title: 'Задние барабанные механизмы и цилиндры',
    group: 'brakes',
    factory: { km: 30_000 },
    forum: { km: 60_000 },
    advice:
      'Классика Гранты: подтекающие задние цилиндры к 70 000–85 000 км и подклинивающий зимой ручник. Смотрят на подтёки на барабане и ход рычага.',
    keywords: ['задние колодк', 'барабан', 'тормозной цилиндр', 'ручник', 'стояночн'],
    severity: 'normal',
    cost: [2_500, 6_000],
  },
  {
    id: 'hub-bearings',
    title: 'Ступичные подшипники — контроль гула',
    group: 'chassis',
    factory: { km: 15_000 },
    forum: { km: 50_000 },
    advice:
      'В отзывах владельцев подшипники (особенно задние) начинают гудеть с 30 000–60 000 км, встречаются случаи и на 12 000. Проверяют по нарастающему гулу, меняют парой на оси.',
    keywords: ['ступичн', 'ступица', 'подшипник ступ'],
    severity: 'high',
    cost: [3_000, 8_000],
  },
  {
    id: 'stabilizer',
    title: 'Стойки стабилизатора',
    group: 'chassis',
    factory: { km: 15_000 },
    forum: { km: 30_000 },
    advice:
      'Самая частая «болячка» подвески: стук на мелких неровностях уже на 20 000–40 000 км. Владельцы ставят усиленные (SS20 / «люксовые») — ходят заметно дольше.',
    keywords: ['стойки стабилизатор', 'стабилизатор', 'косточк'],
    severity: 'normal',
    cost: [1_500, 4_000],
  },
  {
    id: 'cv-joints',
    title: 'ШРУСы и пыльники приводов',
    group: 'chassis',
    factory: { km: 15_000 },
    forum: { km: 60_000 },
    advice:
      'Хруст в повороте — наружный ШРУС (обычно 60 000–90 000 км). Порванный пыльник убивает шарнир за пару тысяч километров, поэтому смотрят на каждом ТО.',
    keywords: ['шрус', 'пыльник', 'граната', 'привод'],
    severity: 'normal',
    cost: [3_000, 8_000],
  },
  {
    id: 'suspension',
    title: 'Опорные подшипники и сайлентблоки рычагов',
    group: 'chassis',
    factory: { km: 45_000 },
    forum: { km: 60_000 },
    advice:
      'Скрип и стук при повороте руля на месте — опорные (50 000–70 000 км). Сайлентблоки растяжек ходят 60 000–90 000 км, после замены обязателен развал-схождение.',
    keywords: ['опорн', 'сайлентблок', 'рычаг', 'амортизатор', 'стойки передн'],
    severity: 'normal',
    cost: [4_000, 12_000],
  },
  {
    id: 'alignment',
    title: 'Развал-схождение',
    group: 'chassis',
    factory: { km: 30_000, months: 24 },
    forum: { km: 15_000, months: 12 },
    advice:
      'Делают раз в год, после ремонта подвески и при неравномерном износе резины — иначе комплект шин «съедается» за сезон.',
    keywords: ['развал', 'схождени', 'сход-развал'],
    severity: 'normal',
    cost: [1_500, 3_500],
  },
  {
    id: 'tyres',
    title: 'Сезонная смена шин и балансировка',
    group: 'docs',
    factory: { months: 6 },
    forum: { months: 6 },
    advice:
      'Дважды в год: летняя резина дубеет ниже +7 °C, зимняя «плывёт» в жару. При каждой перестановке — балансировка, раз в 2 недели — проверка давления (2,0 бар).',
    keywords: ['шин', 'резин', 'колёс', 'колес', 'переобув', 'шиномонтаж', 'балансиров'],
    severity: 'normal',
    cost: [2_000, 5_000],
  },
  {
    id: 'battery',
    title: 'Аккумулятор: проверка перед зимой',
    group: 'docs',
    factory: { months: 12 },
    forum: { months: 12 },
    advice:
      'Осенью проверяют напряжение и плотность, чистят клеммы. Штатная батарея редко живёт дольше 4 лет — на морозе это первый кандидат на отказ.',
    keywords: ['аккумулятор', 'акб', 'клемм'],
    severity: 'normal',
    cost: [500, 8_000],
  },
  {
    id: 'anticorrosion',
    title: 'Антикор и осмотр кузова',
    group: 'body',
    factory: { months: 12 },
    forum: { months: 12 },
    advice:
      'Тонкое ЛКП — главная претензия к Гранте: «рыжики» на задних арках, порогах и кромке капота. Осмотр осенью, сколы подкрашивают сразу, скрытые полости обрабатывают раз в год.',
    keywords: ['антикор', 'коррози', 'ржавчин', 'кузов', 'подкрас'],
    severity: 'normal',
    cost: [3_000, 15_000],
  },
  {
    id: 'ac',
    title: 'Обслуживание кондиционера',
    group: 'body',
    factory: { months: 24 },
    forum: { months: 24 },
    advice:
      'Раз в два года — проверка давления и дозаправка, чистка испарителя от запаха. Зимой кондиционер включают раз в месяц, чтобы не сохли сальники компрессора.',
    keywords: ['кондиционер', 'фреон', 'испарител'],
    severity: 'normal',
    cost: [2_500, 6_000],
  },
  {
    id: 'inspection',
    title: 'Диагностическая карта (техосмотр)',
    group: 'docs',
    factory: { months: 24 },
    forum: { months: 24 },
    advice:
      'Для личных легковых автомобилей карта не нужна для ОСАГО, но обязательна при регистрации авто старше 4 лет и смене собственника, а также для такси и юрлиц.',
    keywords: ['техосмотр', 'диагностическая карта', 'гто'],
    severity: 'normal',
    cost: [1_000, 2_500],
  },
]

/** Работы, актуальные для выбранного двигателя */
export const itemsForEngine = (engine: EngineId): ServiceItem[] =>
  SERVICE_ITEMS.filter((i) => !i.engines || i.engines.includes(engine))

/* ------------------------------------------------------------------ */
/*  Расчёт статуса работ                                               */
/* ------------------------------------------------------------------ */

export type ServiceState = 'ok' | 'soon' | 'due' | 'overdue'

export interface ServiceStatus {
  item: ServiceItem
  interval: Interval
  /** Пробег и дата последнего выполнения (из журнала ТО) */
  lastKm: number | null
  lastDate: string | null
  /** true — точки отсчёта в журнале нет, взята оценка по регламенту */
  estimated: boolean
  dueKm: number | null
  dueDate: string | null
  remainingKm: number | null
  remainingDays: number | null
  /** 0…1 — израсходованный ресурс (худшее из пробега и срока) */
  progress: number
  state: ServiceState
  /** Запись журнала, по которой определено последнее выполнение */
  record: MaintenanceRecord | null
}

const norm = (s: string): string => s.toLowerCase().replace(/ё/g, 'е')

/** Относится ли запись журнала к этой работе */
export function recordMatches(item: ServiceItem, description: string): boolean {
  const text = norm(description)
  if (item.exclude?.some((w) => text.includes(norm(w)))) return false
  return item.keywords.some((w) => text.includes(norm(w)))
}

export const intervalFor = (item: ServiceItem, mode: PlanMode): Interval =>
  mode === 'factory' ? item.factory : { ...item.factory, ...item.forum }

/** Порог «скоро»: 20% ресурса, но не больше 2 000 км / 45 дней */
const SOON_RATIO = 0.8

export interface ServiceContext {
  mileage: number
  mode: PlanMode
  engine: EngineId
  maintenance: MaintenanceRecord[]
  /** Дата покупки / начала владения — точка отсчёта для интервалов по времени */
  purchaseDate?: string | null
  /**
   * Известные даты выполнения по id работы — для того, что не попадает
   * в журнал ТО (сезонная смена шин, диагностическая карта и т. п.).
   */
  overrides?: Record<string, { date?: string | null; km?: number | null } | undefined>
  today?: Date
}

export function computeServiceStatus(item: ServiceItem, ctx: ServiceContext): ServiceStatus {
  const today = ctx.today ?? new Date()
  const interval = intervalFor(item, ctx.mode)

  // последняя запись журнала, подходящая под эту работу
  const record =
    [...ctx.maintenance]
      .filter((m) => recordMatches(item, m.description))
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null

  const override = ctx.overrides?.[item.id]
  let lastKm: number | null = record?.mileage ?? override?.km ?? null
  let lastDate: string | null = record?.date ?? override?.date ?? null
  let estimated = false

  // Автоподстановка: записи нет — считаем, что работу делали «по регламенту»,
  // то есть на ближайшей меньшей отметке интервала. Это даёт осмысленный план
  // сразу после ввода пробега, а плашка «оценка» честно об этом предупреждает.
  if (lastKm === null && interval.km) {
    lastKm = Math.max(0, Math.floor(ctx.mileage / interval.km) * interval.km)
    estimated = true
  }
  if (lastDate === null && interval.months) {
    const base = ctx.purchaseDate ? new Date(ctx.purchaseDate + 'T00:00:00') : null
    if (base && !Number.isNaN(base.getTime())) {
      const monthsOwned = Math.max(
        0,
        (today.getFullYear() - base.getFullYear()) * 12 + (today.getMonth() - base.getMonth()),
      )
      const passed = Math.floor(monthsOwned / interval.months) * interval.months
      lastDate = toDateInputValue(addMonths(base, passed))
      estimated = true
    }
  }

  const dueKm = interval.km && lastKm !== null ? lastKm + interval.km : null
  const dueDateObj =
    interval.months && lastDate
      ? addMonths(new Date(lastDate + 'T00:00:00'), interval.months)
      : null
  const dueDate = dueDateObj ? toDateInputValue(dueDateObj) : null

  const remainingKm = dueKm === null ? null : dueKm - ctx.mileage
  const remainingDays =
    dueDateObj === null
      ? null
      : Math.round(
          (dueDateObj.getTime() -
            new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
            86_400_000,
        )

  const kmProgress =
    interval.km && lastKm !== null ? (ctx.mileage - lastKm) / interval.km : 0
  const dayProgress =
    interval.months && lastDate && dueDateObj
      ? 1 -
        (dueDateObj.getTime() - today.getTime()) /
          (dueDateObj.getTime() - new Date(lastDate + 'T00:00:00').getTime())
      : 0
  const progress = Math.max(0, Math.min(1.4, Math.max(kmProgress, dayProgress)))

  let state: ServiceState = 'ok'
  if (progress >= 1) state = 'overdue'
  else if (progress >= 0.95) state = 'due'
  else if (progress >= SOON_RATIO) state = 'soon'

  return {
    item,
    interval,
    lastKm,
    lastDate,
    estimated,
    dueKm,
    dueDate,
    remainingKm,
    remainingDays,
    progress,
    state,
    record,
  }
}

/** Полный план для выбранного двигателя, отсортированный по срочности */
export function buildServicePlan(ctx: ServiceContext): ServiceStatus[] {
  return itemsForEngine(ctx.engine)
    .map((item) => computeServiceStatus(item, ctx))
    .sort((a, b) => b.progress - a.progress)
}

export const STATE_META: Record<
  ServiceState,
  { label: string; color: string; border: string; bg: string }
> = {
  overdue: { label: 'Просрочено', color: '#EF4444', border: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  due: { label: 'Пора делать', color: '#F5A623', border: '#F5A623', bg: 'rgba(245,166,35,0.12)' },
  soon: { label: 'Скоро', color: '#F5A623', border: '#F5A623', bg: 'rgba(245,166,35,0.08)' },
  ok: { label: 'В норме', color: '#16B374', border: '#363B43', bg: 'rgba(22,179,116,0.08)' },
}

/* ------------------------------------------------------------------ */
/*  Карта ТО по пробегу (ТО-1 … ТО-8)                                  */
/* ------------------------------------------------------------------ */

export interface PlanStop {
  /** Номер ТО */
  index: number
  km: number
  items: ServiceItem[]
}

/** Регламентные «остановки» каждые 15 000 км: что делают на каждом ТО */
export function buildMileagePlan(engine: EngineId, mode: PlanMode, stops = 8): PlanStop[] {
  const items = itemsForEngine(engine)
  const result: PlanStop[] = []
  for (let i = 1; i <= stops; i++) {
    const km = i * 15_000
    const due = items.filter((item) => {
      const interval = intervalFor(item, mode)
      if (!interval.km) return false
      // работа попадает на эту отметку, если интервал кратен пробегу (с допуском 7 500 км)
      const step = Math.max(15_000, Math.round(interval.km / 15_000) * 15_000)
      return km % step === 0
    })
    result.push({ index: i, km, items: due })
  }
  return result
}

/* ------------------------------------------------------------------ */
/*  «Болячки» Гранты: за чем следят владельцы                          */
/* ------------------------------------------------------------------ */

export interface KnownIssue {
  id: string
  title: string
  /** Симптом, по которому владельцы это ловят */
  symptom: string
  /** Типичный пробег появления, км */
  fromKm: number
  toKm: number
  action: string
}

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    id: 'pump',
    title: 'Помпа системы охлаждения',
    symptom: 'Вой/шелест со стороны ремня ГРМ, капли антифриза под защитой, запах ОЖ.',
    fromKm: 15_000,
    toKm: 60_000,
    action: 'Проверять уровень антифриза каждую заправку, менять помпу вместе с ремнём ГРМ.',
  },
  {
    id: 'hub',
    title: 'Ступичные подшипники (чаще задние)',
    symptom: 'Нарастающий гул на 60–80 км/ч, меняющийся при перестроении.',
    fromKm: 30_000,
    toKm: 70_000,
    action: 'Слушать на пустой дороге, менять парой на оси; ставят SKF/EPK вместо штатных.',
  },
  {
    id: 'stabilizer',
    title: 'Стойки стабилизатора',
    symptom: 'Стук «по мелочи» спереди на плохом асфальте и лежачих полицейских.',
    fromKm: 20_000,
    toKm: 40_000,
    action: 'Проверять люфт руками на яме, менять на усиленные — ходят вдвое дольше.',
  },
  {
    id: 'support',
    title: 'Опорные подшипники передних стоек',
    symptom: 'Скрип и хруст при вращении руля на месте.',
    fromKm: 50_000,
    toKm: 70_000,
    action: 'Менять парой вместе с отбойниками и пыльниками, затем развал-схождение.',
  },
  {
    id: 'cv',
    title: 'Наружные ШРУСы',
    symptom: 'Хруст при повороте под нагрузкой, разрыв пыльника и разбросанная смазка.',
    fromKm: 60_000,
    toKm: 90_000,
    action: 'Смотреть пыльники на каждом ТО — порванный убивает шарнир за 2–3 тыс. км.',
  },
  {
    id: 'rear-cylinders',
    title: 'Задние тормозные цилиндры',
    symptom: 'Подтёки на барабане, «ватная» педаль, зимой подклинивает ручник.',
    fromKm: 70_000,
    toKm: 100_000,
    action: 'Менять тормозную жидкость раз в 2 года — цилиндры живут заметно дольше.',
  },
  {
    id: 'corrosion',
    title: 'Коррозия кузова («рыжики»)',
    symptom: 'Задние арки, пороги, кромка капота и крышки багажника, сколы от камней.',
    fromKm: 0,
    toKm: 60_000,
    action: 'Осматривать весной и осенью, подкрашивать сколы сразу, раз в год — антикор.',
  },
  {
    id: 'gearbox',
    title: 'Хруст и гул МКПП',
    symptom: 'Хруст при включении второй передачи, гул подшипников на нейтрали.',
    fromKm: 60_000,
    toKm: 120_000,
    action: 'Замена масла в коробке часто убирает гул; хруст — синхронизатор, диагностика.',
  },
  {
    id: 'coils',
    title: 'Катушки зажигания (16V)',
    symptom: 'Троение на холодную, ошибка пропусков зажигания, дёрганье при разгоне.',
    fromKm: 60_000,
    toKm: 120_000,
    action: 'Возить запасную катушку, не затягивать с заменой свечей.',
  },
  {
    id: 'wipers',
    title: 'Трапеция и моторчик стеклоочистителей',
    symptom: 'Один дворник «ленится» после зимы, скрип и заедание в крайнем положении.',
    fromKm: 30_000,
    toKm: 100_000,
    action: 'Чистить дренаж под лобовым, не включать примёрзшие дворники.',
  },
]

/* ------------------------------------------------------------------ */
/*  Сезонные чек-листы                                                 */
/* ------------------------------------------------------------------ */

export interface SeasonCheck {
  season: 'winter' | 'summer'
  title: string
  items: string[]
}

export const SEASON_CHECKS: SeasonCheck[] = [
  {
    season: 'winter',
    title: 'Подготовка к зиме (октябрь–ноябрь)',
    items: [
      'Зимняя резина до устойчивых +5 °C, давление 2,0 бар — на морозе падает',
      'Аккумулятор: напряжение, клеммы, возраст (после 4 лет — зона риска)',
      'Антифриз: плотность и уровень, состояние патрубков и термостата',
      'Незамерзайка −30 °C, щётки стеклоочистителя, чистый дренаж под лобовым',
      'Не ставить на ручник в мороз — задние колодки примерзают к барабанам',
      'Замки и уплотнители дверей — силиконовая смазка',
    ],
  },
  {
    season: 'summer',
    title: 'Подготовка к лету (апрель–май)',
    items: [
      'Летняя резина, балансировка и развал-схождение после зимних ям',
      'Кондиционер: проверка давления, чистка испарителя, салонный фильтр',
      'Система охлаждения: радиатор от тополиного пуха, вентилятор, уровень ОЖ',
      'Мойка днища и арок от реагентов, осмотр порогов на «рыжики»',
      'Тормоза после зимы: задние барабаны, тросик ручника, толщина колодок',
    ],
  },
]
