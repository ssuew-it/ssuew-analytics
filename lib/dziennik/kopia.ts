import { dzisWarszawa } from '@/lib/czas'
import { BladDysku, zapiszNaDysku, type RodzajBleduDysku } from '@/lib/dysk/google'
import { czytajStan } from '@/lib/skrzynka/dane'
import { BladSkrzynki, odswiezDostep } from '@/lib/skrzynka/google'
import { odszyfruj } from '@/lib/skrzynka/szyfr'
import { czytajKsiege, zapiszKopie } from './dane'
import { ksiegaNaHtml } from './eksport'
import type { Ksiega } from './typy'

export type WynikKopii =
  | { ok: true; link: string }
  | { ok: false; powod: 'brak-dysku' | RodzajBleduDysku; komunikat: string }

const KOMUNIKATY: Record<'brak-dysku' | RodzajBleduDysku, string> = {
  'brak-dysku': 'Dysk nie jest połączony - połącz go w Skrzynka → Ustawienia',
  'api-wylaczone': 'Włącz Google Drive API w projekcie deck-samorzad',
  'brak-zgody': 'Połącz Dysk ponownie w Ustawieniach Skrzynki',
  limit: 'Google chwilowo odmawia - spróbuj za minutę',
  'za-duzy': 'Księga przekracza 4 MB i nie zmieści się na Dysku',
  google: 'Dysk nie odpowiedział - spróbuj ponownie',
}

const porazka = (powod: keyof typeof KOMUNIKATY): WynikKopii => ({ ok: false, powod, komunikat: KOMUNIKATY[powod] })

const dwie = (n: number) => String(n).padStart(2, '0')

/** Cała księga jako dokument Google na Dysku kontakt@. Nie rzuca przy błędach Google - mówi, co zrobić. */
export async function zrobKopie(teraz: Date, ksiega?: Ksiega): Promise<WynikKopii> {
  const stan = await czytajStan()
  if (!stan?.polaczona || !stan.dysk) return porazka('brak-dysku')
  const k = ksiega ?? (await czytajKsiege())
  const dzis = dzisWarszawa(teraz)
  try {
    const dostep = await odswiezDostep(odszyfruj(stan.token))
    const { link } = await zapiszNaDysku(dostep, `Dziennik Stratega - stan na ${dwie(dzis.dzien)}.${dwie(dzis.miesiac)}.${dzis.rok}`, ksiegaNaHtml(k, dzis))
    if (k.otwartaKadencjaId) await zapiszKopie(k.otwartaKadencjaId, { link, kiedy: teraz.getTime() })
    return { ok: true, link }
  } catch (e) {
    if (e instanceof BladDysku) return porazka(e.rodzaj)
    if (e instanceof BladSkrzynki && e.rodzaj === 'rozlaczona') return porazka('brak-zgody')
    throw e
  }
}
