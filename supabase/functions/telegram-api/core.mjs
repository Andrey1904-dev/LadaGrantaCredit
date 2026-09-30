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

export const HELP_TEXT = [
  '<b>КОМАНДЫ LADA ASSISTANT</b>',
  '',
  '/garage — автомобиль и ОСАГО',
  '/service — записи ТО и документы',
  '/spending — расходы текущего месяца',
  '/credit — остаток и дата платежа',
  '/link — безопасно подключить сайт',
  '/unlink — отозвать доступ',
  '/start — главное меню',
].join('\n')

export const BOT_DESCRIPTION =
  'Персональный помощник владельца LADA Granta Sport. Сводки об автомобиле, ТО, расходах и автокредите — из вашего личного кабинета. Безопасное подключение по одноразовому коду.'
export const BOT_SHORT_DESCRIPTION = 'Цифровой гараж LADA: автомобиль, ТО, расходы и кредит.'
export const BOT_COMMANDS = [
  { command: 'start', description: 'Главное меню' },
  { command: 'link', description: 'Подключить личный кабинет' },
  { command: 'garage', description: 'Автомобиль и ОСАГО' },
  { command: 'service', description: 'ТО и документы' },
  { command: 'spending', description: 'Расходы за месяц' },
  { command: 'credit', description: 'Остаток и платёж по кредиту' },
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

export function unlinkedMessage() {
  return [
    '<b>Сначала подключите сайт</b>',
    'Откройте личный кабинет, перейдите в раздел «Бот» и нажмите /link здесь.',
    'Одноразовый код действует 10 минут. Пароль сайта отправлять не нужно.',
  ].join('\n\n')
}

function insuranceLine(insuranceUntil) {
  const remaining = daysUntil(insuranceUntil)
  if (remaining === null) return 'ОСАГО: дата окончания не указана'
  if (remaining < 0) return `ОСАГО: срок истёк ${Math.abs(remaining)} ${plural(Math.abs(remaining), 'день', 'дня', 'дней')} назад`
  if (remaining === 0) return 'ОСАГО: срок заканчивается сегодня'
  return `ОСАГО до ${escapeHtml(formatDate(insuranceUntil))} · ${remaining} ${plural(remaining, 'день', 'дня', 'дней')}`
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

  function siteCabinetUrl() {
    if (!webAppUrl) return ''
    try {
      const url = new URL(webAppUrl)
      url.hash = '/telegram'
      return url.toString()
    } catch {
      return ''
    }
  }

  function mainKeyboard() {
    const rows = [
      [
        { text: '🚘 Мой гараж', callback_data: 'garage' },
        { text: '🧰 ТО и документы', callback_data: 'service' },
      ],
      [
        { text: '📊 Расходы', callback_data: 'spending' },
        { text: '💳 Автокредит', callback_data: 'credit' },
      ],
    ]
    const url = siteCabinetUrl()
    if (url) rows.push([{ text: '↗ Открыть кабинет', url }])
    return { inline_keyboard: rows }
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

  async function showGarage(chatId) {
    const data = await ownerData(chatId, ['car'])
    if (!data) return sendMessage(chatId, unlinkedMessage(), { reply_markup: mainKeyboard() })
    if (!data.car) {
      return sendMessage(chatId, '<b>Гараж пока пуст</b>\nДобавьте автомобиль на сайте — после этого сводка появится здесь.', {
        reply_markup: mainKeyboard(),
      })
    }
    const text = [
      '<b>МОЙ ГАРАЖ</b>',
      '',
      '<b>LADA Granta Sport</b>',
      `Пробег: <b>${escapeHtml(formatMileage(data.car.current_mileage))}</b>`,
      insuranceLine(data.car.insurance_until),
      '',
      '<i>Сводка синхронизирована с кабинетом сайта.</i>',
    ].join('\n')
    return sendMessage(chatId, text, { reply_markup: mainKeyboard() })
  }

  async function showService(chatId) {
    const data = await ownerData(chatId, ['car', 'maintenance'])
    if (!data) return sendMessage(chatId, unlinkedMessage(), { reply_markup: mainKeyboard() })
    const lines = ['<b>ТО И ДОКУМЕНТЫ</b>', '']
    if (data.car) lines.push(insuranceLine(data.car.insurance_until), '')
    if (data.maintenance.length) {
      lines.push('<b>Последние записи журнала:</b>')
      for (const record of data.maintenance.slice(0, 4)) {
        const description = escapeHtml(record.description || 'Работы без описания')
        lines.push(`• ${description} · ${escapeHtml(formatMileage(record.mileage))} · ${escapeHtml(formatDate(record.date))}`)
      }
    } else {
      lines.push('Журнал обслуживания пока пуст. Записи можно добавить в разделе «ТО» на сайте.')
    }
    return sendMessage(chatId, lines.join('\n'), { reply_markup: mainKeyboard() })
  }

  async function showSpending(chatId) {
    const data = await ownerData(chatId, ['transactions'])
    if (!data) return sendMessage(chatId, unlinkedMessage(), { reply_markup: mainKeyboard() })
    const rows = monthTransactions(data.transactions)
    const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const byCategory = new Map()
    for (const item of rows) {
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + Number(item.amount || 0))
    }
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    const lines = ['<b>РАСХОДЫ С НАЧАЛА МЕСЯЦА</b>', '', `Итого: <b>${escapeHtml(formatMoney(total))}</b>`]
    if (top.length) {
      lines.push('', ...top.map(([category, amount]) => `• ${CATEGORY_LABELS[category] ?? 'Прочее'} — ${escapeHtml(formatMoney(amount))}`))
    } else {
      lines.push('', 'В этом месяце расходов пока нет.')
    }
    return sendMessage(chatId, lines.join('\n'), { reply_markup: mainKeyboard() })
  }

  async function showCredit(chatId) {
    const data = await ownerData(chatId, ['loan', 'transactions'])
    if (!data) return sendMessage(chatId, unlinkedMessage(), { reply_markup: mainKeyboard() })
    if (!data.loan) {
      return sendMessage(chatId, '<b>Кредит не добавлен</b>\nДобавьте кредит в личном кабинете, чтобы видеть остаток и дату платежа.', {
        reply_markup: mainKeyboard(),
      })
    }
    const paidMonths = data.transactions.filter((item) => item.category === 'loan').length
    const balance = remainingLoanBalance(
      data.loan.total_amount,
      data.loan.interest_rate,
      data.loan.term_months,
      paidMonths,
      data.loan.monthly_payment,
    )
    const paymentDate = nextPaymentDate(data.loan.start_date)
    const lines = [
      '<b>АВТОКРЕДИТ</b>',
      '',
      `Расчётный остаток: <b>${escapeHtml(formatMoney(balance))}</b>`,
      `Ежемесячный платёж: ${escapeHtml(formatMoney(data.loan.monthly_payment))}`,
      `Ближайшая дата: ${paymentDate ? escapeHtml(formatDate(paymentDate)) : 'не рассчитана'}`,
      '',
      '<i>Оценка рассчитана по числу платежей, отмеченных в кабинете. Сверяйте точный остаток с банком.</i>',
    ]
    return sendMessage(chatId, lines.join('\n'), { reply_markup: mainKeyboard() })
  }

  async function showWelcome(chatId, firstName = '') {
    const userId = await getLinkedUserId(chatId)
    const name = firstName ? `, ${escapeHtml(firstName)}` : ''
    const intro = userId
      ? `<b>С возвращением${name}.</b>\nВаш цифровой гараж LADA Granta Sport готов.`
      : `<b>Добро пожаловать${name}.</b>\nLADA Assistant — быстрый доступ к вашему цифровому гаражу.`
    const help = userId
      ? 'Выберите нужный раздел или отправьте команду. Данные обновляются из личного кабинета.'
      : 'Подключите кабинет командой /link — и сводки появятся прямо здесь.'
    const text = `${intro}\n\n${help}`
    const photo = siteAssetUrl('images/telegram-assistant-avatar.jpg')
    if (photo) {
      try {
        return await telegramCall('sendPhoto', {
          chat_id: chatId,
          photo,
          caption: text,
          parse_mode: 'HTML',
          reply_markup: mainKeyboard(),
        })
      } catch (error) {
        logger.warn?.('[telegram] branded welcome image skipped:', error instanceof Error ? error.message : 'image unavailable')
      }
    }
    return sendMessage(chatId, text, { reply_markup: mainKeyboard() })
  }

  async function createLink(chatId, telegramUserId) {
    if (await getLinkedUserId(chatId)) {
      return sendMessage(chatId, '<b>Этот Telegram уже подключён.</b>\nЧтобы сменить аккаунт, сначала отправьте /unlink.')
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
      '<b>КОД ПОДКЛЮЧЕНИЯ</b>',
      '',
      `<code>${formatted}</code>`,
      '',
      'Введите его в разделе «Бот» на сайте. Код одноразовый и действует 10 минут.',
      '<i>Не пересылайте код другим людям.</i>',
    ].join('\n')
    return sendMessage(chatId, text)
  }

  async function unlinkChat(chatId) {
    const query = makeSearch({ telegram_chat_id: `eq.${chatId}` })
    const result = await supabaseRest(`telegram_links?${query}`, {
      method: 'DELETE',
      prefer: 'return=representation',
    })
    const linked = Array.isArray(result) ? result.length > 0 : true
    if (!linked) {
      return sendMessage(chatId, 'Этот Telegram не связан с кабинетом. Для подключения используйте /link.')
    }
    return sendMessage(chatId, '<b>Связь удалена.</b>\nБот больше не имеет доступа к данным кабинета.')
  }

  async function runAction(chatId, action, firstName = '') {
    switch (action) {
      case 'garage': return showGarage(chatId)
      case 'service': return showService(chatId)
      case 'spending': return showSpending(chatId)
      case 'credit': return showCredit(chatId)
      case 'menu': return showWelcome(chatId, firstName)
      default: return sendMessage(chatId, HELP_TEXT, { reply_markup: mainKeyboard() })
    }
  }

  async function handleMessage(message) {
    const chat = message?.chat
    if (!chat || chat.type !== 'private' || !message.from) return
    const text = String(message.text ?? '').trim()
    if (!text) return

    const [firstToken] = text.split(/\s+/, 1)
    const command = firstToken.toLowerCase().split('@')[0]
    if (command === '/start') return showWelcome(chat.id, message.from.first_name)
    if (command === '/help') return sendMessage(chat.id, HELP_TEXT, { reply_markup: mainKeyboard() })
    if (command === '/link') return createLink(chat.id, message.from.id)
    if (command === '/unlink') return unlinkChat(chat.id)
    if (command === '/garage' || text.toLowerCase() === 'гараж') return showGarage(chat.id)
    if (command === '/service' || text.toLowerCase() === 'то') return showService(chat.id)
    if (command === '/spending' || text.toLowerCase() === 'расходы') return showSpending(chat.id)
    if (command === '/credit' || text.toLowerCase() === 'кредит') return showCredit(chat.id)
    if (command.startsWith('/')) return sendMessage(chat.id, HELP_TEXT, { reply_markup: mainKeyboard() })
    return sendMessage(chat.id, 'Используйте кнопки меню или /help — покажу доступные команды.', {
      reply_markup: mainKeyboard(),
    })
  }

  async function handleCallback(callback) {
    if (!callback?.message?.chat || callback.message.chat.type !== 'private') return
    await telegramCall('answerCallbackQuery', { callback_query_id: callback.id })
    return runAction(callback.message.chat.id, String(callback.data ?? ''), callback.from?.first_name ?? '')
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
    await telegramCall('setChatMenuButton', { menu_button: { type: 'commands' } })
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
  }
}
