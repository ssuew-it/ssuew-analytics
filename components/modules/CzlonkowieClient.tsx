'use client'
import { useMemo, useState } from 'react'
import { useCzlonkowie } from '@/lib/useCzlonkowie'
import { useAnalyticsData } from '@/lib/useAnalyticsData'
import { useAuth } from '@/lib/auth/useAuth'
import { kolejneSemestry, memberStatusCounts, survivalFromMembers } from '@/lib/stats'
import type { Czlonek, CzlonekStatus, Sezon } from '@/types'
import { BentoCard } from '@/components/ui/BentoCard'
import { ModuleSkeleton } from '@/components/ui/ModuleSkeleton'

const STATUSES: CzlonekStatus[] = ['aktywny', 'wspierający', 'alumn', 'zawieszone', 'nieaktywny']
const STATUS_COLOR: Record<CzlonekStatus, string> = {
  aktywny: '#2EE6A6',
  wspierający: '#8B7CF6',
  alumn: '#B5D4F4',
  zawieszone: '#d9b06a',
  nieaktywny: '#7D8590',
}
const CELL_COLOR = ['#21262D', '#2EE6A6', '#8B7CF6']

function colsForCohort(sezon: Sezon, rok: number) {
  const all = kolejneSemestry(sezon, rok, 12)
  const idx = all.findIndex((s) => s.label === "W'27")
  return idx >= 0 ? all.slice(0, idx + 1) : all.slice(0, 6)
}

export default function CzlonkowieClient() {
  const { czlonkowie, loading, usingDemo, updateCzlonek, addCzlonek } = useCzlonkowie()
  const { kohorty } = useAnalyticsData()
  const [wybranaEdycja, setEdycja] = useState('')
  const [rows, setRows] = useState<Czlonek[]>([])
  const [newName, setNewName] = useState('')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const cohortList = useMemo(
    () => kohorty.map((k) => ({ edycja: k.edycja, sezon: k.sezon, rok: k.rok })),
    [kohorty],
  )
  // Domyślnie najnowsza kohorta, która ma kogoś w siatce - pierwsza z listy
  // (J'22) bywała pusta i wejście kończyło się samymi zerami.
  const domyslna = useMemo(() => {
    const zLudzmi = new Set(czlonkowie.map((c) => c.kohorta_edycja))
    const posortowane = [...cohortList].sort((a, b) => a.rok - b.rok || (a.sezon === b.sezon ? 0 : a.sezon === 'wiosna' ? -1 : 1))
    return [...posortowane].reverse().find((k) => zLudzmi.has(k.edycja))?.edycja ?? posortowane.at(-1)?.edycja ?? ''
  }, [cohortList, czlonkowie])
  const edycja = wybranaEdycja || domyslna

  // `rows` to lokalna kopia pod optymistyczne kliknięcia w siatce. Wraca do
  // stanu z serwera, gdy przyjdą nowe dane albo zmieni się kohorta - liczone
  // w renderze, bo efekt pokazywałby przez klatkę wiersze poprzedniej kohorty.
  const [zrodloRows, setZrodloRows] = useState<{ czlonkowie: Czlonek[]; edycja: string } | null>(null)
  if (zrodloRows?.czlonkowie !== czlonkowie || zrodloRows.edycja !== edycja) {
    setZrodloRows({ czlonkowie, edycja })
    setRows(czlonkowie.filter((c) => c.kohorta_edycja === edycja))
  }

  const { rola } = useAuth()

  if (loading) return <ModuleSkeleton variant="czlonkowie" />

  const cohort = cohortList.find((c) => c.edycja === edycja)
  const cols = cohort ? colsForCohort(cohort.sezon, cohort.rok) : []
  const editable = rola === 'owner' && !usingDemo
  const canAdd = rola === 'owner'
  const counts = memberStatusCounts(rows)
  const survival = survivalFromMembers(rows)
  const avgSigma = rows.length
    ? rows.reduce((sum, member) => sum + member.aktywnosc.filter((value) => value > 0).length, 0) / rows.length
    : 0
  const sparkWidth = 200
  const sparkPoints = survival
    .map((value, index) => `${(index / Math.max(1, survival.length - 1)) * sparkWidth},${34 - (value / 100) * 32}`)
    .join(' ')

  function cycleCell(member: Czlonek, columnIndex: number) {
    if (!editable) return
    setRows((prev) =>
      prev.map((current) => {
        if (current.id !== member.id) return current
        const aktywnosc = [...current.aktywnosc]
        while (aktywnosc.length < cols.length) aktywnosc.push(0)
        aktywnosc[columnIndex] = ((aktywnosc[columnIndex] ?? 0) + 1) % 3
        updateCzlonek(current.id, { aktywnosc }).catch(() => setStatusMsg('Nie udało się zapisać zmiany.'))
        return { ...current, aktywnosc }
      }),
    )
  }

  function changeStatus(member: Czlonek, status: CzlonekStatus) {
    if (!editable) return
    setRows((prev) => prev.map((current) => (current.id === member.id ? { ...current, status } : current)))
    updateCzlonek(member.id, { status }).catch(() => setStatusMsg('Nie udało się zapisać statusu.'))
  }

  async function addMember() {
    if (!canAdd || !newName.trim() || !edycja) return
    setStatusMsg(null)
    try {
      await addCzlonek({
        kohorta_edycja: edycja,
        imie_nazwisko: newName.trim(),
        status: 'aktywny',
        aktywnosc: cols.map(() => 0),
      })
      setNewName('')
      setStatusMsg('Dodano członka kohorty.')
    } catch {
      setStatusMsg('Nie udało się dodać członka.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={edycja}
          onChange={(event) => setEdycja(event.target.value)}
          className="bg-deck-panel border border-deck-border text-deck-text text-[11px] rounded-md px-2 py-1"
        >
          {cohortList.map((cohortItem) => (
            <option key={cohortItem.edycja} value={cohortItem.edycja}>Kohorta {cohortItem.edycja}</option>
          ))}
        </select>
        <span className="text-[11px] text-deck-muted">{rows.length} członków</span>
        {usingDemo && <span className="text-[10px] text-deck-warn">dane pokazowe - siatka tylko do odczytu</span>}
        {!usingDemo && rola !== 'owner' && <span className="text-[10px] text-deck-warn">podglad - edycja tylko dla wlasciciela</span>}
        {statusMsg && <span className="text-[10px] text-deck-muted">{statusMsg}</span>}
      </div>

      <BentoCard title="Podsumowanie kohorty" sub="liczone na bieżąco z siatki" span={4}>
        <div className="flex items-center gap-4 flex-wrap text-[11px] tabular">
          <span style={{ color: STATUS_COLOR.aktywny }}>aktywni: <b>{counts.aktywny}</b></span>
          <span style={{ color: STATUS_COLOR.wspierający }}>wspierający: <b>{counts.wspierający}</b></span>
          <span style={{ color: STATUS_COLOR.alumn }}>alumni: <b>{counts.alumn}</b></span>
          <span style={{ color: STATUS_COLOR.zawieszone }}>zawieszone: <b>{counts.zawieszone}</b></span>
          <span style={{ color: STATUS_COLOR.nieaktywny }}>nieaktywni: <b>{counts.nieaktywny}</b></span>
          <span className="text-deck-text">avg Σ: <b>{avgSigma.toFixed(2).replace('.', ',')}</b> sem</span>
          <svg viewBox="0 0 200 34" className="ml-auto" style={{ width: 160, height: 34 }}>
            <polyline points={sparkPoints} fill="none" stroke="#2EE6A6" strokeWidth={2} />
          </svg>
        </div>
      </BentoCard>

      <BentoCard title={`Siatka aktywności - kohorta ${edycja}`} sub="klik komórki: pusty -> aktywny -> wspierający" span={4}>
        <div className="overflow-x-auto">
          <table className="border-collapse text-[11px] w-full">
            <thead>
              <tr className="text-deck-muted text-left">
                <th className="p-1 font-medium">Imię i nazwisko</th>
                {cols.map((col) => <th key={col.label} className="p-1 text-center">{col.label}</th>)}
                <th className="p-1 text-center">Σ</th>
                <th className="p-1">status</th>
              </tr>
            </thead>
            <tbody className="text-deck-text">
              {rows.map((member) => {
                const sigma = member.aktywnosc.filter((value) => value > 0).length
                return (
                  <tr key={member.id} className="border-t border-deck-border">
                    <td className="p-1 whitespace-nowrap">{member.imie_nazwisko}</td>
                    {cols.map((_, columnIndex) => {
                      const state = member.aktywnosc[columnIndex] ?? 0
                      return (
                        <td key={columnIndex} className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => cycleCell(member, columnIndex)}
                            disabled={!editable}
                            aria-label={`Aktywność ${member.imie_nazwisko}, semestr ${cols[columnIndex].label}`}
                            className="inline-block w-4 h-4 rounded-sm disabled:cursor-default"
                            style={{ background: CELL_COLOR[state] }}
                          />
                        </td>
                      )
                    })}
                    <td className="p-1 text-center tabular text-deck-accent font-semibold">{sigma}</td>
                    <td className="p-1">
                      <select
                        value={member.status}
                        disabled={!editable}
                        onChange={(event) => changeStatus(member, event.target.value as CzlonekStatus)}
                        className="bg-deck-bg border border-deck-border rounded-md px-1.5 py-0.5 text-[11px]"
                        style={{ color: STATUS_COLOR[member.status] }}
                      >
                        {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={cols.length + 3} className="p-2 text-deck-muted text-center">Brak członków w tej kohorcie.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {canAdd && (
          <div className="flex items-center gap-2 mt-3">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Imię i nazwisko nowej osoby"
              className="flex-1 max-w-xs bg-deck-bg border border-deck-border rounded-md px-2 py-1 text-[11px] text-deck-text"
            />
            <button
              type="button"
              onClick={addMember}
              disabled={!newName.trim()}
              className="deck-button rounded-md px-3 py-1 text-[11px] font-semibold disabled:opacity-40"
            >
              + dodaj osobę
            </button>
          </div>
        )}

        <div className="flex gap-3 mt-3 text-[9px] text-deck-muted">
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm align-middle" style={{ background: '#2EE6A6' }} /> aktywny</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm align-middle" style={{ background: '#8B7CF6' }} /> wspierający</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm align-middle" style={{ background: '#21262D' }} /> nieaktywny</span>
        </div>
      </BentoCard>
    </div>
  )
}
