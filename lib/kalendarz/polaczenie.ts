import { czytajStan, zapiszStan } from '@/lib/skrzynka/dane'
import { ZAKRES_KALENDARZA, ZAKRESY_GMAILA, gmail as utworzGmail, wymienKod } from '@/lib/skrzynka/google'
import { zaszyfruj } from '@/lib/skrzynka/szyfr'
import { nasz } from '@/lib/skrzynka/synchronizacja'

export type WynikPolaczeniaKalendarza = 'ok' | 'niepolaczona' | 'inne-konto' | 'brak-kalendarza' | 'niepelna-zgoda'

/**
 * Powrót ze zgody na kalendarz. Podmienia wyłącznie token (nowy obejmuje Gmaila
 * i kalendarz) i zaznacza `kalendarz` - bez nowej obserwacji Gmaila, bez ruszania
 * historii i importu. Token bez obu zakresów Gmaila nigdy nie zastępuje tokenu skrzynki.
 */
export async function polaczKalendarz(kod: string): Promise<WynikPolaczeniaKalendarza> {
  const stan = await czytajStan()
  if (!stan?.polaczona) return 'niepolaczona'
  const { refreshToken, dostep, zakresy } = await wymienKod(kod)
  if (!zakresy.includes(ZAKRES_KALENDARZA)) return 'brak-kalendarza'
  if (!ZAKRESY_GMAILA.every((z) => zakresy.includes(z))) return 'niepelna-zgoda'
  const profil = await utworzGmail(refreshToken, dostep).profil()
  if (profil.emailAddress.toLowerCase() !== nasz()) return 'inne-konto'
  await zapiszStan({ token: zaszyfruj(refreshToken), kalendarz: true })
  return 'ok'
}
