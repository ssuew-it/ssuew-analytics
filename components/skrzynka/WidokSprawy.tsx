'use client'
import { useEffect, useState } from 'react'
import { ExternalLink, Paperclip } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_STATUSOW, adresZalacznika, linkGmail, pelnaData, rozmiar } from '@/lib/skrzynka/widok'
import { MAKS_POBRANIA, type Sprawa, type Status, type SzczegolySprawy, type ZmianaSprawy } from '@/lib/skrzynka/typy'
import { OknoOdpowiedzi } from './OknoOdpowiedzi'
import { TrescWiadomosci } from './TrescWiadomosci'

/** Statusy do ustawienia jednym kliknięciem; Do przejrzenia ustawia tylko automat. */
const AKCJE: Status[] = ['do-odpowiedzi', 'w-toku', 'czeka-na-nich', 'zalatwiona']

export function WidokSprawy({ id, sklad, email, onZmiana, onZamknij }: {
  id: string
  sklad: string[]
  email: string
  onZmiana: (s: Sprawa) => void
  onZamknij: () => void
}) {
  const [dane, setDane] = useState<SzczegolySprawy | null>(null)
  const [blad, setBlad] = useState<string | null>(null)
  const [trwa, setTrwa] = useState(false)

  useEffect(() => {
    let aktywny = true
    klientSkrzynki
      .sprawa(id)
      .then((d) => {
        if (aktywny) setDane(d)
      })
      .catch((e: Error) => {
        if (aktywny) setBlad(e.message)
      })
    return () => {
      aktywny = false
    }
  }, [id])

  async function zmien(z: ZmianaSprawy) {
    setTrwa(true)
    setBlad(null)
    try {
      const s = await klientSkrzynki.zmien(id, z)
      setDane((d) => d && { ...d, sprawa: s })
      onZmiana(s)
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  // Listy „zawsze pomijaj” nie da się jeszcze edytować w panelu - jeden przypadkowy klik wyciszyłby nadawcę na stałe.
  function pominZawsze(rodzaj: 'adres' | 'domena', kogo: string) {
    if (!window.confirm(`Nowe wątki od ${kogo} będą od razu trafiać do Pominiętych. Na razie nie da się tego cofnąć w D.E.C.K. Pominąć?`)) return
    void zmien({ pomin: rodzaj })
  }

  async function poWyslaniu(s: Sprawa) {
    setDane((d) => d && { ...d, sprawa: s })
    onZmiana(s)
    // Wysłana wiadomość ma się pojawić w wątku - wczytujemy go jeszcze raz.
    try {
      setDane(await klientSkrzynki.sprawa(id))
    } catch {
      // Zostaje poprzedni widok - odpowiedź i tak poszła.
    }
  }

  const powrot = (
    <button type="button" onClick={onZamknij} className="text-[11.5px] text-deck-muted hover:underline lg:hidden">
      ← Lista
    </button>
  )

  if (!dane) {
    return (
      <section className="deck-card space-y-2 rounded-lg p-4 text-[12.5px]">
        {powrot}
        {blad ? <p role="alert" className="text-deck-danger">{blad}</p> : <p className="font-mono text-[11px] text-deck-muted">Wczytuję wątek…</p>}
      </section>
    )
  }

  const s = dane.sprawa
  const przycisk = 'deck-chip rounded-md px-2.5 py-1 text-[11.5px] transition hover:text-deck-text disabled:opacity-50'

  return (
    <section aria-label={`Sprawa: ${s.temat}`} className="deck-card space-y-4 rounded-lg p-4 text-[12.5px]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {powrot}
          <h2 className="text-[15px] font-semibold text-deck-text">{s.temat}</h2>
          <p className="text-deck-muted">
            {s.kontakt ?? '(bez nadawcy)'}
            {s.organizacja ? ` · ${s.organizacja}` : ''} · {ETYKIETY_STATUSOW[s.status]}
          </p>
        </div>
        <a href={linkGmail(email, s.id)} target="_blank" rel="noopener noreferrer" className={`${przycisk} inline-flex items-center gap-1`}>
          <ExternalLink size={12} aria-hidden="true" />
          Otwórz w Gmailu
        </a>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        {AKCJE.filter((a) => a !== s.status).map((a) => (
          <button key={a} type="button" disabled={trwa} onClick={() => zmien({ status: a })} className={przycisk}>
            {ETYKIETY_STATUSOW[a]}
          </button>
        ))}
        {s.status !== 'pominieta' && (
          <button type="button" disabled={trwa} onClick={() => zmien({ status: 'pominieta' })} className={przycisk}>
            Pomiń
          </button>
        )}
        {s.kontakt && (
          <button type="button" disabled={trwa} onClick={() => pominZawsze('adres', s.kontakt!)} className={przycisk}>
            Pomiń zawsze ten adres
          </button>
        )}
        {/* Domena tylko dla organizacji - gmail.com czy wp.pl wyciszyłyby wszystkich. */}
        {s.kontakt && s.organizacja && (
          <button type="button" disabled={trwa} onClick={() => pominZawsze('domena', `wszystkich adresów @${s.organizacja}`)} className={przycisk}>
            Pomiń zawsze domenę {s.organizacja}
          </button>
        )}
        {/* aria-label zamiast obejmującego <label> - tekst etykiety nie wchłania nazw z listy. */}
        <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-deck-muted">
          <span aria-hidden="true">Przypisz</span>
          <select
            aria-label="Przypisz"
            value={s.przypisana ?? ''}
            disabled={trwa}
            onChange={(e) => zmien({ przypisana: e.target.value || null })}
            className="deck-input rounded-md px-2 py-1"
          >
            <option value="">nikt</option>
            {/* Osoba, która wypadła ze Składu, dalej widnieje przy sprawie - inaczej lista pokazałaby „nikt”. */}
            {s.przypisana && !sklad.includes(s.przypisana) && <option value={s.przypisana}>{s.przypisana} (poza Składem)</option>}
            {sklad.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </span>
      </div>
      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}

      {dane.wiadomosci.length === 0 && (
        <p className="text-deck-muted">Tego wątku nie ma już w Gmailu - sprawę można zamknąć albo pominąć.</p>
      )}
      <ol className="space-y-3">
        {dane.wiadomosci.map((w) => (
          <li key={w.id} className="rounded-md border border-white/10 p-3">
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-[11.5px]">
              <span className="text-deck-text">{w.od ? (w.od.imie ? `${w.od.imie} <${w.od.email}>` : w.od.email) : '(nieznany nadawca)'}</span>
              <span className="font-mono text-deck-muted">{pelnaData(w.kiedy)}</span>
            </div>
            <TrescWiadomosci w={w} />
            {w.zalaczniki.length > 0 && (
              <ul aria-label="Załączniki" className="mt-2 flex flex-wrap gap-2">
                {w.zalaczniki.map((z) => (
                  <li key={z.id}>
                    {z.rozmiar > MAKS_POBRANIA ? (
                      <a href={linkGmail(email, s.id)} target="_blank" rel="noopener noreferrer" className={`${przycisk} inline-flex items-center gap-1`}>
                        <Paperclip size={12} aria-hidden="true" />
                        {z.nazwa} · {rozmiar(z.rozmiar)} (w Gmailu)
                      </a>
                    ) : (
                      <a href={adresZalacznika(s.id, z)} className={`${przycisk} inline-flex items-center gap-1`}>
                        <Paperclip size={12} aria-hidden="true" />
                        {z.nazwa} · {rozmiar(z.rozmiar)}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {dane.wiadomosci.length > 0 && (
        <OknoOdpowiedzi key={s.id} sprawaId={s.id} adresat={dane.adresat} stopka={dane.stopka} onWyslano={poWyslaniu} />
      )}
    </section>
  )
}
