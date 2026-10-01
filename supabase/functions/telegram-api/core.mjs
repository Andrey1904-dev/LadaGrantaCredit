/**
 * Ядро бота LADA Assistant.
 *
 * Одна и та же логика используется двумя транспортами:
 *   1. `bot/server.mjs` — Node.js long-polling сервис (npm run bot:start);
 *   2. `supabase/functions/telegram-api/` — Supabase Edge Function (webhook).
 *
 * Здесь нет ничего платформенно-зависимого: только `fetch` и чистые функции
 * из `format.mjs`. Поэтому файл можно копировать в каталог edge-функции —
 * синхронность копий проверяет тест `tests/telegram.test.mjs`.
 */
import {
  createLinkCode,
  daysUntil,
  escapeHtml,
  formatDate,
  formatMileage,
  formatMoney,
  hashLinkCode,
  miniAppMenuButton,
  miniAppUrl,
  monthTransactions,
  nextPaymentDate,
  normalizeLinkCode,
  plural,
  remainingLoanBalance,
} from './format.mjs'

/** Сколько живёт одноразовый код привязки. */
export const CODE_TTL_MS = 10 * 60 * 1000
/** Формат кода без дефиса: 10 символов A-Z0-9. */
export const LINK_CODE_PATTERN = /^[A-Z0-9]{10}$/

export const CATEGORY_LABELS = {
  fuel: 'Топливо',
  loan: 'Автокредит',
  maintenance: 'ТО и сервис',
  insurance: 'Страхование',
  other: 'Прочее',
}
const CATEGORY_EMOJI = {
  fuel: '⛽',
  loan: '💳',
  maintenance: '🧰',
  insurance: '🛡',
  other: '📦',
}

/** Визуальный разделитель экранов бота — единый «брендовый» штрих. */
const RULE = '<b>━━━━━━━━━━━━</b>'

export const HELP_TEXT = [
  '<b>ℹ️ ПОМОЩЬ · LADA ASSISTANT</b>',
  RULE,
  '',
  '<b>Разделы кабинета</b>',
  '/garage — автомобиль и ОСАГО',
  '/service — записи ТО и документы',
  '/spending — расходы текущего месяца',
  '/credit — остаток и дата платежа',
  '',
  '<b>Управление</b>',
  '/menu — главное меню',
  '/link — подключить личный кабинет',
  '/unlink — отозвать доступ',
  '',
  '<i>Подсказка: работают и слова — «гараж», «то», «расходы», «кредит», «меню».</i>',
].join('\n')

export const BOT_DESCRIPTION =
  'Персональный помощник владельца LADA Granta и Vesta. Сводки об автомобиле, ТО, расходах и автокредите — из вашего личного кабинета. Безопасное подключение по одноразовому коду.'
export const BOT_SHORT_DESCRIPTION = 'Цифровой гараж LADA: автомобиль, ТО, расходы и кредит.'
export const BOT_COMMANDS = [
  { command: 'start', description: 'Главное меню' },
  { command: 'menu', description: 'Главное меню' },
  { command: 'garage', description: 'Автомобиль и ОСАГО' },
  { command: 'service', description: 'ТО и документы' },
  { command: 'spending', description: 'Расходы за месяц' },
  { command: 'credit', description: 'Остаток и платёж по кредиту' },
  { command: 'link', description: 'Подключить личный кабинет' },
  { command: 'unlink', description: 'Отключить личный кабинет' },
  { command: 'help', description: 'Список команд' },
]

/** Ошибка с HTTP-статусом: транспорты превращают её в JSON-ответ. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function makeSearch(values) {
  return new URLSearchParams(values).toString()
}

/** Достаёт токен из заголовка `Authorization: Bearer …`. */
export function readBearerToken(headerValue) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(String(headerValue ?? '').trim())
  if (!match || match[1].length > 8_192) return null
  return match[1]
}

/**
 * Экран, который показываем, пока кабинет не привязан.
 * Рядом всегда кнопка мгновенной генерации кода — один тап вместо команды.
 */
export function unlinkedMessage() {
  return [
    '<b>🔒 Сначала подключите сайт</b>',
    RULE,
    '',
    'Сводки появятся прямо здесь, как только Telegram будет связан с кабинетом.',
    'Пароль сайта не нужен — только одноразовый код на 10 минут.',
    '',
    '<i>Нажмите «Подключить кабинет» — бот пришлёт код — и введите его в разделе «Бот» на сайте.</i>',
  ].join('\n')
}

/** Заголовок экрана: эмодзи + капсовый тайтл + фирменная линия. */
function screenTitle(emoji, title) {
  return [`<b>${emoji} ${title.toUpperCase()}</b>`, RULE, '']
}

/** Строка показателя: иконка, подпись и значение. */
function statLine(icon, label, value) {
  return `${icon} ${label} — <b>${escapeHtml(value)}</b>`
}

/** Текстовый прогресс-бар: ratio в диапазоне 0…1, слотов `slots`. */
export function progressBar(ratio, slots = 10) {
  const clamped = Math.min(1, Math.max(0, Number(ratio) || 0))
  // Доля больше нуля всегда видна: иначе 4 % выглядит как сломанный пустой бар.
  const filled = clamped > 0 ? Math.max(1, Math.round(clamped * slots)) : 0
  return '▰'.repeat(filled) + '▱'.repeat(Math.max(0, slots - filled))
}

const monthNominative = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  timeZone: 'Europe/Moscow',
})

/** Строка статуса ОСАГО со «светофором» и обратным отсчётом. */
function insuranceStatusLine(insuranceUntil, now = new Date()) {
  const remaining = daysUntil(insuranceUntil, now)
  if (remaining === null) return ['🛡 ОСАГО — дата окончания не указана', '']
  const until = escapeHtml(formatDate(insuranceUntil))
  if (remaining < 0) {
    const days = Math.abs(remaining)
    return [
      `🔴 ОСАГО — истёк ${days} ${plural(days, 'день', 'дня', 'дней')} назад`,
      `<i>Продлите полис: езда без ОСАГО — штраф и полная оплата чужого ремонта при ДТП.</i>`,
    ]
  }
  if (remaining === 0) return ['🟡 ОСАГО — срок заканчивается сегодня', '<i>Успейте продлить полис сегодня.</i>']
  const left = plural(remaining, 'день', 'дня', 'дней')
  if (remaining <= 30) {
    return [
      `🟡 ОСАГО — до ${until} · осталось ${remaining} ${left}`,
      '<i>Срок на исходе — стоит продлить заранее.</i>',
    ]
  }
  return [`🟢 ОСАГО — до ${until} · в запасе ${remaining} ${left}`, '']
}

/**
 * Собирает ядро бота.
 *
 * @param {object} options
 * @param {string} options.telegramToken          токен BotFather (только на сервере)
 * @param {string} options.supabaseUrl            адрес проекта Supabase
 * @param {string} options.supabaseAnonKey        anon/publishable ключ (проверка сессии сайта)
 * @param {string} options.supabaseServiceRoleKey service-role ключ (чтение таблиц связей)
 * @param {string} [options.webAppUrl]            публичный адрес кабинета
 * @param {typeof fetch} [options.fetchImpl]      подмена fetch в тестах
 * @param {() => number} [options.now]            подмена часов в тестах
 */
export function createBot({
  telegramToken,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  webAppUrl = '',
  fetchImpl = fetch,
  logger = console,
  now = () => Date.now(),
}) {
  if (!telegramToken) throw new Error('Не задан TELEGRAM_BOT_TOKEN.')
  if (!supabaseUrl) throw new Error('Не задан SUPABASE_URL.')
  if (!supabaseAnonKey) throw new Error('Не задан SUPABASE_ANON_KEY.')
  if (!supabaseServiceRoleKey) throw new Error('Не задан SUPABASE_SERVICE_ROLE_KEY.')

  const restBase = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1`
  const authBase = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`

  /** POST в Telegram Bot API. */
  async function telegramCall(method, payload = {}, timeoutMs = 18_000) {
    let response
    try {
      response = await fetchImpl(`https://api.telegram.org/bot${telegramToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new Error(`Telegram API connection failed: ${error instanceof Error ? error.message : 'network error'}`)
    }
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.ok) {
      const description = typeof data?.description === 'string' ? data.description : `HTTP ${response.status}`
      throw new Error(`Telegram API ${method}: ${description}`)
    }
    return data.result
  }

  /** Запрос к PostgREST под service-role ключом. */
  async function supabaseRest(path, { method = 'GET', body, prefer } = {}) {
    let response
    try {
      response = await fetchImpl(`${restBase}/${path}`, {
        method,
        headers: {
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(prefer ? { Prefer: prefer } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20_000),
      })
    } catch (error) {
      logger.error?.('[supabase] request failed:', error instanceof Error ? error.message : 'network error')
      throw new ApiError(502, 'Сервис данных временно недоступен. Попробуйте ещё раз.')
    }

    const text = await response.text()
    if (!response.ok) {
      logger.error?.(`[supabase] REST returned ${response.status}`)
      throw new ApiError(502, 'Не удалось получить данные кабинета.')
    }
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  /** Проверяет access token сайта через Supabase Auth. */
  async function verifySiteSession(accessToken) {
    if (!accessToken) {
      throw new ApiError(401, 'Войдите в облачный аккаунт сайта и повторите попытку.')
    }
    let response
    try {
      response = await fetchImpl(`${authBase}/user`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(12_000),
      })
    } catch {
      throw new ApiError(502, 'Не удалось проверить сессию сайта. Попробуйте ещё раз.')
    }
    if (!response.ok) throw new ApiError(401, 'Сессия сайта истекла. Войдите в аккаунт повторно.')
    const user = await response.json().catch(() => null)
    if (!user || typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id)) {
      throw new ApiError(401, 'Не удалось подтвердить аккаунт сайта.')
    }
    return user
  }

  /* ------------------------------------------------------------------ API --- */

  async function linkStatus(accessToken) {
    const user = await verifySiteSession(accessToken)
    const query = makeSearch({ select: 'linked_at', user_id: `eq.${user.id}`, limit: '1' })
    const rows = await supabaseRest(`telegram_links?${query}`)
    const linked = Array.isArray(rows) && rows.length > 0
    return {
      linked,
      ...(linked && rows[0].linked_at ? { linkedAt: rows[0].linked_at } : {}),
    }
  }

  /** Привязывает код к уже проверенному аккаунту сайта. */
  async function confirmLinkForUser(userId, rawCode) {
    const code = normalizeLinkCode(rawCode)
    if (!LINK_CODE_PATTERN.test(code)) {
      throw new ApiError(400, 'Введите полный одноразовый код из Telegram.')
    }
    const result = await supabaseRest('rpc/link_telegram_account', {
      method: 'POST',
      body: { p_code_hash: hashLinkCode(code), p_user_id: userId },
    })
    if (result !== true) {
      throw new ApiError(400, 'Код недействителен или истёк. Запросите новый командой /link.')
    }
    return { linked: true }
  }

  async function confirmLink(accessToken, rawCode) {
    const user = await verifySiteSession(accessToken)
    return confirmLinkForUser(user.id, rawCode)
  }

  async function unlink(accessToken) {
    const user = await verifySiteSession(accessToken)
    const query = makeSearch({ user_id: `eq.${user.id}` })
    await supabaseRest(`telegram_links?${query}`, { method: 'DELETE' })
    return { linked: false }
  }

  /* ------------------------------------------------------- Telegram flow --- */

  function siteAssetUrl(path) {
    if (!webAppUrl) return ''
    try {
      const base = new URL(webAppUrl)
      base.hash = ''
      base.search = ''
      if (!base.pathname.endsWith('/')) base.pathname += '/'
      return new URL(path, base).toString()
    } catch {
      return ''
    }
  }

  /** Адрес Mini App (кабинет на сайте); '' — если WEB_APP_URL не задан или не HTTPS. */
  function siteCabinetUrl(screen = '') {
    return miniAppUrl(webAppUrl, screen)
  }

  /**
   * Кнопка запуска кабинета как Telegram Mini App (тип `web_app`, не `url`).
   * Бот работает только в личных чатах, где такие кнопки поддерживаются.
   */
  function cabinetRow(screen = '', text = '📱 Открыть кабинет') {
    const url = siteCabinetUrl(screen)
    return url ? [[{ text, web_app: { url } }]] : []
  }

  /**
   * Клавиатура для чата, который ещё не привязан:
   * код генерируется одним тапом — команда /link сама не нужна.
   */
  function connectKeyboard() {
    return { inline_keyboard: [[{ text: '🔗 Подключить кабинет', callback_data: 'link' }], ...cabinetRow()] }
  }

  /** Главное меню: четыре раздела кабинета + кабинет на сайте. */
  function mainKeyboard(linked = true) {
    const rows = []
    if (!linked) rows.push([{ text: '🔗 Подключить кабинет', callback_data: 'link' }])
    rows.push(
      [
        { text: '🚘 Гараж', callback_data: 'garage' },
        { text: '🧰 ТО и документы', callback_data: 'service' },
      ],
      [
        { text: '📊 Расходы', callback_data: 'spending' },
        { text: '💳 Автокредит', callback_data: 'credit' },
      ],
      ...cabinetRow(),
    )
    return { inline_keyboard: rows }
  }

  /**
   * Контекстная клавиатура экрана раздела: соседние разделы,
   * «Обновить» текущий и возврат в меню. Всё — в рамках одного сообщения.
   */
  function sectionKeyboard(current) {
    const sections = [
      ['garage', '🚘 Гараж'],
      ['service', '🧰 ТО'],
      ['spending', '📊 Расходы'],
      ['credit', '💳 Кредит'],
    ].filter(([key]) => key !== current)
    return {
      inline_keyboard: [
        sections.map(([key, label]) => ({ text: label, callback_data: key })),
        [
          { text: '↻ Обновить', callback_data: current },
          { text: '🏠 Меню', callback_data: 'menu' },
        ],
        ...cabinetRow(),
      ],
    }
  }

  async function sendMessage(chatId, text, extra = {}) {
    return telegramCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    })
  }

  /** Индикатор «печатает…», пока идёт чтение кабинета. Ошибки игнорируем. */
  async function sendTyping(chatId) {
    try {
      await telegramCall('sendChatAction', { chat_id: chatId, action: 'typing' })
    } catch {
      // Индикатор не критичен: молча продолжаем.
    }
  }

  /**
   * «Живой экран»: редактирует сообщение по месту вместо нового в чате.
   * Если телеграм не даёт редактировать (старое сообщение, фото с подписью) —
   * отправляет свежее сообщение. Дубль («not modified») молча проглатываем.
   */
  async function updateScreen(chatId, messageId, text, markup) {
    try {
      await telegramCall('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: markup,
      })
      return true
    } catch (error) {
      const reason = error instanceof Error ? error.message : ''
      if (/not modified/i.test(reason)) return true
      await sendMessage(chatId, text, { reply_markup: markup })
      return false
    }
  }

  async function getLinkedUserId(chatId) {
    const query = makeSearch({ select: 'user_id', telegram_chat_id: `eq.${chatId}`, limit: '1' })
    const rows = await supabaseRest(`telegram_links?${query}`)
    return Array.isArray(rows) && rows[0] ? rows[0].user_id : null
  }

  async function readUserRows(table, userId, select, extra = {}) {
    const query = makeSearch({ select, user_id: `eq.${userId}`, ...extra })
    return supabaseRest(`${table}?${query}`)
  }

  async function ownerData(chatId, include = []) {
    const userId = await getLinkedUserId(chatId)
    if (!userId) return null
    const tasks = include.map(async (key) => {
      if (key === 'car') {
        const rows = await readUserRows('cars', userId, 'id,current_mileage,insurance_until,created_at', {
          order: 'created_at.asc',
          limit: '1',
        })
        return ['car', Array.isArray(rows) ? rows[0] ?? null : null]
      }
      if (key === 'loan') {
        const rows = await readUserRows('loans', userId, 'total_amount,interest_rate,monthly_payment,term_months,start_date,created_at', {
          order: 'created_at.asc',
          limit: '1',
        })
        return ['loan', Array.isArray(rows) ? rows[0] ?? null : null]
      }
      if (key === 'transactions') {
        const rows = await readUserRows('transactions', userId, 'amount,category,date', {
          order: 'date.desc',
          limit: '600',
        })
        return ['transactions', Array.isArray(rows) ? rows : []]
      }
      if (key === 'maintenance') {
        const rows = await readUserRows('maintenance', userId, 'date,mileage,description', {
          order: 'date.desc',
          limit: '5',
        })
        return ['maintenance', Array.isArray(rows) ? rows : []]
      }
      return [key, null]
    })
    const fields = await Promise.all(tasks)
    return Object.fromEntries([['userId', userId], ...fields])
  }

  /* ------------------------------------------------------- Screen builders --- */
  /* Каждый экран возвращает { text, markup } — дальше один и тот же экран     */
  /* приходит новым сообщением (команда) или редактирует старое (кнопка).      */

  function menuScreen(linked) {
    const lines = [
      '<b>🏁 LADA ASSISTANT</b>  <i>· цифровой гараж Granta и Vesta</i>',
      RULE,
      '',
    ]
    if (linked) {
      lines.push(
        '🚘 <b>Гараж</b> — пробег и статус ОСАГО',
        '🧰 <b>ТО</b> — журнал обслуживания и документы',
        '📊 <b>Расходы</b> — траты текущего месяца',
        '💳 <b>Кредит</b> — долг и ближайший платёж',
        '',
        '<i>Выберите раздел кнопкой — экран обновится на месте, без лишних сообщений.</i>',
      )
    } else {
      lines.push(
        'Меню оболочки уже готово. Подключите кабинет кнопкой ниже —',
        'и сводки автомобиля, ТО, расходов и кредита появятся прямо здесь.',
        '',
        '<i>Можно заглянуть в разделы и до привязки — бот подскажет, что делать.</i>',
      )
    }
    return { text: lines.join('\n'), markup: mainKeyboard(linked) }
  }

  const UNLINK_CONFIRM_TEXT = [
    '<b>⛓ ОТКЛЮЧИТЬ КАБИНЕТ?</b>',
    RULE,
    '',
    'Бот потеряет доступ к сводкам автомобиля, ТО, расходов и кредита.',
    'На сайте данные останутся — отключается только Telegram.',
    '',
    '<i>Подключить обратно можно в любой момент по новому коду.</i>',
  ].join('\n')

  const UNLINK_CONFIRM_MARKUP = {
    inline_keyboard: [
      [{ text: '❌ Да, отключить доступ', callback_data: 'unlink_confirm' }],
      [{ text: '◂ Назад в меню', callback_data: 'menu' }],
    ],
  }

  function emptyScreen(text) {
    return { text, markup: mainKeyboard(true) }
  }

  async function buildGarageScreen(chatId) {
    const data = await ownerData(chatId, ['car'])
    if (!data) return { text: unlinkedMessage(), markup: connectKeyboard() }
    if (!data.car) {
      return emptyScreen([
        ...screenTitle('🚘', 'Мой гараж'),
        '<b>Гараж пока пуст.</b>',
        'Добавьте автомобиль в кабинете на сайте — сводка появится здесь автоматически.',
      ].join('\n'))
    }
    const [insurance, insuranceHint] = insuranceStatusLine(data.car.insurance_until, new Date(now()))
    const lines = [
      ...screenTitle('🚘', 'Мой гараж'),
      '<b>LADA Granta / Vesta</b>',
      statLine('🏁', 'Пробег', formatMileage(data.car.current_mileage)),
      insurance,
    ]
    if (insuranceHint) lines.push(insuranceHint)
    lines.push('', '<i>Синхронизировано с личным кабинетом.</i>')
    return { text: lines.join('\n'), markup: sectionKeyboard('garage') }
  }

  async function buildServiceScreen(chatId) {
    const data = await ownerData(chatId, ['car', 'maintenance'])
    if (!data) return { text: unlinkedMessage(), markup: connectKeyboard() }
    const lines = screenTitle('🧰', 'ТО и документы')
    if (data.car) {
      const [insurance, insuranceHint] = insuranceStatusLine(data.car.insurance_until, new Date(now()))
      lines.push(insurance)
      if (insuranceHint) lines.push(insuranceHint)
      lines.push('', RULE, '')
    }
    if (data.maintenance.length) {
      lines.push('<b>Последние работы</b>')
      for (const record of data.maintenance.slice(0, 4)) {
        const description = escapeHtml(record.description || 'Работы без описания')
        lines.push(`▸ ${description}\n   ${escapeHtml(formatMileage(record.mileage))} · ${escapeHtml(formatDate(record.date))}`)
      }
      lines.push('', '<i>Полный журнал и регламент ТО — в разделе «ТО» кабинета.</i>')
    } else {
      lines.push(
        '<b>Журнал обслуживания пока пуст.</b>',
        'Добавляйте записи в разделе «ТО» на сайте — они появятся здесь.',
      )
    }
    return { text: lines.join('\n'), markup: sectionKeyboard('service') }
  }

  async function buildSpendingScreen(chatId) {
    const data = await ownerData(chatId, ['transactions'])
    if (!data) return { text: unlinkedMessage(), markup: connectKeyboard() }
    const rows = monthTransactions(data.transactions, new Date(now()))
    const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const byCategory = new Map()
    for (const item of rows) {
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + Number(item.amount || 0))
    }
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    const monthName = String(monthNominative.format(new Date(now()))).toUpperCase()
    const lines = [
      ...screenTitle('📊', `Расходы · ${monthName}`),
      `Итого: <b>${escapeHtml(formatMoney(total))}</b> · ${rows.length} ${plural(rows.length, 'операция', 'операции', 'операций')}`,
      '',
    ]
    if (top.length && total > 0) {
      for (const [category, amount] of top) {
        const label = CATEGORY_LABELS[category] ?? 'Прочее'
        const emoji = CATEGORY_EMOJI[category] ?? '📦'
        const share = Math.round((amount / total) * 100)
        lines.push(
          `${emoji} ${progressBar(amount / total, 8)} <b>${escapeHtml(label)}</b> — ${escapeHtml(formatMoney(amount))} · ${share}%`,
        )
      }
    } else if (top.length) {
      for (const [category, amount] of top) {
        const label = CATEGORY_LABELS[category] ?? 'Прочее'
        lines.push(`▸ ${escapeHtml(label)} — ${escapeHtml(formatMoney(amount))}`)
      }
    } else {
      lines.push('В этом месяце расходов пока нет — отличный повод ничего не ломать.', '')
    }
    lines.push('', '<i>По операциям кабинета за текущий месяц.</i>')
    return { text: lines.join('\n'), markup: sectionKeyboard('spending') }
  }

  async function buildCreditScreen(chatId) {
    const data = await ownerData(chatId, ['loan', 'transactions'])
    if (!data) return { text: unlinkedMessage(), markup: connectKeyboard() }
    if (!data.loan) {
      return emptyScreen([
        ...screenTitle('💳', 'Автокредит'),
        '<b>Кредит не добавлен.</b>',
        'Укажите его в кабинете на сайте — остаток и даты платежей будут здесь.',
      ].join('\n'))
    }
    const paidMonths = data.transactions.filter((item) => item.category === 'loan').length
    const term = Math.round(Number(data.loan.term_months)) || 0
    const balance = remainingLoanBalance(
      data.loan.total_amount,
      data.loan.interest_rate,
      data.loan.term_months,
      paidMonths,
      data.loan.monthly_payment,
    )
    const paymentDate = nextPaymentDate(data.loan.start_date, new Date(now()))
    const progress = term > 0 ? Math.min(1, paidMonths / term) : 0
    const percent = Math.round(progress * 100)
    const lines = [
      ...screenTitle('💳', 'Автокредит'),
      `${progressBar(progress, 16)} <b>${percent}%</b>`,
      '',
      statLine('🏦', 'Расчётный остаток', formatMoney(balance)),
      statLine('📅', 'Ежемесячный платёж', formatMoney(data.loan.monthly_payment)),
    ]
    if (term > 0) {
      const shown = Math.min(paidMonths, term)
      lines.push(`✅ Внесено — <b>${shown} из ${term}</b> ${plural(term, 'платежа', 'платежей', 'платежей')}`)
    }
    if (paymentDate) {
      const inDays = daysUntil(paymentDate.toISOString().slice(0, 10), new Date(now()))
      const countdown = inDays === null
        ? ''
        : inDays < 0
          ? ''
          : inDays === 0
            ? ' · <b>сегодня</b>'
            : ` · через <b>${inDays} ${plural(inDays, 'день', 'дня', 'дней')}</b>`
      lines.push(statLine('⏳', 'Ближайший платёж', formatDate(paymentDate)) + countdown)
    }
    lines.push('', '<i>Оценка по отметкам платежей в кабинете. Точный остаток сверяйте с банком.</i>')
    return { text: lines.join('\n'), markup: sectionKeyboard('credit') }
  }

  const SCREEN_BUILDERS = {
    garage: buildGarageScreen,
    service: buildServiceScreen,
    spending: buildSpendingScreen,
    credit: buildCreditScreen,
  }

  async function showWelcome(chatId, firstName = '') {
    const userId = await getLinkedUserId(chatId)
    const name = firstName ? `, ${escapeHtml(firstName)}` : ''
    const intro = userId
      ? [
          `<b>🏁 С возвращением${name}.</b>`,
          '<i>Цифровой гараж LADA Granta и Vesta — на связи.</i>',
          RULE,
          '',
          '🚘 <b>Гараж</b> — пробег и статус ОСАГО',
          '🧰 <b>ТО</b> — журнал обслуживания',
          '📊 <b>Расходы</b> — траты месяца',
          '💳 <b>Кредит</b> — долг и ближайший платёж',
          '',
          '<i>Кнопки ниже переключают разделы на месте — чат не засоряется.</i>',
        ]
      : [
          `<b>🏁 Добро пожаловать${name}.</b>`,
          '<i>LADA Assistant — персональный помощник владельца Granta и Vesta.</i>',
          RULE,
          '',
          'Пробег и ОСАГО, история обслуживания, расходы и остаток автокредита —',
          'всё из вашего личного кабинета, прямо в этом чате.',
          '',
          '<i>Подключите кабинет кнопкой ниже — займёт меньше минуты.</i>',
        ]
    const text = intro.join('\n')
    const markup = mainKeyboard(Boolean(userId))
    const photo = siteAssetUrl('images/telegram-assistant-avatar.jpg')
    if (photo) {
      try {
        return await telegramCall('sendPhoto', {
          chat_id: chatId,
          photo,
          caption: text,
          parse_mode: 'HTML',
          reply_markup: markup,
        })
      } catch (error) {
        logger.warn?.('[telegram] branded welcome image skipped:', error instanceof Error ? error.message : 'image unavailable')
      }
    }
    return sendMessage(chatId, text, { reply_markup: markup })
  }

  async function createLink(chatId, telegramUserId) {
    if (await getLinkedUserId(chatId)) {
      return sendMessage(chatId, [
        '<b>🔗 КАБИНЕТ УЖЕ ПОДКЛЮЧЁН</b>',
        RULE,
        '',
        'Этот Telegram уже связан с кабинетом. Чтобы сменить аккаунт,',
        'сначала отключите текущий — /unlink.',
      ].join('\n'), { reply_markup: mainKeyboard(true) })
    }

    const staleCodes = makeSearch({ telegram_chat_id: `eq.${chatId}`, used_at: 'is.null' })
    await supabaseRest(`telegram_link_codes?${staleCodes}`, { method: 'DELETE' })
    const expired = makeSearch({ expires_at: `lt.${new Date(now()).toISOString()}` })
    await supabaseRest(`telegram_link_codes?${expired}`, { method: 'DELETE' })

    const code = createLinkCode()
    const expiresAt = new Date(now() + CODE_TTL_MS).toISOString()
    await supabaseRest('telegram_link_codes', {
      method: 'POST',
      body: {
        code_hash: hashLinkCode(code),
        telegram_chat_id: chatId,
        telegram_user_id: telegramUserId,
        expires_at: expiresAt,
      },
      prefer: 'return=minimal',
    })

    const formatted = `${code.slice(0, 5)}-${code.slice(5)}`
    const text = [
      '<b>🔗 КОД ПОДКЛЮЧЕНИЯ</b>',
      RULE,
      '',
      `<b><code>${formatted}</code></b>`,
      '',
      '1️⃣ Откройте сайт → раздел «Бот»',
      '2️⃣ Введите код из этого сообщения',
      '3️⃣ Сводки гаража появятся прямо здесь',
      '',
      '<i>⏱ Код одноразовый · действует 10 минут</i>',
      '<i>Не пересылайте код посторонним — это ключ к вашему кабинету.</i>',
    ].join('\n')
    const openBotSection = cabinetRow('telegram', '📱 Ввести код в кабинете')
    return sendMessage(chatId, text, { reply_markup: openBotSection.length ? { inline_keyboard: openBotSection } : undefined })
  }

  async function unlinkChat(chatId) {
    const query = makeSearch({ telegram_chat_id: `eq.${chatId}` })
    const result = await supabaseRest(`telegram_links?${query}`, {
      method: 'DELETE',
      prefer: 'return=representation',
    })
    const linked = Array.isArray(result) ? result.length > 0 : true
    if (!linked) {
      return { ok: false }
    }
    return { ok: true }
  }

  /** Отправка экрана новым сообщением (команда из чата). */
  async function sendScreen(chatId, screen) {
    return sendMessage(chatId, screen.text, { reply_markup: screen.markup })
  }

  /** Редактирование экрана по месту (inline-кнопка). */
  async function editScreen(chatId, messageId, screen) {
    return updateScreen(chatId, messageId, screen.text, screen.markup)
  }

  /** Экран по имени действия; данные — свежие, со статусом «печатает…». */
  async function runAction(chatId, action, { messageId = null, telegramUserId = null } = {}) {
    if (action === 'link') {
      return createLink(chatId, telegramUserId ?? chatId)
    }
    if (action === 'unlink') {
      // Двухшаговое отключение: сначала экран подтверждения.
      return messageId === null
        ? sendScreen(chatId, { text: UNLINK_CONFIRM_TEXT, markup: UNLINK_CONFIRM_MARKUP })
        : editScreen(chatId, messageId, { text: UNLINK_CONFIRM_TEXT, markup: UNLINK_CONFIRM_MARKUP })
    }
    if (action === 'unlink_confirm') {
      const outcome = await unlinkChat(chatId)
      const screen = outcome.ok
        ? {
            text: [
              '<b>✅ ДОСТУП ОТОЗВАН</b>',
              RULE,
              '',
              'Связь удалена: бот больше не видит данные кабинета.',
              '',
              '<i>Подключить обратно можно в любой момент — /link.</i>',
            ].join('\n'),
            markup: connectKeyboard(),
          }
        : {
            text: [
              '<b>⛓ КАБИНЕТ НЕ ПОДКЛЮЧЁН</b>',
              RULE,
              '',
              'Этот Telegram и так не связан с кабинетом.',
              '',
              '<i>Для подключения — /link или кнопка ниже.</i>',
            ].join('\n'),
            markup: connectKeyboard(),
          }
      return messageId === null ? sendScreen(chatId, screen) : editScreen(chatId, messageId, screen)
    }
    if (action === 'menu') {
      await sendTyping(chatId)
      const userId = await getLinkedUserId(chatId)
      const screen = menuScreen(Boolean(userId))
      return messageId === null ? sendScreen(chatId, screen) : editScreen(chatId, messageId, screen)
    }
    const builder = SCREEN_BUILDERS[action]
    if (builder) {
      await sendTyping(chatId)
      const screen = await builder(chatId)
      return messageId === null ? sendScreen(chatId, screen) : editScreen(chatId, messageId, screen)
    }
    return sendMessage(chatId, HELP_TEXT, { reply_markup: mainKeyboard(Boolean(await getLinkedUserId(chatId))) })
  }

  async function handleMessage(message) {
    const chat = message?.chat
    if (!chat || chat.type !== 'private' || !message.from) return
    const text = String(message.text ?? '').trim()
    if (!text) return

    const [firstToken] = text.split(/\s+/, 1)
    const command = firstToken.toLowerCase().split('@')[0]
    const word = text.toLowerCase()
    if (command === '/start' || command === '/menu' || word === 'меню' || word === 'menu') {
      return showWelcome(chat.id, message.from.first_name)
    }
    if (command === '/help' || word === 'помощь') {
      const userId = await getLinkedUserId(chat.id)
      return sendMessage(chat.id, HELP_TEXT, { reply_markup: mainKeyboard(Boolean(userId)) })
    }
    if (command === '/link' || word === 'подключить') return createLink(chat.id, message.from.id)
    if (command === '/unlink' || word === 'отключить') {
      return runAction(chat.id, 'unlink', { telegramUserId: message.from.id })
    }
    if (command === '/garage' || word === 'гараж') return runAction(chat.id, 'garage')
    if (command === '/service' || word === 'то' || word === 'сервис') return runAction(chat.id, 'service')
    if (command === '/spending' || word === 'расходы' || word === 'траты') return runAction(chat.id, 'spending')
    if (command === '/credit' || word === 'кредит') return runAction(chat.id, 'credit')
    if (command.startsWith('/')) {
      const userId = await getLinkedUserId(chat.id)
      return sendMessage(chat.id, HELP_TEXT, { reply_markup: mainKeyboard(Boolean(userId)) })
    }
    return sendMessage(chat.id, [
      '<b>🤖 НЕ РАСПОЗНАЛ ЗАПРОС</b>',
      RULE,
      '',
      'Используйте кнопки меню, команды (/help) или слова:',
      '<b>гараж</b> · <b>то</b> · <b>расходы</b> · <b>кредит</b> · <b>меню</b>.',
    ].join('\n'), { reply_markup: mainKeyboard(Boolean(await getLinkedUserId(chat.id))) })
  }

  async function handleCallback(callback) {
    if (!callback?.message?.chat || callback.message.chat.type !== 'private') return
    const chatId = callback.message.chat.id
    const messageId = callback.message.message_id
    const action = String(callback.data ?? '')
    await telegramCall('answerCallbackQuery', { callback_query_id: callback.id })
    return runAction(chatId, action, {
      messageId: Number.isInteger(messageId) ? messageId : null,
      telegramUserId: callback.from?.id ?? null,
    })
  }

  /** Обрабатывает один update Telegram (webhook или polling). */
  async function handleUpdate(update) {
    if (!update) return undefined
    if (update.message) return handleMessage(update.message)
    if (update.callback_query) return handleCallback(update.callback_query)
    return undefined
  }

  /** Описание, команды и кнопка меню бота — вызывается при развёртывании. */
  async function applyBotProfile() {
    await telegramCall('setMyDescription', { description: BOT_DESCRIPTION })
    await telegramCall('setMyShortDescription', { short_description: BOT_SHORT_DESCRIPTION })
    // Кнопка меню открывает Mini App; команды остаются доступны через «/» и меню команд.
    const menuButton = miniAppMenuButton(webAppUrl)
    if (menuButton.type !== 'web_app') {
      logger.warn?.('[telegram] WEB_APP_URL is empty or not HTTPS: menu button falls back to the command list.')
    }
    await telegramCall('setChatMenuButton', { menu_button: menuButton })
    await telegramCall('setMyCommands', { commands: BOT_COMMANDS })
  }

  /**
   * Тело ответа GET /health.
   *
   * @param {object} state
   * @param {'polling'|'webhook'} state.mode
   * @param {'starting'|'online'|'degraded'|'stopped'} [state.pollingStatus]
   * @param {number|null} [state.lastSuccessfulAt] время последнего успешного обновления
   */
  function healthReport({ mode, pollingStatus = 'stopped', lastSuccessfulAt = null } = {}) {
    const configured = Boolean(telegramToken)
    const fresh = lastSuccessfulAt !== null && now() - lastSuccessfulAt < 120_000
    const online = configured && pollingStatus === 'online' && (mode === 'webhook' ? true : fresh)
    return {
      ok: online,
      service: 'lada-telegram-api',
      mode,
      configured,
      botPolling: configured ? (online ? 'online' : pollingStatus) : 'stopped',
      lastSuccessfulPollAt: lastSuccessfulAt ? new Date(lastSuccessfulAt).toISOString() : null,
    }
  }

  return {
    telegramCall,
    supabaseRest,
    verifySiteSession,
    linkStatus,
    confirmLink,
    confirmLinkForUser,
    unlink,
    handleUpdate,
    applyBotProfile,
    healthReport,
    mainKeyboard,
    sendMessage,
    siteCabinetUrl,
    progressBar,
  }
}
