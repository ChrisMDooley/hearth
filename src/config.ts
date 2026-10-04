/** Build-time settings. Set in a .env file or on the build command. */

/** Optional import proxy outside Cloudflare. On the family server, /api/import is used instead. */
export const IMPORT_PROXY: string = import.meta.env.VITE_IMPORT_PROXY ?? ''

/**
 * The single-file preview can't ship the OCR engine's language files, so photo
 * import is only offered in the real (installed) app build.
 */
export const OCR_AVAILABLE: boolean = import.meta.env.MODE !== 'singlefile'
