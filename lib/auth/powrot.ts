/** Parametr adresu logowania z miejscem, do którego wracamy po wejściu. */
export const PARAM_POWROTU = 'dokad'

/**
 * Dokąd wrócić po zalogowaniu albo samym odnowieniu sesji. Tylko ścieżki
 * tej strony - „//obca.pl” albo pełny adres to otwarte przekierowanie.
 */
export function celPowrotu(v: string | null | undefined): string {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.startsWith('/login')) return '/'
  return v
}
