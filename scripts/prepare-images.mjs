/**
 * Подготовка изображений Granta Sport: WebP-версии для `data-webp-src`.
 *
 * В вёрстке каждая картинка объявлена как
 *   <img src="....jpg" data-webp-src="....webp">
 * Раньше WebP-файлов не существовало, и атрибут был пустым. Этот скрипт
 * создаёт их, а src/lib/assets.ts на этапе загрузки подставляет WebP вместо
 * JPEG/PNG, если браузер его умеет. Запуск: npm run images
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images');
const files = readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f));

let before = 0;
let after = 0;

for (const file of files) {
  const src = path.join(dir, file);
  const dst = src.replace(/\.(jpe?g|png)$/i, '.webp');
  // Кадры с прозрачностью (вырезанные кузова) требуют альфа-канала в WebP.
  const { channels } = await sharp(src).metadata();
  await sharp(src)
    .webp({ quality: 80, alphaQuality: 90, effort: 6 })
    .toFile(dst);
  const kb = (p) => (statSync(p).size / 1024).toFixed(0);
  before += statSync(src).size;
  after += statSync(dst).size;
  console.log(
    `${file.padEnd(28)} ${kb(src).padStart(5)} KB -> ${path.basename(dst).padEnd(28)} ${kb(dst).padStart(5)} KB` +
      (channels === 4 ? '  (с альфа-каналом)' : ''),
  );
}

console.log(
  `\nИтого: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB ` +
    `(-${(100 - (after / before) * 100).toFixed(0)}%)`,
);
