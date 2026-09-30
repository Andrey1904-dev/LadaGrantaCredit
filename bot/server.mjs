import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
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

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY ?? '').trim()
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim()
const WEB_APP_URL = (process.env.WEB_APP_URL ?? '').trim()
const PORT = Number(process.env.PORT || 3001)
const CODE_TTL_MS = 10 * 60 * 1000
const MAX_BODY_BYTES = 4 * 1024
const IP_RATE_WINDOW_MS = 10 * 60 * 1000
const IP_RATE_LIMIT = 40
const USER_RATE_LIMIT = 8
const rateBuckets = new Map()

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function validateEnvironment() {
  const missing = []
  if (!SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!TELEGRAM_BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN')
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) missing.push('PORT (1–65535)')
  if (missing.length) {
    throw new Error(`Не заданы переменные окружения: ${missing.join(', ')}. См. bot/.env.example.`)
  }
  if (!SUPABASE_URL.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(SUPABASE_URL)) {
    throw new Error('SUPABASE_URL должен быть HTTPS-адресом (локальный HTTP разрешён только для localhost).')
  }
}

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
])
if (WEB_APP_URL) {
  try {
    allowedOrigins.add(new URL(WEB_APP_URL).origin)
  } catch {
    // WEB_APP_URL is validated by the administrator's deployment configuration.
  }
}

function applyCors(request, response) {
  const origin = request.headers.origin
  if (origin && !allowedOrigins.has(origin)) return false
  response.setHeader('Vary', 'Origin')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    response.setHeader('Access-Control-Max-Age', '600')
  }
  return true
}

function json(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
  })
  response.end(payload)
}

async function readJson(request) {
  const contentType = String(request.headers['content-type'] ?? '').toLowerCase()
  if (!contentType.includes('application/json')) throw new HttpError(415, 'Ожидается JSON-запрос.')
  const declared = Number(request.headers['content-length'] ?? 0)
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'Слишком большой запрос.')
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Слишком большой запрос.')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Некорректный JSON.')
  }
}

function makeSearch(values) {
  return new URLSearchParams(values).toString()
}

async function supabaseRest(path, { method = 'GET', body, prefer } = {}) {
  let response
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    console.error('[supabase] request failed:', error instanceof Error ? error.message : 'network error')
    throw new HttpError(502, 'Сервис данных временно недоступен. Попробуйте ещё раз.')
  }

  const text = await response.text()
  if (!response.ok) {
    console.error(`[supabase] REST returned ${response.status}`)
    throw new HttpError(502, 'Не удалось получить данные кабинета.')
  }
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function verifySiteSession(request) {
  const header = String(request.headers.authorization ?? '')
  const match = /^Bearer\s+([^\s]+)$/i.exec(header)
  if (!match || match[1].length > 8_192) {
    throw new HttpError(401, 'Войдите в облачный аккаунт сайта и повторите попытку.')
  }

  let response
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${match[1]}`,
      },
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw new HttpError(502, 'Не удалось проверить сессию сайта. Попробуйте ещё раз.')
  }
  if (!response.ok) throw new HttpError(401, 'Сессия сайта истекла. Войдите в аккаунт повторно.')
  const user = await response.json().catch(() => null)
  if (!user || typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id)) {
    throw new HttpError(401, 'Не удалось подтвердить аккаунт сайта.')
  }
  return user
}

function clientIp(request) {
  // Не доверяем X-Forwarded-For: оно может быть подделано, если API открыт напрямую.
  return request.socket.remoteAddress || 'unknown'
}

function consumeRateLimit(key, limit) {
  const now = Date.now()
  const current = rateBuckets.get(key)
  if (!current || now - current.startedAt >= IP_RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 })
    if (rateBuckets.size > 5_000) {
      for (const [bucket, state] of rateBuckets) {
        if (now - state.startedAt >= IP_RATE_WINDOW_MS) rateBuckets.delete(bucket)
      }
    }
    return true
  }
  if (current.count >= limit) return false
  current.count += 1
  return true
}

async function handleApi(request, response) {
  const url = new URL(request.url ?? '/', 'http://internal.invalid')
  const route = `${request.method} ${url.pathname}`

  if (route === 'GET /health') {
    json(response, 200, { ok: true, service: 'lada-telegram-api' })
    return
  }

  if (route === 'GET /api/telegram/link/status') {
    const user = await verifySiteSession(request)
    const query = makeSearch({ select: 'linked_at', user_id: `eq.${user.id}`, limit: '1' })
    const rows = await supabaseRest(`telegram_links?${query}`)
    const linked = Array.isArray(rows) && rows.length > 0
    json(response, 200, {
      linked,
      ...(linked && rows[0].linked_at ? { linkedAt: rows[0].linked_at } : {}),
    })
    return
  }

  if (route === 'POST /api/telegram/link/confirm') {
    if (!consumeRateLimit(`ip:${clientIp(request)}`, IP_RATE_LIMIT)) {
      throw new HttpError(429, 'Слишком много попыток. Подождите несколько минут.')
    }
    const user = await verifySiteSession(request)
    if (!consumeRateLimit(`user:${user.id}`, USER_RATE_LIMIT)) {
      throw new HttpError(429, 'Лимит попыток для аккаунта исчерпан. Запросите новый код позже.')
    }
    const body = await readJson(request)
    const code = normalizeLinkCode(body?.code)
    if (!/^[A-Z0-9]{10}$/.test(code)) {
      throw new HttpError(400, 'Введите полный одноразовый код из Telegram.')
    }

    const result = await supabaseRest('rpc/link_telegram_account', {
      method: 'POST',
      body: { p_code_hash: hashLinkCode(code), p_user_id: user.id },
    })
    if (result !== true) {
      throw new HttpError(400, 'Код недействителен или истёк. Запросите новый командой /link.')
    }
    json(response, 200, { linked: true })
    return
  }

  if (route === 'DELETE /api/telegram/link') {
    const user = await verifySiteSession(request)
    const query = makeSearch({ user_id: `eq.${user.id}` })
    await supabaseRest(`telegram_links?${query}`, { method: 'DELETE' })
    json(response, 200, { linked: false })
    return
  }

  throw new HttpError(404, 'Маршрут не найден.')
}

async function telegramCall(method, payload = {}, timeoutMs = 18_000) {
  let response
  try {
    response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
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

function siteAssetUrl(path) {
  if (!WEB_APP_URL) return ''
  try {
    const base = new URL(WEB_APP_URL)
    base.hash = ''
    base.search = ''
    if (!base.pathname.endsWith('/')) base.pathname += '/'
    return new URL(path, base).toString()
  } catch {
    return ''
  }
}

function siteCabinetUrl() {
  if (!WEB_APP_URL) return ''
  try {
    const url = new URL(WEB_APP_URL)
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
  const query = makeSearch({
    select: 'user_id',
    telegram_chat_id: `eq.${chatId}`,
    limit: '1',
  })
  const rows = await supabaseRest(`telegram_links?${query}`)
  return Array.isArray(rows) && rows[0] ? rows[0].user_id : null
}

async function getUserForChat(chatId) {
  const userId = await getLinkedUserId(chatId)
  if (!userId) return null
  return userId
}

async function readUserRows(table, userId, select, extra = {}) {
  const query = makeSearch({
    select,
    user_id: `eq.${userId}`,
    ...extra,
  })
  return supabaseRest(`${table}?${query}`)
}

async function ownerData(chatId, include = []) {
  const userId = await getUserForChat(chatId)
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

function unlinkedMessage() {
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

const CATEGORY_LABELS = {
  fuel: 'Топливо',
  loan: 'Автокредит',
  maintenance: 'ТО и сервис',
  insurance: 'Страхование',
  other: 'Прочее',
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
      console.warn('[telegram] branded welcome image skipped:', error instanceof Error ? error.message : 'image unavailable')
    }
  }
  return sendMessage(chatId, text, { reply_markup: mainKeyboard() })
}

async function createLink(chatId, telegramUserId) {
  if (await getLinkedUserId(chatId)) {
    return sendMessage(chatId, '<b>Этот Telegram уже подключён.</b>\nЧтобы сменить аккаунт, сначала отправьте /unlink.')
  }

  const staleCodes = makeSearch({
    telegram_chat_id: `eq.${chatId}`,
    used_at: 'is.null',
  })
  await supabaseRest(`telegram_link_codes?${staleCodes}`, { method: 'DELETE' })
  const expired = makeSearch({ expires_at: `lt.${new Date().toISOString()}` })
  await supabaseRest(`telegram_link_codes?${expired}`, { method: 'DELETE' })

  const code = createLinkCode((size) => randomBytes(size))
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()
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

const HELP_TEXT = [
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

async function handleUpdate(update) {
  if (update.message) return handleMessage(update.message)
  if (update.callback_query) return handleCallback(update.callback_query)
}

async function pollingLoop() {
  let offset = 0
  while (polling) {
    try {
      const updates = await telegramCall('getUpdates', {
        offset,
        timeout: 45,
        allowed_updates: ['message', 'callback_query'],
      }, 55_000)
      for (const update of updates ?? []) {
        offset = Math.max(offset, Number(update.update_id) + 1)
        try {
          await handleUpdate(update)
        } catch (error) {
          console.error('[telegram] update handler failed:', error instanceof Error ? error.message : 'unknown error')
          const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id
          if (chatId) {
            try {
              await sendMessage(chatId, 'Сервис временно недоступен. Попробуйте ещё раз чуть позже.')
            } catch {
              // Telegram API недоступен — следующий long-poll запрос повторит связь.
            }
          }
        }
      }
    } catch (error) {
      if (!polling) break
      console.error('[telegram] polling failed:', error instanceof Error ? error.message : 'unknown error')
      await new Promise((resolve) => setTimeout(resolve, 3_000))
    }
  }
}

let polling = true

export async function start() {
  validateEnvironment()
  const bot = await telegramCall('getMe')
  await telegramCall('deleteWebhook', { drop_pending_updates: false })
  await telegramCall('setMyDescription', {
    description: 'Персональный помощник владельца LADA Granta Sport. Сводки об автомобиле, ТО, расходах и автокредите — из вашего личного кабинета. Безопасное подключение по одноразовому коду.',
  })
  await telegramCall('setMyShortDescription', {
    short_description: 'Цифровой гараж LADA: автомобиль, ТО, расходы и кредит.',
  })
  await telegramCall('setChatMenuButton', { menu_button: { type: 'commands' } })
  await telegramCall('setMyCommands', {
    commands: [
      { command: 'start', description: 'Главное меню' },
      { command: 'link', description: 'Подключить личный кабинет' },
      { command: 'garage', description: 'Автомобиль и ОСАГО' },
      { command: 'service', description: 'ТО и документы' },
      { command: 'spending', description: 'Расходы за месяц' },
      { command: 'credit', description: 'Остаток и платёж по кредиту' },
      { command: 'unlink', description: 'Отключить личный кабинет' },
      { command: 'help', description: 'Список команд' },
    ],
  })

  const server = createServer(async (request, response) => {
    if (!applyCors(request, response)) {
      json(response, 403, { error: 'Origin is not allowed.' })
      return
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Cache-Control': 'no-store' })
      response.end()
      return
    }
    try {
      await handleApi(request, response)
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      if (status >= 500) {
        console.error('[api] request failed:', error instanceof Error ? error.message : 'unknown error')
      }
      json(response, status, {
        error: error instanceof Error ? error.message : 'Внутренняя ошибка сервера.',
      })
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(PORT, '0.0.0.0', resolve)
  })

  console.log(`LADA Telegram API listening on 0.0.0.0:${PORT}`)
  console.log(`Telegram bot @${bot.username} is ready.`)
  if (!WEB_APP_URL) console.warn('WEB_APP_URL is empty: the bot will not show the website shortcut button.')
  void pollingLoop()

  const stop = () => {
    polling = false
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2_000).unref()
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  start().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Bot startup failed.')
    process.exitCode = 1
  })
}
