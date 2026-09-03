// Helper keamanan & response untuk EdgeOne Cloud Functions

/**
 * Perbandingan string konstan-waktu (constant-time comparison)
 * Mencegah timing attack pada verifikasi ADMIN_KEY dan CRON_SECRET.
 */
export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (!a || !b) return false
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Sanitasi string teks dasar: membuang karakter kontrol berbahaya dan membatasi panjang.
 */
export function sanitizeText(input, maxLength = 100) {
  if (!input || typeof input !== 'string') return ''
  // Hapus karakter kontrol ASCII non-printable kecuali spasi biasa
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLength)
}
