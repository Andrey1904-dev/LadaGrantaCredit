/**
 * Каталог из 4 уникальных фотографий LADA Granta Sport согласно ТЗ.
 *
 * Поддерживает как целевые пути `public/images/granta-sport-*.webp` (после экспорта оригиналов),
 * так и подготовленные референс-превью в `public/images/granta-sport-*.{jpg,png}`.
 */

export type GrantaFinish = 'black' | 'white'

export interface GrantaAssetMeta {
  /** Имя целевого WebP-файла по ТЗ */
  webp: string
  /** Фактический путь файла превью в репозитории */
  src: string
  /** Содержательный alt-текст (или пустой для декоративной подложки) */
  alt: string
}

export const GRANTA_ASSETS = {
  /** 1. Серая Granta Sport на мосту, ракурс 3/4 */
  hero: {
    webp: './images/granta-sport-hero.webp',
    src: './images/granta-sport-hero.jpg',
    alt: 'Серая LADA Granta Sport на мосту, ракурс 3/4 спереди',
  },
  /** 2. Крупный план шильдика SPORT на темной решетке радиатора */
  detail: {
    webp: './images/granta-sport-detail.webp',
    src: './images/granta-sport-detail.jpg',
    alt: 'Крупный план шильдика SPORT на черной решетке радиатора LADA Granta Sport',
  },
  /** 3. Белая Granta Sport (светлый вариант авто в гараже / выбор цвета) */
  white: {
    webp: './images/granta-sport-white.webp',
    src: './images/granta-sport-white.png',
    alt: 'Белая LADA Granta Sport в студийном ракурсе 3/4',
  },
  /** 4. Черная Granta Sport (основное изображение машины в гараже и на главной) */
  black: {
    webp: './images/granta-sport-black.webp',
    src: './images/granta-sport-black.png',
    alt: 'Черная LADA Granta Sport в студийном ракурсе 3/4',
  },
} as const

const FINISH_STORAGE_KEY = 'lgc_granta_finish'

export function getSavedFinish(): GrantaFinish {
  try {
    const v = localStorage.getItem(FINISH_STORAGE_KEY)
    return v === 'white' ? 'white' : 'black'
  } catch {
    return 'black'
  }
}

export function setSavedFinish(finish: GrantaFinish): void {
  try {
    localStorage.setItem(FINISH_STORAGE_KEY, finish)
    window.dispatchEvent(new CustomEvent('lgc-finish-change', { detail: finish }))
  } catch {
    /* ignore storage errors */
  }
}

/** Умеет ли браузер показывать WebP — иначе оставляем JPEG/PNG из `src`. */
function supportsWebp(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return canvas.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}

function upgradeToWebp(img: HTMLImageElement): void {
  const webp = img.getAttribute('data-webp-src')
  if (!webp || img.dataset.webpApplied === '1') return
  img.dataset.webpApplied = '1'
  img.srcset = webp
  img.src = webp
}

/**
 * Подставляет WebP-версии картинок Granta вместо JPEG/PNG.
 *
 * В разметке у каждого кадра объявлен `data-webp-src`; файлы `.webp`
 * генерируются скриптом `npm run images` (см. scripts/prepare-images.mjs).
 * Страницы монтируются лениво, поэтому кроме стартовой разметки следим
 * за DOM. Внешний вид при этом не меняется — меняется только формат файла
 * (на телефоне это ~1.6 МБ → ~0.3 МБ на все четыре кадра).
 */
export function enableWebpAssets(): void {
  if (typeof document === 'undefined' || !supportsWebp()) return
  document
    .querySelectorAll<HTMLImageElement>('img[data-webp-src]')
    .forEach(upgradeToWebp)
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLImageElement) {
          upgradeToWebp(node)
        } else if (node instanceof Element) {
          node.querySelectorAll<HTMLImageElement>('img[data-webp-src]').forEach(upgradeToWebp)
        }
      })
    }
  }).observe(document.body, { childList: true, subtree: true })
}
