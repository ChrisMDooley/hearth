/**
 * On-device text recognition for photos and screenshots of recipes
 * (Tesseract, English + German). Nothing leaves the phone. Works well on
 * printed pages and screenshots; handwriting is hit-and-miss — the editor
 * review step is where that gets fixed.
 */
export type OcrProgress = (fraction: number, status: string) => void

const STATUS: Record<string, string> = {
  'loading tesseract core': 'Starting the reader',
  'initializing tesseract': 'Starting the reader',
  'loading language traineddata': 'Loading English and German',
  'initializing api': 'Starting the reader',
  'recognizing text': 'Reading the recipe',
}

export async function readRecipeImage(file: File, onProgress: OcrProgress): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const base = new URL('./ocr/', document.baseURI).href
  const worker = await createWorker(['eng', 'deu'], 1, {
    workerPath: base + 'worker.min.js',
    corePath: base,
    langPath: base,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => onProgress(m.progress ?? 0, STATUS[m.status] ?? 'Working'),
  })
  try {
    const image = await prepare(file)
    const { data } = await worker.recognize(image)
    return data.text
  } finally {
    await worker.terminate()
  }
}

/** Upright, at most ~2400 px on the long side, greyscale-friendly JPEG. */
async function prepare(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) return file
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * k)
  canvas.height = Math.round(bmp.height * k)
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'grayscale(1) contrast(1.15)'
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return (await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9))) ?? file
}
