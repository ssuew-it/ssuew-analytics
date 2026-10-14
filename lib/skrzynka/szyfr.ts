import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Refresh token kontakt@ daje pełny dostęp do poczty, więc w Firestore leży
 * zaszyfrowany kluczem spoza bazy. Sam wyciek bazy go nie zdradza.
 * Format: base64(iv 12 B | tag 16 B | szyfrogram).
 */
function klucz(): Buffer {
  const k = Buffer.from(process.env.SKRZYNKA_KLUCZ ?? '', 'base64')
  if (k.length !== 32) throw new Error('SKRZYNKA_KLUCZ musi mieć 32 bajty w base64')
  return k
}

export function zaszyfruj(tekst: string): string {
  const iv = randomBytes(12)
  const szyfr = createCipheriv('aes-256-gcm', klucz(), iv)
  const dane = Buffer.concat([szyfr.update(tekst, 'utf8'), szyfr.final()])
  return Buffer.concat([iv, szyfr.getAuthTag(), dane]).toString('base64')
}

export function odszyfruj(szyfrogram: string): string {
  const b = Buffer.from(szyfrogram, 'base64')
  const deszyfr = createDecipheriv('aes-256-gcm', klucz(), b.subarray(0, 12))
  deszyfr.setAuthTag(b.subarray(12, 28))
  return Buffer.concat([deszyfr.update(b.subarray(28)), deszyfr.final()]).toString('utf8')
}
