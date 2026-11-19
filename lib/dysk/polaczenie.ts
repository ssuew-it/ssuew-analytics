import { czytajStan, zapiszStan } from '@/lib/skrzynka/dane'
import { ZAKRES_DYSKU, ZAKRES_KALENDARZA, ZAKRESY_GMAILA, gmail as utworzGmail, wymienKod } from '@/lib/skrzynka/google'
import { zaszyfruj } from '@/lib/skrzynka/szyfr'
import { nasz } from '@/lib/skrzynka/synchronizacja'

export type WynikPolaczeniaDysku = 'ok' | 'niepolaczona' | 'inne-konto' | 'brak-dysku' | 'niepelna-zgoda'

/**
 * Powrót ze zgody na Dysk - lustro `polaczKalendarz`. Podmienia tylko token
 * (nowy obejmuje Gmaila, Dysk i - jeśli był - kalendarz) i flagi zakresów.
 * Token bez obu zakresów Gmaila nigdy nie zastępuje tokenu skrzynki.
 */
export async function polaczDysk(kod: string): Promise<WynikPolaczeniaDysku> {
  const stan = await czytajStan()
  if (!stan?.polaczona) return 'niepolaczona'
  const { refreshToken, dostep, zakresy } = await wymienKod(kod)
  if (!zakresy.includes(ZAKRES_DYSKU)) return 'brak-dysku'
  if (!ZAKRESY_GMAILA.every((z) => zakresy.includes(z))) return 'niepelna-zgoda'
  const profil = await utworzGmail(refreshToken, dostep).profil()
  if (profil.emailAddress.toLowerCase() !== nasz()) return 'inne-konto'
  await zapiszStan({ token: zaszyfruj(refreshToken), dysk: true, kalendarz: zakresy.includes(ZAKRES_KALENDARZA) })
  return 'ok'
}
