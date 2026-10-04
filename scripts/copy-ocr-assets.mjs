// Copies the OCR engine and English + German language data into public/ocr,
// so photo import runs fully on the device with no third-party downloads.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const out = 'public/ocr'
mkdirSync(out, { recursive: true })
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`))

const files = [
  [join(pkgDir('tesseract.js'), 'dist/worker.min.js'), 'worker.min.js'],
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'].map((f) => [join(pkgDir('tesseract.js-core'), f), f]),
  // "best_int" models: small and accurate enough for printed recipes.
  [join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int/eng.traineddata.gz'), 'eng.traineddata.gz'],
  [join(pkgDir('@tesseract.js-data/deu'), '4.0.0_best_int/deu.traineddata.gz'), 'deu.traineddata.gz'],
]
for (const [from, to] of files) {
  if (!existsSync(from)) throw new Error(`Missing OCR asset: ${from}`)
  copyFileSync(from, join(out, to))
}
console.log(`OCR assets copied to ${out}`)
