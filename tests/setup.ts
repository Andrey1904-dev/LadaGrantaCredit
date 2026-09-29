/**
 * Браузерное окружение для модулей, которые читают localStorage / window.
 * Импортируется первым — до остальных модулей набора тестов.
 */

const store = new Map<string, string>()

const localStorageStub = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
}

const g = globalThis as unknown as Record<string, unknown>

g.localStorage = localStorageStub
g.window = globalThis
g.location = { origin: 'https://example.test', pathname: '/' }
g.dispatchEvent = () => true
g.addEventListener = () => {}
g.removeEventListener = () => {}
g.CustomEvent = class {
  type: string
  detail: unknown
  constructor(type: string, init?: { detail?: unknown }) {
    this.type = type
    this.detail = init?.detail
  }
}

export const resetStorage = () => store.clear()
export const storage = localStorageStub
