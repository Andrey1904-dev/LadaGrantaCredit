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
  assert.equal(code, '00010-20304')
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
