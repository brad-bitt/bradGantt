// Produit les icônes matricielles depuis le SVG du signe : favicon.ico (16/32/48, PNG embarqués)
// et apple-icon.png (180). Les fichiers sont versionnés ; relancer avec `node scripts/make-icons.mjs`
// après toute modification de app/icon.svg. `sharp` vient des dépendances de Next.
import sharp from 'sharp'
import { writeFileSync, readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const svg = readFileSync(`${root}/app/icon.svg`)

async function png(size) {
  return sharp(svg, { density: 384 }).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer()
}

// ICO = en-tête (6 octets) + une entrée de 16 octets par image + les images (ici des PNG, que
// Windows accepte depuis Vista et tous les navigateurs).
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // réservé
  header.writeUInt16LE(1, 2) // type : icône
  header.writeUInt16LE(images.length, 4)
  const entries = []
  let offset = 6 + 16 * images.length
  for (const { size, data } of images) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size === 256 ? 0 : size, 0)
    e.writeUInt8(size === 256 ? 0 : size, 1)
    e.writeUInt8(0, 2) // palette
    e.writeUInt8(0, 3) // réservé
    e.writeUInt16LE(1, 4) // plans
    e.writeUInt16LE(32, 6) // bits par pixel
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    offset += data.length
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

const sizes = [16, 32, 48]
const images = []
for (const size of sizes) images.push({ size, data: await png(size) })
writeFileSync(`${root}/app/favicon.ico`, ico(images))
writeFileSync(`${root}/app/apple-icon.png`, await png(180))
console.log('favicon.ico', sizes.join('/'), '· apple-icon.png 180')
