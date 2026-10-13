import { NextResponse, type NextRequest } from 'next/server'
import { biezacySemestr } from '@/lib/planer/semestry'
import { dzisWarszawa } from '@/lib/czas'
import { BladAsystenta, komunikatBledu, zapytajGemini } from '@/lib/asystent/gemini'
import { INSTRUKCJA_CZATU, rozmowaDlaGemini, sprawdzZapytanie } from '@/lib/asystent/czat'
import { czytajOdprawe, daneProjektu, pobierzArkusz, pobierzPlaner, zbudujKontekst } from '@/lib/asystent/dane'
import { czytajRozmowe, tresciNotatek, zapiszRozmowe } from '@/lib/asystent/pamiecDane'
import { dopiszPytanie, odczytajOdpowiedzCzatu, SCHEMAT_CZATU, tytulRozmowy } from '@/lib/asystent/pamiec'
import { tylkoWlasciciel } from '@/lib/asystent/tylkoWlasciciel'
import { statystykiStron } from '@/lib/strony/dane'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Czat „Zapytaj D.E.C.K.”. Rozmowa żyje w bazie: pytanie zapisujemy przed
 * wołaniem Gemini, żeby nie zginęło, gdy model zawiedzie - wtedy przeglądarka
 * ponawia z `ponow: true` i pytanie się nie dubluje.
 */
export async function POST(req: NextRequest) {
  const { kto, odmowa } = await tylkoWlasciciel(req)
  if (odmowa) return odmowa

  const z = sprawdzZapytanie(await req.json().catch(() => null))
  if (!z) return NextResponse.json({ error: 'Puste albo niepoprawne pytanie' }, { status: 400 })

  const teraz = Date.now()
  const rozmowa = z.rozmowaId ? await czytajRozmowe(z.rozmowaId) : null
  if (z.rozmowaId && !rozmowa) return NextResponse.json({ error: 'Nie ma takiej rozmowy' }, { status: 404 })

  const wiadomosci = dopiszPytanie(rozmowa?.wiadomosci ?? [], z.pytanie, teraz, z.ponow)
  if (!wiadomosci) {
    return NextResponse.json({ error: 'Ta rozmowa jest pełna - zacznij nową.', rozmowaId: z.rozmowaId }, { status: 409 })
  }
  const naglowek = { tytul: rozmowa?.tytul ?? tytulRozmowy(z.pytanie), utworzono: rozmowa?.utworzono ?? teraz }
  const rozmowaId = await zapiszRozmowe({ ...naglowek, zmieniono: teraz, wiadomosci }, z.rozmowaId ?? undefined)

  const semestr = biezacySemestr(new Date(teraz))
  try {
    const [a, p, notatki, zapisana, strony] = await Promise.all([
      pobierzArkusz(),
      pobierzPlaner(semestr.id, kto.rola),
      tresciNotatek().catch(() => []),
      czytajOdprawe().catch(() => null),
      statystykiStron().catch(() => []),
    ])
    const k = zbudujKontekst(daneProjektu(a, p, { id: semestr.id, nazwa: semestr.nazwa }, notatki, strony), dzisWarszawa(new Date(teraz)))
    const { tekst } = await zapytajGemini({
      instrukcja: INSTRUKCJA_CZATU,
      wiadomosci: rozmowaDlaGemini(k, wiadomosci, zapisana?.odprawa ?? null),
      schemat: SCHEMAT_CZATU,
    })
    const wynik = odczytajOdpowiedzCzatu(tekst)
    if (!wynik) throw new BladAsystenta('format', 'Odpowiedź czatu niezgodna ze schematem')

    const kiedy = Date.now()
    await zapiszRozmowe(
      { ...naglowek, zmieniono: kiedy, wiadomosci: [...wiadomosci, { rola: 'deck', tresc: wynik.odpowiedz, kiedy }] },
      rozmowaId,
    )
    return NextResponse.json({ rozmowaId, odpowiedz: wynik.odpowiedz, propozycja: wynik.propozycja })
  } catch (e) {
    const { status, error } = komunikatBledu(e)
    return NextResponse.json({ error, rozmowaId }, { status })
  }
}
