'use client'
import { useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { etapPusty } from '@/lib/orbita/szkielet'
import { LIMITY, type Etap } from '@/lib/orbita/typy'
import { POLE, PRZYCISK_CICHY } from '@/components/dziennik/style'

const ZNANI = ['RUSS', 'KR']
const ETYKIETA = 'block text-[11.5px] text-deck-muted'
const IKONA = 'grid h-7 w-7 place-items-center rounded-md border border-white/10 text-deck-muted transition hover:text-deck-text disabled:opacity-30'

/** Lista „inni” trzymana lokalnie, żeby przecinek na końcu nie znikał w trakcie pisania. */
function PoleInnych({ nr, czekaNa, onChange }: { nr: number; czekaNa: string[]; onChange: (inni: string[]) => void }) {
  const [tekst, setTekst] = useState(czekaNa.filter((x) => !ZNANI.includes(x)).join(', '))
  return (
    <label className={ETYKIETA}>
      Inni (po przecinku)
      <input
        aria-label={`Inni (po przecinku) ${nr}`}
        className={`${POLE} mt-1`}
        value={tekst}
        onChange={(e) => {
          setTekst(e.target.value)
          onChange(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))
        }}
      />
    </label>
  )
}

/**
 * Etapy zadania. Zamknięte stoją na początku i są tylko do odczytu (poza wynikiem);
 * otwarte można przestawiać między sobą, usuwać i dopisywać na końcu.
 */
export function EdytorEtapow({ etapy, onChange }: { etapy: Etap[]; onChange: (etapy: Etap[]) => void }) {
  const pierwszyOtwarty = etapy.findIndex((e) => e.zamkniety === null)
  const zmien = (i: number, zmiany: Partial<Etap>) => onChange(etapy.map((e, j) => (j === i ? { ...e, ...zmiany } : e)))
  const zamien = (i: number, j: number) => {
    const nowe = [...etapy]
    ;[nowe[i], nowe[j]] = [nowe[j], nowe[i]]
    onChange(nowe)
  }

  return (
    <div className="space-y-3">
      {etapy.map((e, i) => {
        const nr = i + 1
        const zamkniety = e.zamkniety !== null
        const czekanie = e.rodzaj === 'czekanie'
        return (
          <fieldset key={e.id} className={`rounded-lg border p-3 ${zamkniety ? 'border-white/5 opacity-80' : 'border-white/10'}`}>
            <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-deck-muted">
              Etap {nr}{zamkniety && ' · zamknięty'}
            </legend>
            <div className="flex flex-wrap items-end gap-2">
              <label className={`${ETYKIETA} min-w-40 flex-1`}>
                Nazwa
                <input
                  aria-label={`Nazwa etapu ${nr}`}
                  className={`${POLE} mt-1`}
                  value={e.nazwa}
                  maxLength={LIMITY.nazwa}
                  readOnly={zamkniety}
                  onChange={(x) => zmien(i, { nazwa: x.target.value })}
                />
              </label>
              <label className={ETYKIETA}>
                Rodzaj
                <select
                  aria-label={`Rodzaj etapu ${nr}`}
                  className={`${POLE} mt-1`}
                  value={e.rodzaj}
                  disabled={zamkniety}
                  onChange={(x) => zmien(i, { rodzaj: x.target.value as Etap['rodzaj'] })}
                >
                  <option value="praca">Praca</option>
                  <option value="czekanie">Czekanie na innych</option>
                </select>
              </label>
              <label className={`${ETYKIETA} w-20`}>
                {czekanie ? 'Czekam dni' : 'Dni'}
                <input
                  aria-label={`Dni etapu ${nr}`}
                  type="number"
                  min={0}
                  max={LIMITY.dni}
                  className={`${POLE} mt-1`}
                  value={e.dni}
                  readOnly={zamkniety}
                  onChange={(x) => zmien(i, { dni: Math.max(0, Math.min(LIMITY.dni, Math.floor(Number(x.target.value) || 0))) })}
                />
              </label>
              {!zamkniety && (
                <div className="flex gap-1">
                  <button type="button" aria-label={`Przesuń etap ${nr} wyżej`} className={IKONA} disabled={i <= pierwszyOtwarty} onClick={() => zamien(i, i - 1)}>
                    <ArrowUp size={13} aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={`Przesuń etap ${nr} niżej`} className={IKONA} disabled={i === etapy.length - 1} onClick={() => zamien(i, i + 1)}>
                    <ArrowDown size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Usuń etap ${nr}`}
                    className={IKONA}
                    disabled={etapy.length === 1}
                    onClick={() => onChange(etapy.filter((_, j) => j !== i))}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {czekanie && !zamkniety && (
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <div className="flex items-center gap-3 text-[12px] text-deck-text">
                  {ZNANI.map((p) => (
                    <label key={p} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        className="accent-[var(--color-deck-accent)]"
                        checked={e.czekaNa.includes(p)}
                        onChange={(x) => zmien(i, { czekaNa: x.target.checked ? [...e.czekaNa, p] : e.czekaNa.filter((y) => y !== p) })}
                      />
                      {p}
                    </label>
                  ))}
                </div>
                <div className="min-w-40 flex-1">
                  <PoleInnych nr={nr} czekaNa={e.czekaNa} onChange={(inni) => zmien(i, { czekaNa: [...e.czekaNa.filter((x) => ZNANI.includes(x)), ...inni] })} />
                </div>
                <label className={ETYKIETA}>
                  Czekam do
                  <input
                    aria-label={`Czekam do ${nr}`}
                    type="date"
                    className={`${POLE} mt-1`}
                    value={e.czekamDo ?? ''}
                    onChange={(x) => zmien(i, { czekamDo: x.target.value || null })}
                  />
                </label>
              </div>
            )}

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {([['cel', 'Cel'], ['zacznijOd', 'Zacznij od'], ['gotoweGdy', 'Gotowe, gdy']] as const).map(([pole, etykieta]) => (
                <label key={pole} className={ETYKIETA}>
                  {etykieta}
                  <input
                    aria-label={`${etykieta} ${nr}`}
                    className={`${POLE} mt-1`}
                    value={e[pole]}
                    maxLength={LIMITY.krotkie}
                    readOnly={zamkniety}
                    onChange={(x) => zmien(i, { [pole]: x.target.value })}
                  />
                </label>
              ))}
            </div>
            <label className={`${ETYKIETA} mt-2`}>
              Materiały (linki)
              <textarea
                aria-label={`Materiały ${nr}`}
                className={`${POLE} mt-1 min-h-12`}
                value={e.materialy}
                maxLength={LIMITY.materialy}
                readOnly={zamkniety}
                onChange={(x) => zmien(i, { materialy: x.target.value })}
              />
            </label>
            {zamkniety && (
              <label className={`${ETYKIETA} mt-2`}>
                Wynik
                <textarea
                  aria-label={`Wynik ${nr}`}
                  className={`${POLE} mt-1 min-h-12`}
                  value={e.wynik}
                  maxLength={LIMITY.wynik}
                  onChange={(x) => zmien(i, { wynik: x.target.value })}
                />
              </label>
            )}
          </fieldset>
        )
      })}
      {etapy.length < LIMITY.etapy && (
        <button type="button" className={PRZYCISK_CICHY} onClick={() => onChange([...etapy, etapPusty()])}>Dodaj etap</button>
      )}
    </div>
  )
}
