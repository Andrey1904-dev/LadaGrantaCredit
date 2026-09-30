import test from 'node:test'
import assert from 'node:assert/strict'
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
} from '../bot/format.mjs'

test('one-time Telegram codes are readable, normalized and hashed consistently', () => {
  const code = createLinkCode((size) => Buffer.from([0, 1, 2, 3, 4].slice(0, size)))
  assert.equal(code, '0001020304')
  assert.equal(normalizeLinkCode(code.toLowerCase()), '0001020304')
  assert.equal(hashLinkCode(code), hashLinkCode('0001020304'))
  assert.notEqual(hashLinkCode(code), hashLinkCode('0001020305'))
  assert.match(hashLinkCode(code), /^[0-9a-f]{64}$/)
})

test('HTML escaping protects bot messages from user-provided text', () => {
  assert.equal(escapeHtml(`<script title="a&b">'x'</script>`), '&lt;script title=&quot;a&amp;b&quot;&gt;&#39;x&#39;&lt;/script&gt;')
})

test('Russian display helpers format currency, mileage and dates', () => {
  assert.match(formatMoney(12500), /12.?500.?₽/)
  assert.equal(formatMileage(47800), '47 800 км')
  assert.equal(formatDate('2026-09-30'), '30 сентября 2026 г.')
})

test('document deadlines and payment dates handle month ends', () => {
  assert.equal(daysUntil('2026-10-02', new Date('2026-09-30T12:00:00Z')), 2)
  assert.equal(daysUntil('2026-09-29', new Date('2026-09-30T12:00:00Z')), -1)
  assert.equal(
    nextPaymentDate('2025-01-31', new Date('2025-02-01T12:00:00Z')).toISOString(),
    '2025-02-28T00:00:00.000Z',
  )
  assert.equal(
    nextPaymentDate('2025-01-31', new Date('2025-02-28T12:00:00Z')).toISOString(),
    '2025-02-28T00:00:00.000Z',
  )
})

test('remaining loan estimate mirrors site annuity math and clamps at zero', () => {
  const principal = 1_050_000
  assert.equal(remainingLoanBalance(principal, 16.9, 60, 0), principal)
  assert.equal(remainingLoanBalance(principal, 16.9, 60, 60), 0)
  assert.ok(remainingLoanBalance(principal, 16.9, 60, 12) < principal)
  assert.equal(remainingLoanBalance(120_000, 0, 12, 12), 0)
  assert.equal(remainingLoanBalance(120_000, 0, 12, 6), 60_000)
  assert.ok(remainingLoanBalance(1_000, 12, 12, 1, 100) < remainingLoanBalance(1_000, 12, 12, 1))
})

test('monthly summary includes only transactions in the current month', () => {
  const now = new Date('2026-09-30T12:00:00Z')
  const rows = [
    { amount: 100, date: '2026-09-01T10:00:00Z' },
    { amount: 200, date: '2026-09-30T11:59:00Z' },
    { amount: 400, date: '2026-08-31T23:59:00Z' },
    { amount: 800, date: '2026-10-01T00:00:00Z' },
  ]
  assert.deepEqual(monthTransactions(rows, now), rows.slice(0, 2))
})

test('Russian plural helper chooses correct forms', () => {
  assert.equal(plural(1, 'день', 'дня', 'дней'), 'день')
  assert.equal(plural(4, 'день', 'дня', 'дней'), 'дня')
  assert.equal(plural(12, 'день', 'дня', 'дней'), 'дней')
  assert.equal(plural(22, 'день', 'дня', 'дней'), 'дня')
})

test('edge-копии ядра бота совпадают с bot/core.mjs и bot/format.mjs', async () => {
  const { readFile } = await import('node:fs/promises')
  const { fileURLToPath } = await import('node:url')
  const path = await import('node:path')
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const pairs = [
    ['bot/core.mjs', 'supabase/functions/telegram-api/core.mjs'],
    ['bot/format.mjs', 'supabase/functions/telegram-api/format.mjs'],
  ]
  for (const [source, copy] of pairs) {
    const [a, b] = await Promise.all([
      readFile(path.join(root, source), 'utf8'),
      readFile(path.join(root, copy), 'utf8'),
    ])
    assert.equal(b, a, `${copy} должен быть копией ${source} (обновите копию)`)
  }
})

test('createLinkCode не зависит от Buffer и работает на Web Crypto', async () => {
  const { createLinkCode } = await import('../bot/format.mjs')
  const code = createLinkCode()
  assert.match(code, /^[0-9A-F]{10}$/)
})

test('ядро бота отвечает на команды и создаёт код привязки', async () => {
  const { createBot } = await import('../bot/core.mjs')
  const sent = []
  const rest = []
  const bot = createBot({
    telegramToken: '8703956173:TEST-TOKEN-0123456789abcdefghij',
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon',
    supabaseServiceRoleKey: 'service',
    webAppUrl: 'https://andrey1904-dev.github.io/LadaGrantaCredit/',
    now: () => Date.parse('2026-09-30T12:00:00Z'),
    logger: { warn() {}, error() {} },
    fetchImpl: async (url, init = {}) => {
      const href = String(url)
      if (href.startsWith('https://api.telegram.org/')) {
        sent.push({ method: href.split('/').pop(), body: init.body ? JSON.parse(init.body) : null })
        return new Response(JSON.stringify({ ok: true, result: {} }), { headers: { 'Content-Type': 'application/json' } })
      }
      rest.push(href)
      if (href.includes('/rest/v1/telegram_links')) return new Response('[]', { headers: { 'Content-Type': 'application/json' } })
      if (href.includes('/rest/v1/telegram_link_codes') && init.method === 'POST') {
        return new Response(null, { status: 201 })
      }
      return new Response('null', { headers: { 'Content-Type': 'application/json' } })
    },
  })

  await bot.handleUpdate({
    message: { from: { id: 7, first_name: 'Андрей' }, chat: { id: 777, type: 'private' }, text: '/link' },
  })
  const linkMessage = sent.at(-1)
  assert.equal(linkMessage.method, 'sendMessage')
  assert.match(linkMessage.body.text, /КОД ПОДКЛЮЧЕНИЯ/)
  assert.match(linkMessage.body.text, /[0-9A-F]{5}-[0-9A-F]{5}/)
  assert.ok(rest.some((href) => href.includes('/rest/v1/telegram_link_codes')))

  await bot.handleUpdate({ message: { from: { id: 7 }, chat: { id: 777, type: 'private' }, text: '/help' } })
  assert.equal(sent.at(-1).body.text.includes('/garage'), true)

  // Личные чаты и посторонние сообщения игнорируются.
  const before = sent.length
  await bot.handleUpdate({ message: { from: { id: 7 }, chat: { id: -100, type: 'group' }, text: '/link' } })
  assert.equal(sent.length, before)

  // Inline-кнопки работают как живой экран: подтверждаем callback и
  // редактируем исходное сообщение, а не плодим новые.
  await bot.handleUpdate({
    callback_query: {
      id: 'cb-42',
      from: { id: 7, first_name: 'Андрей' },
      data: 'garage',
      message: { message_id: 99, chat: { id: 777, type: 'private' } },
    },
  })
  assert.equal(sent.at(-3).method, 'answerCallbackQuery')
  assert.equal(sent.at(-2).method, 'sendChatAction')
  assert.equal(sent.at(-1).method, 'editMessageText')
  assert.equal(sent.at(-1).body.message_id, 99)
  assert.match(sent.at(-1).body.text, /Сначала подключите сайт/)
  // На экране без привязки есть кнопка мгновенной генерации кода.
  const keyboards = sent.at(-1).body.reply_markup.inline_keyboard.flat()
  assert.ok(keyboards.some((button) => button.callback_data === 'link'))

  // Деструктивное действие требует подтверждения вторым тапом.
  await bot.handleUpdate({
    callback_query: {
      id: 'cb-43',
      from: { id: 7 },
      data: 'unlink',
      message: { message_id: 100, chat: { id: 777, type: 'private' } },
    },
  })
  assert.equal(sent.at(-1).method, 'editMessageText')
  assert.match(sent.at(-1).body.text, /ОТКЛЮЧИТЬ КАБИНЕТ\?/)
  const confirmButtons = sent.at(-1).body.reply_markup.inline_keyboard.flat()
  assert.ok(confirmButtons.some((button) => button.callback_data === 'unlink_confirm'))
})

test('текстовый прогресс-бар бота стабилен на границах', async () => {
  const { progressBar } = await import('../bot/core.mjs')
  assert.equal(progressBar(0, 8), '▱▱▱▱▱▱▱▱')
  assert.equal(progressBar(1, 8), '▰▰▰▰▰▰▰▰')
  assert.equal(progressBar(0.5, 8), '▰▰▰▰▱▱▱▱')
  assert.equal(progressBar(2, 8), '▰▰▰▰▰▰▰▰')
  assert.equal(progressBar(-1, 8), '▱▱▱▱▱▱▱▱')
  assert.equal(progressBar(Number.NaN, 8), '▱▱▱▱▱▱▱▱')
})

test('healthReport не считает бота здоровым без свежих обновлений', async () => {
  const { createBot } = await import('../bot/core.mjs')
  const bot = createBot({
    telegramToken: '8703956173:TEST-TOKEN-0123456789abcdefghij',
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon',
    supabaseServiceRoleKey: 'service',
    fetchImpl: async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
    now: () => 1_000_000,
    logger: { warn() {}, error() {} },
  })
  assert.equal(bot.healthReport({ mode: 'polling', pollingStatus: 'starting' }).ok, false)
  assert.equal(bot.healthReport({ mode: 'polling', pollingStatus: 'online', lastSuccessfulAt: 999_000 }).ok, true)
  assert.equal(bot.healthReport({ mode: 'polling', pollingStatus: 'online', lastSuccessfulAt: 1 }).ok, false)
  assert.equal(bot.healthReport({ mode: 'webhook', pollingStatus: 'online' }).ok, true)
})
