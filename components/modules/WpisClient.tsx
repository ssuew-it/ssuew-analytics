'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAnalyticsData } from '@/lib/useAnalyticsData'
import { useProjekty } from '@/lib/useProjekty'
import { useAuth } from '@/lib/auth/useAuth'
import { nextOkres } from '@/lib/period'
import { serieWgKategorii, ostatniPunkt } from '@/lib/kpi/serie'
import { BentoCard } from '@/components/ui/BentoCard'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'

type Tab = 'rekrutacja' | 'kohorta' | 'kpi' | 'rocznik' | 'projekt'

const PUSTY_PROJEKT = {
  projekt: '', edycja: '', obszar: '',
  budzet_plan: '', budzet_wydany: '', przedluzenia: '',
  aplikujacy: '', uczestnicy: '', partnerzy_fin: '', partnerzy_barter: '',
  problemy: '',
}

/** Puste pole to zero - tak samo traktuje je arkusz przy odczycie. */
const liczba = (v: string) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
const inputCls = 'w-full bg-deck-bg border border-deck-border rounded-md px-3 py-2 text-sm text-deck-text'
const labelCls = 'block text-[11px] text-deck-muted mb-1'
const btnCls = 'w-full bg-deck-accent text-deck-bg-deep rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50'

export default function WpisClient() {
  const { serie, addRekrutacja, addKohorta, addKpiMetric, addKpiMetricsBulk } = useAnalyticsData()
  const { rola, laduje } = useAuth()
  const [tab, setTab] = useState<Tab>('rekrutacja')
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [rekr, setRekr] = useState({ edycja: '', sezon: 'jesien' as 'jesien' | 'wiosna', rok: new Date().getFullYear(), zgloszenia: '', przyjeci: '' })
  const [koh, setKoh] = useState({ edycja: '', sezon: 'jesien' as 'jesien' | 'wiosna', rok: new Date().getFullYear(), n: '', avg: '', max: '', inProgress: false })
  const [kpi, setKpi] = useState({ kategoria: 'SKS', nazwa: '', okres: '', wartosc: '' })
  const { dodajProjekt } = useProjekty()
  const [proj, setProj] = useState(PUSTY_PROJEKT)

  /** Seria nie ma identyfikatora - rozpoznajemy ją po parze, tak jak reszta modułu. */
  const kluczSerii = (s: { kategoria: string; nazwa: string }) => `${s.kategoria}|${s.nazwa}`

  // Rocznik KPI (wsadowo): nowy okres + jedna wartość na istniejącą metrykę.
  // Okres bierzemy z najdłuższej serii, a nie z pierwszego wiersza arkusza - 
  // ten zależał od kolejności zapisu i potrafił podpowiedzieć byle co.
  const latestOkres = useMemo(() => {
    const najdluzsza = serie.reduce<(typeof serie)[number] | null>(
      (a, s) => (!a || s.punkty.length > a.punkty.length ? s : a), null,
    )
    return najdluzsza ? ostatniPunkt(najdluzsza)?.okres ?? '2025/2026' : '2025/2026'
  }, [serie])
  const grouped = useMemo(() => serieWgKategorii(serie), [serie])
  // Dopóki nic nie wpisano, podpowiedź idzie za danymi - po ich dociągnięciu
  // zmieni się z domyślnej na właściwą, czego efekt ustawiający raz by nie zrobił.
  const [rocznikWpisany, setRocznikOkres] = useState<string | null>(null)
  const rocznikOkres = rocznikWpisany ?? nextOkres(latestOkres)
  const [rocznikVals, setRocznikVals] = useState<Record<string, string>>({})

  if (laduje) return <ModuleSkeleton />
  if (rola !== 'owner') {
    return (
      <BentoCard title="Wpisz dane">
        <p className="text-[11px] text-deck-muted">
          {rola === 'board' ? (
            'Dane wpisuje wyłącznie właściciel kokpitu. Masz dostęp do podglądu wszystkich modułów.'
          ) : (
            <>
              Zaloguj się, by wpisywać dane.{' '}
              <Link href="/login" className="text-deck-accent">
                Zaloguj →
              </Link>
            </>
          )}
        </p>
      </BentoCard>
    )
  }

  async function run(fn: () => Promise<void>, okMsg: string) {
    setBusy(true)
    setStatus(null)
    try {
      await fn()
      setStatus({ ok: true, msg: okMsg })
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : 'Błąd zapisu' })
    } finally {
      setBusy(false)
    }
  }

  const submitRekr = () =>
    run(async () => {
      await addRekrutacja({ edycja: rekr.edycja, sezon: rekr.sezon, rok: rekr.rok, zgloszenia: parseInt(rekr.zgloszenia), przyjeci: parseInt(rekr.przyjeci) })
      setRekr({ edycja: '', sezon: 'jesien', rok: new Date().getFullYear(), zgloszenia: '', przyjeci: '' })
    }, `Rekrutacja ${rekr.edycja} zapisana.`)

  const submitKoh = () =>
    run(async () => {
      await addKohorta({ edycja: koh.edycja, sezon: koh.sezon, rok: koh.rok, n_czlonkow: parseInt(koh.n), avg_retention_sem: parseFloat(koh.avg), max_retention_sem: parseInt(koh.max), in_progress: koh.inProgress })
      setKoh({ edycja: '', sezon: 'jesien', rok: new Date().getFullYear(), n: '', avg: '', max: '', inProgress: false })
    }, `Kohorta ${koh.edycja} zapisana.`)

  const submitKpi = () =>
    run(async () => {
      await addKpiMetric({
        kategoria: kpi.kategoria,
        nazwa: kpi.nazwa,
        okres: kpi.okres.trim() || latestOkres,
        wartosc: parseFloat(kpi.wartosc),
      })
      // Kategoria i okres zostają: dopisując pomiary jeden po drugim
      // przepisywałbyś je za każdym razem.
      setKpi({ kategoria: kpi.kategoria, nazwa: '', okres: kpi.okres, wartosc: '' })
    }, `Pomiar „${kpi.nazwa}" zapisany.`)

  const submitProjekt = () =>
    run(async () => {
      await dodajProjekt({
        projekt: proj.projekt.trim(),
        edycja: proj.edycja.trim() || latestOkres,
        obszar: proj.obszar.trim(),
        budzet_plan: liczba(proj.budzet_plan),
        budzet_wydany: liczba(proj.budzet_wydany),
        przedluzenia: liczba(proj.przedluzenia),
        aplikujacy: liczba(proj.aplikujacy),
        uczestnicy: liczba(proj.uczestnicy),
        partnerzy_fin: liczba(proj.partnerzy_fin),
        partnerzy_barter: liczba(proj.partnerzy_barter),
        problemy: proj.problemy.trim(),
      })
      // Edycja i obszar zostają - wpisując rocznik dodajesz projekty seriami.
      setProj({ ...PUSTY_PROJEKT, edycja: proj.edycja, obszar: proj.obszar })
    }, `Projekt „${proj.projekt.trim()}” zapisany.`)

  const submitRocznik = () => {
    const payloads = serie
      .filter((s) => rocznikVals[kluczSerii(s)]?.trim())
      .map((s) => ({
        kategoria: s.kategoria,
        nazwa: s.nazwa,
        okres: rocznikOkres,
        wartosc: parseFloat(rocznikVals[kluczSerii(s)]),
      }))
    run(async () => {
      if (!payloads.length) throw new Error('Wpisz przynajmniej jedną wartość.')
      await addKpiMetricsBulk(payloads)
      setRocznikVals({})
    }, `Zapisano rocznik ${rocznikOkres} (${payloads.length} metryk).`)
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex gap-2 flex-wrap">
        {(['rekrutacja', 'kohorta', 'kpi', 'rocznik', 'projekt'] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setStatus(null) }}
            className={`text-[11px] px-3 py-1 rounded-md border ${tab === t ? 'bg-deck-accent/10 text-deck-accent border-deck-accent/40' : 'text-deck-muted border-deck-border'}`}>
            {t === 'rekrutacja' ? 'Rekrutacja' : t === 'kohorta' ? 'Kohorta' : t === 'kpi' ? 'Pomiar KPI' : t === 'rocznik' ? 'Rocznik KPI' : 'Projekt'}
          </button>
        ))}
      </div>

      <div className="text-[11px] text-deck-muted bg-deck-panel border border-deck-border rounded-md px-3 py-2 leading-relaxed">
        {tab === 'rekrutacja' && 'Wyniki rekrutacji: edycja (np. J’26), zgłoszenia, przyjęci. Trafią do modułu Rekrutacje, Lejek i Prognozy.'}
        {tab === 'kohorta' && 'Kohorta: liczebność i retencja (avg/max). Zasili moduł Retencja i krzywe przeżycia.'}
        {tab === 'kpi' && 'Pojedynczy pomiar: kategoria, nazwa, okres i wartość (np. SKS / Listopad / 2025/2026 / 84). Służy też do uzupełniania dziur w historii.'}
        {tab === 'rocznik' && 'Najszybszy sposób na nowy rok: wpisz tegoroczne liczby obok istniejących metryk (poprzednie przenoszą się automatycznie) i zapisz wszystkie naraz.'}
        {tab === 'projekt' && 'Kondycja projektu w jednej edycji. Wystarczy nazwa i edycja - resztę uzupełnisz później. Puste pole liczy się jako zero i zwykle milczy; wyjątkiem są partnerzy finansowi - zero tam oznacza „brak partnera” i zapala flagę.'}
        {' '}Wypełnij i kliknij „Zapisz" - zmiany od razu widać w modułach.
      </div>

      {status && (
        <div className={`text-[11px] px-3 py-2 rounded-md border ${status.ok ? 'border-deck-accent/40 text-deck-accent' : 'border-deck-danger-border text-deck-danger'}`}>
          {status.msg}
        </div>
      )}

      {tab === 'rekrutacja' && (
        <BentoCard title="Dodaj rekrutację">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Edycja</label><input className={inputCls} placeholder="J'26" value={rekr.edycja} onChange={(e) => setRekr((p) => ({ ...p, edycja: e.target.value }))} /></div>
              <div><label className={labelCls}>Sezon</label>
                <select className={inputCls} value={rekr.sezon} onChange={(e) => setRekr((p) => ({ ...p, sezon: e.target.value as 'jesien' | 'wiosna' }))}><option value="jesien">Jesień</option><option value="wiosna">Wiosna</option></select>
              </div>
            </div>
            <div><label className={labelCls}>Rok</label><input type="number" className={inputCls} value={rekr.rok} onChange={(e) => setRekr((p) => ({ ...p, rok: parseInt(e.target.value) }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Zgłoszenia</label><input type="number" className={inputCls} value={rekr.zgloszenia} onChange={(e) => setRekr((p) => ({ ...p, zgloszenia: e.target.value }))} /></div>
              <div><label className={labelCls}>Przyjęci</label><input type="number" className={inputCls} value={rekr.przyjeci} onChange={(e) => setRekr((p) => ({ ...p, przyjeci: e.target.value }))} /></div>
            </div>
            <button onClick={submitRekr} disabled={busy} className={btnCls}>{busy ? 'Zapisywanie…' : 'Zapisz rekrutację'}</button>
          </div>
        </BentoCard>
      )}

      {tab === 'kohorta' && (
        <BentoCard title="Dodaj kohortę">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Edycja</label><input className={inputCls} placeholder="J'26" value={koh.edycja} onChange={(e) => setKoh((p) => ({ ...p, edycja: e.target.value }))} /></div>
              <div><label className={labelCls}>Sezon</label>
                <select className={inputCls} value={koh.sezon} onChange={(e) => setKoh((p) => ({ ...p, sezon: e.target.value as 'jesien' | 'wiosna' }))}><option value="jesien">Jesień</option><option value="wiosna">Wiosna</option></select>
              </div>
            </div>
            <div><label className={labelCls}>Rok</label><input type="number" className={inputCls} value={koh.rok} onChange={(e) => setKoh((p) => ({ ...p, rok: parseInt(e.target.value) }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Liczebność</label><input type="number" className={inputCls} value={koh.n} onChange={(e) => setKoh((p) => ({ ...p, n: e.target.value }))} /></div>
              <div><label className={labelCls}>Średnia retencja</label><input type="number" step="0.01" className={inputCls} value={koh.avg} onChange={(e) => setKoh((p) => ({ ...p, avg: e.target.value }))} /></div>
              <div><label className={labelCls}>Najdłuższa retencja</label><input type="number" className={inputCls} value={koh.max} onChange={(e) => setKoh((p) => ({ ...p, max: e.target.value }))} /></div>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-deck-muted">
              <input type="checkbox" checked={koh.inProgress} onChange={(e) => setKoh((p) => ({ ...p, inProgress: e.target.checked }))} /> kohorta w toku (in_progress)
            </label>
            <button onClick={submitKoh} disabled={busy} className={btnCls}>{busy ? 'Zapisywanie…' : 'Zapisz kohortę'}</button>
          </div>
        </BentoCard>
      )}

      {tab === 'kpi' && (
        <BentoCard title="Dodaj pomiar KPI" sub="jedna metryka w jednym okresie">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Kategoria</label>
                <input list="kpi-kategorie" className={inputCls} value={kpi.kategoria} onChange={(e) => setKpi((p) => ({ ...p, kategoria: e.target.value }))} placeholder="np. SKS / Retencja" />
                <datalist id="kpi-kategorie">
                  <option value="SKS" /><option value="Wydarzenia" /><option value="Ankieta" /><option value="Koordynatorzy" />
                  <option value="Retencja" /><option value="Pipeline" /><option value="Zaangażowanie" /><option value="Parytet" />
                </datalist>
              </div>
              <div><label className={labelCls}>Nazwa</label><input className={inputCls} placeholder="np. Listopad / Wigilia" value={kpi.nazwa} onChange={(e) => setKpi((p) => ({ ...p, nazwa: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Okres</label><input className={inputCls} placeholder={latestOkres} value={kpi.okres} onChange={(e) => setKpi((p) => ({ ...p, okres: e.target.value }))} /></div>
              <div><label className={labelCls}>Wartość</label><input type="number" step="0.01" className={inputCls} value={kpi.wartosc} onChange={(e) => setKpi((p) => ({ ...p, wartosc: e.target.value }))} /></div>
            </div>
            <button onClick={submitKpi} disabled={busy || !kpi.nazwa || !kpi.wartosc} className={btnCls}>{busy ? 'Zapisywanie…' : 'Zapisz pomiar'}</button>
          </div>
        </BentoCard>
      )}

      {tab === 'rocznik' && (
        <BentoCard title="Nowy rocznik KPI" sub="wpisz tegoroczne wartości - historia zostaje nietknięta">
          <div className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="w-40"><label className={labelCls}>Nowy okres</label><input className={inputCls} value={rocznikOkres} onChange={(e) => setRocznikOkres(e.target.value)} /></div>
              <p className="text-[10px] text-deck-muted pb-2">ostatni wpisany: {latestOkres}</p>
            </div>
            {serie.length === 0 ? (
              <p className="text-[11px] text-deck-muted">Brak istniejących metryk - dodaj najpierw pojedynczy pomiar.</p>
            ) : (
              [...grouped.entries()].map(([kat, metryki]) => (
                <div key={kat}>
                  <div className="text-[11px] text-deck-text font-medium mb-1">{kat}</div>
                  <div className="space-y-1">
                    {metryki.map((s) => {
                      const ost = ostatniPunkt(s)
                      return (
                        <div key={kluczSerii(s)} className="flex items-center gap-2 text-[11px]">
                          <span className="text-deck-muted flex-1 truncate">{s.nazwa}</span>
                          <span className="text-deck-muted tabular w-16 text-right">{ost ? `${ost.wartosc} →` : '-'}</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="nowa"
                            className="w-24 bg-deck-bg border border-deck-border rounded-md px-2 py-1 text-[11px] text-deck-text"
                            value={rocznikVals[kluczSerii(s)] ?? ''}
                            onChange={(e) => setRocznikVals((v) => ({ ...v, [kluczSerii(s)]: e.target.value }))}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
            <button onClick={submitRocznik} disabled={busy} className={btnCls}>{busy ? 'Zapisywanie…' : `Zapisz rocznik ${rocznikOkres}`}</button>
          </div>
        </BentoCard>
      )}

      {tab === 'projekt' && (
        <BentoCard title="Kondycja projektu" sub="jeden projekt w jednej edycji">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label className={labelCls}>Projekt</label><input className={inputCls} placeholder="np. Gala" value={proj.projekt} onChange={(e) => setProj((p) => ({ ...p, projekt: e.target.value }))} /></div>
              <div><label className={labelCls}>Edycja</label><input className={inputCls} placeholder={latestOkres} value={proj.edycja} onChange={(e) => setProj((p) => ({ ...p, edycja: e.target.value }))} /></div>
              <div><label className={labelCls}>Obszar</label><input className={inputCls} placeholder="np. Kultura" value={proj.obszar} onChange={(e) => setProj((p) => ({ ...p, obszar: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label className={labelCls}>Budżet przyznany (zł)</label><input type="number" className={inputCls} value={proj.budzet_plan} onChange={(e) => setProj((p) => ({ ...p, budzet_plan: e.target.value }))} /></div>
              <div><label className={labelCls}>Budżet wydany (zł)</label><input type="number" className={inputCls} value={proj.budzet_wydany} onChange={(e) => setProj((p) => ({ ...p, budzet_wydany: e.target.value }))} /></div>
              <div><label className={labelCls}>Przedłużenia naboru</label><input type="number" className={inputCls} value={proj.przedluzenia} onChange={(e) => setProj((p) => ({ ...p, przedluzenia: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><label className={labelCls}>Aplikujący</label><input type="number" className={inputCls} value={proj.aplikujacy} onChange={(e) => setProj((p) => ({ ...p, aplikujacy: e.target.value }))} /></div>
              <div><label className={labelCls}>Uczestnicy</label><input type="number" className={inputCls} value={proj.uczestnicy} onChange={(e) => setProj((p) => ({ ...p, uczestnicy: e.target.value }))} /></div>
              <div><label className={labelCls}>Partnerzy fin.</label><input type="number" className={inputCls} value={proj.partnerzy_fin} onChange={(e) => setProj((p) => ({ ...p, partnerzy_fin: e.target.value }))} /></div>
              <div><label className={labelCls}>Partnerzy barter.</label><input type="number" className={inputCls} value={proj.partnerzy_barter} onChange={(e) => setProj((p) => ({ ...p, partnerzy_barter: e.target.value }))} /></div>
            </div>
            <div>
              <label className={labelCls}>Problemy w tej edycji</label>
              <textarea rows={3} className={inputCls} placeholder="co poszło nie tak" value={proj.problemy} onChange={(e) => setProj((p) => ({ ...p, problemy: e.target.value }))} />
            </div>
            <button onClick={submitProjekt} disabled={busy || !proj.projekt.trim()} className={btnCls}>
              {busy ? 'Zapisywanie…' : 'Zapisz projekt'}
            </button>
          </div>
        </BentoCard>
      )}
    </div>
  )
}
