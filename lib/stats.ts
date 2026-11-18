import type { Rekrutacja, Kohorta, KpiPeriod, Czlonek, CzlonekStatus, StatResult, RegressionResult, Sezon, SeriaKpi, StrategicKpi, ExecutiveInsight } from '@/types'
import { ilorazSerii } from '@/lib/kpi/serie'
import { zmianaRr } from '@/lib/format'

// ─── Podstawowe funkcje ──────────────────────────────────────────────────────

export function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

export function variance(arr: number[]): number {
  const m = mean(arr)
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1)
}

export function sd(arr: number[]): number {
  return Math.sqrt(variance(arr))
}

// ─── Korelacja Pearsona ──────────────────────────────────────────────────────
// r ∈ [-1, 1]. Mierzy siłę i kierunek liniowego związku między dwiema zmiennymi.

export function pearson(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y)
  const num = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0)
  const den = Math.sqrt(
    x.reduce((s, v) => s + (v - mx) ** 2, 0) *
    y.reduce((s, v) => s + (v - my) ** 2, 0)
  )
  return den === 0 ? 0 : num / den
}

function approxPval(tStat: number, _df: number): { label: string; significant: boolean } {
  const t = Math.abs(tStat)
  // Przybliżenie p-value dla dwustronnego testu t
  if (t > 4.5)  return { label: '<0,001', significant: true }
  if (t > 3.5)  return { label: '<0,005', significant: true }
  if (t > 2.9)  return { label: '<0,01',  significant: true }
  if (t > 2.4)  return { label: '<0,05',  significant: true }
  if (t > 2.0)  return { label: '~0,07',  significant: false }
  if (t > 1.5)  return { label: '~0,15',  significant: false }
  return { label: '>0,20', significant: false }
}

export function pearsonTest(x: number[], y: number[]): StatResult {
  const r = pearson(x, y)
  const r2 = r * r
  const n = x.length
  const tStat = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r)
  const { label: p_approx, significant } = approxPval(tStat, n - 2)

  const strength = Math.abs(r) < 0.3 ? 'słaba' : Math.abs(r) < 0.6 ? 'umiarkowana' : 'silna'
  const direction = r > 0 ? 'dodatnia' : 'ujemna'

  const interpretation =
    `r = ${r.toFixed(3).replace('.', ',')} - korelacja ${direction}, ${strength}. ` +
    `R² = ${(r2 * 100).toFixed(1).replace('.', ',')}% zmienności wyjaśnionej. ` +
    `p ${p_approx}${significant ? ' - wynik statystycznie istotny.' : ' - brak istotności przy obecnej liczbie obserwacji.'}`

  return { r, r2, p_approx, significant, interpretation }
}

// ─── Test t Welcha ───────────────────────────────────────────────────────────
// Porównuje średnie dwóch grup o (potencjalnie) różnych wariancjach.
// Lepszy niż klasyczny test t gdy n₁ ≠ n₂ lub σ₁ ≠ σ₂.

export function welchT(a: number[], b: number[]) {
  const ma = mean(a), mb = mean(b)
  const va = variance(a), vb = variance(b)
  const na = a.length, nb = b.length
  const se = Math.sqrt(va / na + vb / nb)
  const tStat = (ma - mb) / se

  // Stopnie swobody Welcha-Satterthwaite'a
  const df = (va / na + vb / nb) ** 2 /
    ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1))

  const { label: p_approx, significant } = approxPval(tStat, df)

  return {
    meanA: ma,
    meanB: mb,
    sdA: sd(a),
    sdB: sd(b),
    tStat,
    df: parseFloat(df.toFixed(1)),
    p_approx,
    significant,
    interpretation:
      `t = ${tStat.toFixed(2).replace('.', ',')}, df ≈ ${df.toFixed(1).replace('.', ',')}, p ${p_approx}. ` +
      (significant
        ? `Różnica (${(ma - mb).toFixed(1).replace('.', ',')} jednostki) jest statystycznie istotna - sezon ma realny wpływ.`
        : `Różnica widoczna (${(ma - mb).toFixed(1).replace('.', ',')}), ale nieistotna statystycznie przy tej liczbie obserwacji.`)
  }
}

// ─── Z-score ─────────────────────────────────────────────────────────────────
// Ile odchyleń standardowych dany wynik jest powyżej/poniżej średniej grupy.

export function zScores(values: number[]): number[] {
  const m = mean(values)
  const s = sd(values)
  return values.map(v => parseFloat(((v - m) / s).toFixed(3)))
}

export function zInterpretation(z: number): string {
  if (z > 2)    return 'Wyjątkowo powyżej normy - wzorzec do replikacji'
  if (z > 1)    return 'Powyżej normy organizacyjnej'
  if (z > -0.5) return 'W normie'
  if (z > -1)   return 'Nieznacznie poniżej - warto monitorować'
  if (z > -2)   return 'Poniżej normy - wymaga interwencji'
  return 'Krytycznie poniżej - priorytet Zarządu'
}

// ─── Regresja OLS wielokrotna ─────────────────────────────────────────────────
// Minimalizuje sumę kwadratów residuów metodą macierzową X'X β = X'y
// Uproszczona implementacja bez bibliotek - działa dla 2-4 zmiennych.

function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length, cols = B[0].length
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      A[r].reduce((s, _, k) => s + A[r][k] * B[k][c], 0)
    )
  )
}

function matTranspose(A: number[][]): number[][] {
  return A[0].map((_, c) => A.map(row => row[c]))
}

// Odwracanie macierzy 2×2 lub 3×3 metodą kofaktorów (wystarczy dla naszego modelu)
function matInv3(M: number[][]): number[][] {
  const [a, b, c] = M[0], [d, e, f] = M[1], [g, h, i] = M[2]
  const det = a*(e*i-f*h) - b*(d*i-f*g) + c*(d*h-e*g)
  return [
    [(e*i-f*h)/det, (c*h-b*i)/det, (b*f-c*e)/det],
    [(f*g-d*i)/det, (a*i-c*g)/det, (c*d-a*f)/det],
    [(d*h-e*g)/det, (b*g-a*h)/det, (a*e-b*d)/det],
  ]
}

function matInv4(M: number[][]): number[][] {
  // Uproszczone przez eliminację Gaussa dla macierzy 4×4
  const n = 4
  const A = M.map(row => [...row])
  const I = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  )
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++)
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [I[col], I[maxRow]] = [I[maxRow], I[col]]
    const pivot = A[col][col]
    for (let j = 0; j < n; j++) { A[col][j] /= pivot; I[col][j] /= pivot }
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = A[row][col]
      for (let j = 0; j < n; j++) {
        A[row][j] -= factor * A[col][j]
        I[row][j] -= factor * I[col][j]
      }
    }
  }
  return I
}

export function olsMultiple(
  X_raw: number[][], // każda kolumna = jedna zmienna niezależna
  y: number[],
  _varNames: string[] = []
): { betas: number[]; r2: number; yhat: number[] } {
  // Dodaj kolumnę stałej (intercept)
  const X = X_raw[0].map((_, i) => [1, ...X_raw.map(col => col[i])])
  const Xt = matTranspose(X)
  const XtX = matMul(Xt, X)
  const Xty = matMul(Xt, y.map(v => [v]))
  const k = XtX.length
  const XtXinv = k === 3 ? matInv3(XtX) : matInv4(XtX)
  const betas_mat = matMul(XtXinv, Xty)
  const betas = betas_mat.map(r => r[0])

  // Guard: współliniowe dane → macierz osobliwa → NaN/Infinity. Zwróć degenerację,
  // którą caller (np. analyzeRetention) zgłosi jako słabe dopasowanie (r2=0).
  if (betas.some(b => !Number.isFinite(b))) {
    const my0 = mean(y)
    return { betas: new Array(X_raw.length).fill(0), r2: 0, yhat: y.map(() => my0) }
  }

  const yhat = X.map(row => betas.reduce((s, b, j) => s + b * row[j], 0))
  const my = mean(y)
  const sst = y.reduce((s, v) => s + (v - my) ** 2, 0)
  const sse = y.reduce((s, v, i) => s + (v - yhat[i]) ** 2, 0)
  const r2 = 1 - sse / sst

  return { betas: betas.slice(1), r2, yhat }
}

// ─── Analiza rekrutacji ───────────────────────────────────────────────────────

export function analyzeRekrutacje(data: Rekrutacja[]) {
  const sorted = [...data].sort(
    (a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1)
  )
  const zglos  = sorted.map(r => r.zgloszenia)
  const przyj  = sorted.map(r => r.przyjeci)
  const cr     = sorted.map(r => parseFloat(((r.przyjeci / r.zgloszenia) * 100).toFixed(1)))

  const jesienData = data.filter(r => r.sezon === 'jesien')
  const wiosnaData = data.filter(r => r.sezon === 'wiosna')

  const corZglosAccepted = pearsonTest(zglos, przyj)
  const sezonowosc = welchT(
    jesienData.map(r => r.przyjeci),
    wiosnaData.map(r => r.przyjeci)
  )

  // Prosta prognoza liniowa na następne 2 edycje
  const xIdx = sorted.map((_, i) => i)
  const reg = { ...(() => {
    const mx = mean(xIdx), my = mean(przyj)
    const b1 = xIdx.reduce((s, v, i) => s + (v - mx) * (przyj[i] - my), 0) /
                xIdx.reduce((s, v) => s + (v - mx) ** 2, 0)
    const b0 = my - b1 * mx
    return { b0, b1 }
  })() }
  const forecast = [sorted.length, sorted.length + 1].map(i =>
    Math.max(1, Math.round(reg.b0 + reg.b1 * i))
  )

  return { sorted, zglos, przyj, cr, corZglosAccepted, sezonowosc, forecast }
}

// ─── Analiza retencji ────────────────────────────────────────────────────────

export function analyzeRetention(kohort: Kohorta[]): RegressionResult {
  const complete = kohort.filter(k => !k.in_progress)
  if (complete.length < 4) {
    return {
      r2: 0,
      coefficients: [],
      prediction: 0,
      warning: `Za mało danych (n=${complete.length}). Potrzeba co najmniej 4 ukończonych kohort.`
    }
  }

  const sorted = [...complete].sort(
    (a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1)
  )

  const edNr  = sorted.map((_, i) => i)
  const sezon = sorted.map(k => k.sezon === 'jesien' ? 1 : 0)
  const nCzl  = sorted.map(k => k.n_czlonkow)
  const y     = sorted.map(k => k.avg_retention_sem)

  const { betas, r2 } = olsMultiple([edNr, sezon, nCzl], y, [])

  const varDefs = [
    {
      name: 'Nr edycji (trend czasowy)',
      beta: betas[0],
      interpretation: betas[0] < 0
        ? `Każda kolejna edycja to ${Math.abs(betas[0]).toFixed(2).replace('.', ',')} sem. krótszej retencji - trend spadkowy wymaga interwencji.`
        : `Trend rosnący: +${betas[0].toFixed(2).replace('.', ',')} sem. na edycję - poprawa jakości rekrutacji lub środowiska organizacyjnego.`
    },
    {
      name: 'Sezon (1=jesień, 0=wiosna)',
      beta: betas[1],
      interpretation: `Edycje ${betas[1] > 0 ? 'jesienne mają wyższą' : 'wiosenne mają wyższą'} retencję o ${Math.abs(betas[1]).toFixed(2).replace('.', ',')} sem. po uwzględnieniu pozostałych zmiennych.`
    },
    {
      name: 'Liczba przyjętych',
      beta: betas[2],
      interpretation: Math.abs(betas[2]) < 0.05
        ? `Efekt minimalny (β=${betas[2].toFixed(3).replace('.', ',')}) - liczba przyjętych nie wyjaśnia retencji. Liczy się jakość, nie wolumen.`
        : `Każda dodatkowa przyjęta osoba zmienia retencję o ${betas[2].toFixed(3).replace('.', ',')} sem.`
    },
  ]

  // Prognoza dla następnej edycji jesiennej
  const nextIdx = sorted.length
  const predNext = betas[0] * nextIdx + betas[1] * 1 + betas[2] * mean(nCzl)
  const intercept = mean(y) - betas[0] * mean(edNr) - betas[1] * mean(sezon) - betas[2] * mean(nCzl)
  const prediction = parseFloat((intercept + predNext).toFixed(2))

  return {
    r2,
    coefficients: varDefs,
    prediction: Math.max(0, prediction),
    warning: r2 < 0.4
      ? `R²=${(r2 * 100).toFixed(0)}% - model słabo dopasowany. Kluczowe zmienne (jakość wdrażania nowych osób, obciążenie sesją) nie są jeszcze mierzone.`
      : null
  }
}

// ─── Z-score komisji ──────────────────────────────────────────────────────────

export function analyzeKomisje(periods: KpiPeriod[]) {
  const realizacje = periods.map(p =>
    parseFloat(((p.projekty_zrealizowane / p.projekty_planowane) * 100).toFixed(1))
  )
  const zs = zScores(realizacje)
  const m  = mean(realizacje)
  const s  = sd(realizacje)

  const corProjKpi = pearsonTest(
    periods.map(p => p.projekty_planowane),
    realizacje
  )

  return {
    realizacje,
    zs,
    mean: parseFloat(m.toFixed(1)),
    sd: parseFloat(s.toFixed(1)),
    corProjKpi,
    withZ: periods.map((p, i) => ({
      ...p,
      realizacjaPct: realizacje[i],
      z: zs[i],
      interpretation: zInterpretation(zs[i])
    }))
  }
}

// ─── Krzywa przeżycia kohort (aproksymacja wykładnicza) ──────────────────────
// S(sem) = exp(−sem / avg). Średnia rozkładu = avg (spójne z avg_retention_sem).

export function retentionFraction(avg: number, sem: number): number {
  if (avg <= 0) return sem <= 0 ? 1 : 0
  return Math.exp(-sem / avg)
}

export function survivalCurve(avg: number, max: number): { sem: number; pct: number }[] {
  const maxSem = Math.max(0, Math.round(max))
  const out: { sem: number; pct: number }[] = []
  for (let s = 0; s <= maxSem; s++) {
    out.push({ sem: s, pct: Math.round(100 * retentionFraction(avg, s) * 10) / 10 })
  }
  return out
}

// ─── Lejek rekrutacyjny ──────────────────────────────────────────────────────

export interface FunnelStage {
  stage: string
  count: number
  pct: number
}

export function buildFunnel(
  rekr: Rekrutacja[],
  koh: Kohorta[],
  opts: { edycja?: string; threshold: number },
): FunnelStage[] {
  const kohByEd = new Map(koh.map((k) => [k.edycja, k]))
  const rows = opts.edycja ? rekr.filter((r) => r.edycja === opts.edycja) : rekr

  let zgloszenia = 0
  let przyjeci = 0
  let aktywni = 0
  let utrzymani = 0
  for (const r of rows) {
    zgloszenia += r.zgloszenia
    przyjeci += r.przyjeci
    const k = kohByEd.get(r.edycja)
    if (k) {
      aktywni += k.n_czlonkow
      utrzymani += Math.round(k.n_czlonkow * retentionFraction(k.avg_retention_sem, opts.threshold))
    }
  }

  const raw = [
    { stage: 'Zgłoszenia', count: zgloszenia },
    { stage: 'Przyjęci', count: przyjeci },
    { stage: 'Aktywni', count: aktywni },
    { stage: `Utrzymani po ${opts.threshold} sem.`, count: utrzymani },
  ]
  return raw.map((s) => ({
    ...s,
    pct: zgloszenia > 0 ? Math.round((s.count / zgloszenia) * 1000) / 10 : 0,
  }))
}

// ─── Mapowanie semestru KPI na edycję + agregat organizacyjny ────────────────

export function parseSemestr(s: string): { sezon: Sezon; rok: number } | null {
  const m = s.trim().toLowerCase().match(/^(letni|zimowy)\s+(\d{4})\/\d{4}$/)
  if (!m) return null
  const typ = m[1]
  const y1 = Number(m[2])
  return typ === 'zimowy' ? { sezon: 'jesien', rok: y1 } : { sezon: 'wiosna', rok: y1 + 1 }
}

export function orgKpiByEdition(periods: KpiPeriod[]): Map<string, number> {
  const bySem = new Map<string, number[]>()
  for (const p of periods) {
    if (p.projekty_planowane <= 0) continue
    const pct = (p.projekty_zrealizowane / p.projekty_planowane) * 100
    const arr = bySem.get(p.semestr) ?? []
    arr.push(pct)
    bySem.set(p.semestr, arr)
  }
  const out = new Map<string, number>()
  for (const [sem, arr] of bySem) {
    const ed = parseSemestr(sem)
    if (!ed) continue
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length
    out.set(`${ed.sezon}-${ed.rok}`, Math.round(avg * 10) / 10)
  }
  return out
}

// ─── Macierz korelacji ───────────────────────────────────────────────────────

export interface CorrCell {
  a: string
  b: string
  r: number | null
  significant: boolean
}

export function correlationMatrix(
  rows: Record<string, number | null>[],
  vars: string[],
): CorrCell[] {
  const cells: CorrCell[] = []
  for (const a of vars) {
    for (const b of vars) {
      if (a === b) {
        cells.push({ a, b, r: 1, significant: true })
        continue
      }
      const pairs = rows
        .map((row) => [row[a], row[b]] as const)
        .filter(([x, y]) => x != null && y != null) as [number, number][]
      if (pairs.length < 3) {
        cells.push({ a, b, r: null, significant: false })
        continue
      }
      const res = pearsonTest(pairs.map((p) => p[0]), pairs.map((p) => p[1]))
      cells.push({ a, b, r: res.r, significant: res.significant })
    }
  }
  return cells
}

// ─── Prognoza liniowa z przedziałem predykcji ────────────────────────────────
// Dopasowuje y ~ a + b·i, prognozuje `steps` kolejnych punktów.
// SE_pred = s·√(1 + 1/n + (x₀−x̄)²/Sxx) - przedział rośnie z odległością.

export interface ForecastPoint {
  i: number
  yhat: number
  lo: number
  hi: number
}

export function linearForecast(y: number[], steps: number): ForecastPoint[] {
  const n = y.length
  const xs = y.map((_, i) => i)
  const mx = mean(xs)
  const my = mean(y)
  const Sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  const b = Sxx === 0 ? 0 : xs.reduce((s, x, i) => s + (x - mx) * (y[i] - my), 0) / Sxx
  const a = my - b * mx
  const sse = y.reduce((s, v, i) => s + (v - (a + b * i)) ** 2, 0)
  const sErr = n > 2 ? Math.sqrt(sse / (n - 2)) : 0

  const r1 = (v: number) => Math.round(v * 10) / 10
  const out: ForecastPoint[] = []
  for (let k = 1; k <= steps; k++) {
    const x0 = n - 1 + k
    const yhat = a + b * x0
    const sePred = Sxx > 0 ? sErr * Math.sqrt(1 + 1 / n + (x0 - mx) ** 2 / Sxx) : sErr
    out.push({ i: x0, yhat: r1(yhat), lo: r1(Math.max(0, yhat - sePred)), hi: r1(yhat + sePred) })
  }
  return out
}

// ─── Model retencji OLS jako predyktor dowolnych wejść ───────────────────────
// (Oddzielny od analyzeRetention, by nie zmieniać jego zachowania/testów.)

export interface RetentionModel {
  predict: (edNr: number, sezonJesien: 0 | 1, nCzl: number) => number
  r2: number
  n: number
  residualSd: number
  nextEdNr: number
  meanNCzl: number
}

export function retentionModel(kohort: Kohorta[]): RetentionModel | null {
  const complete = kohort.filter((k) => !k.in_progress)
  if (complete.length < 4) return null
  const sorted = [...complete].sort((a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1))

  const edNr = sorted.map((_, i) => i)
  const sezon = sorted.map((k) => (k.sezon === 'jesien' ? 1 : 0))
  const nCzl = sorted.map((k) => k.n_czlonkow)
  const y = sorted.map((k) => k.avg_retention_sem)

  const { betas, r2, yhat } = olsMultiple([edNr, sezon, nCzl], y, [])
  const intercept = mean(y) - betas[0] * mean(edNr) - betas[1] * mean(sezon) - betas[2] * mean(nCzl)
  const sse = y.reduce((s, v, i) => s + (v - yhat[i]) ** 2, 0)
  const residualSd = sorted.length > 4 ? Math.sqrt(sse / (sorted.length - 4)) : 0

  const predict = (e: number, sz: 0 | 1, nc: number) =>
    Math.max(0, intercept + betas[0] * e + betas[1] * sz + betas[2] * nc)

  return { predict, r2, n: sorted.length, residualSd, nextEdNr: sorted.length, meanNCzl: mean(nCzl) }
}

// ─── Prognozy z podziałem na sezony ──────────────────────────────────────────
// Edycje wiosenne są kilka razy mniejsze od jesiennych, więc jedna prosta
// przez obie (J, W, J, W...) kreśli piłę i prognozuje średnią z obu sezonów.
// Każdą przyszłą edycję liczymy z historii jej własnego sezonu.

export interface PrognozaEdycji {
  edycja: string
  sezon: Sezon
  yhat: number
  lo: number
  hi: number
}

const wgCzasu = <T extends { rok: number; sezon: Sezon }>(a: T, b: T) =>
  a.rok - b.rok || (a.sezon === b.sezon ? 0 : a.sezon === 'wiosna' ? -1 : 1)

export function prognozaPrzyjetych(rekrutacje: Rekrutacja[], kroki: number): PrognozaEdycji[] {
  const sorted = [...rekrutacje].sort(wgCzasu)
  const ostatnia = sorted.at(-1)
  if (!ostatnia) return []
  const out: PrognozaEdycji[] = []
  const krokWSezonie: Record<Sezon, number> = { jesien: 0, wiosna: 0 }
  for (const nast of kolejneSemestry(ostatnia.sezon, ostatnia.rok, kroki)) {
    const krok = ++krokWSezonie[nast.sezon]
    const hist = sorted.filter((r) => r.sezon === nast.sezon).map((r) => r.przyjeci)
    if (hist.length < 2) continue
    const f = linearForecast(hist, krok)[krok - 1]
    out.push({ edycja: nast.label, sezon: nast.sezon, yhat: Math.max(0, f.yhat), lo: f.lo, hi: f.hi })
  }
  return out
}

/**
 * Średnia retencja następnej edycji po ostatniej ukończonej. Liczebność
 * bierzemy z tej edycji (jeśli już jest w danych) albo średnią jej sezonu -
 * średnia ze wszystkich (ok. 26) to „jesień z wiosenną obsadą”, której model
 * nigdy nie widział, i prognoza wyskakiwała do ok. 6 sem. przy historii 2,7-4,4.
 */
export function prognozaRetencji(kohorty: Kohorta[]): PrognozaEdycji | null {
  const model = retentionModel(kohorty)
  if (!model) return null
  const ukonczone = kohorty.filter((k) => !k.in_progress).sort(wgCzasu)
  const ost = ukonczone[ukonczone.length - 1]
  const [nast] = kolejneSemestry(ost.sezon, ost.rok, 1)
  const zSezonu = ukonczone.filter((k) => k.sezon === nast.sezon)
  const n =
    kohorty.find((k) => k.edycja === nast.label)?.n_czlonkow ??
    (zSezonu.length ? mean(zSezonu.map((k) => k.n_czlonkow)) : model.meanNCzl)
  const r2 = (v: number) => Math.round(v * 100) / 100
  const yhat = model.predict(model.nextEdNr, nast.sezon === 'jesien' ? 1 : 0, n)
  const sd = model.residualSd
  return { edycja: nast.label, sezon: nast.sezon, yhat: r2(yhat), lo: r2(Math.max(0, yhat - sd)), hi: r2(yhat + sd) }
}

// ─── Grupowanie KPI po komisji (drill-down / trend) ──────────────────────────

export function kpiByKomisja(periods: KpiPeriod[]): Map<string, KpiPeriod[]> {
  const m = new Map<string, KpiPeriod[]>()
  for (const p of periods) {
    const arr = m.get(p.komisja_id) ?? []
    arr.push(p)
    m.set(p.komisja_id, arr)
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  return m
}

// ─── Alerty / anomalie ───────────────────────────────────────────────────────

export interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  recommendation: string
  href: string
}

const SEVERITY_ORDER: Record<Alert['severity'], number> = { critical: 0, warning: 1, info: 2 }
/** Spadek KPI mniejszy niz tyle sztuk nie daje alertu. */
const KPI_MIN_SPADEK = 3
/** Krytyczny tylko od takiej wartosci w poprzednim okresie; nizej najwyzej ostrzezenie. */
const KPI_MIN_BAZA_KRYTYCZNY = 10

export function buildAlerts(
  rekrutacje: Rekrutacja[],
  kohorty: Kohorta[],
  kpiSerie: SeriaKpi[],
): Alert[] {
  const alerts: Alert[] = []

  // 1. Metryki ze spadkiem miedzy dwoma ostatnimi okresami.
  // Jedna seria to jeden alert, niezaleznie od tego, ile lat obejmuje.
  // KPI to liczebnosci, czesto jednocyfrowe (koordynatorzy 1-2 osoby):
  // spadek o 1-2 to szum, a krytyczny wymaga bazy, z ktorej procent cos mowi.
  for (const s of kpiSerie) {
    const ratio = ilorazSerii(s)
    if (ratio <= 0 || ratio >= 0.8) continue
    const przed = s.punkty[s.punkty.length - 2].wartosc
    const teraz = s.punkty[s.punkty.length - 1].wartosc
    if (przed - teraz < KPI_MIN_SPADEK) continue
    const id = `kpi-${s.kategoria}-${s.nazwa}`
    const detail = `${przed} → ${teraz} (${zmianaRr(ratio)} r/r)`
    alerts.push(
      ratio < 0.6 && przed >= KPI_MIN_BAZA_KRYTYCZNY
        ? { id, severity: 'critical', title: `${s.kategoria}: ${s.nazwa} - duży spadek`, detail, recommendation: 'Sprawdź przyczyny - priorytet Zarządu.', href: '/analytics/kpi' }
        : { id, severity: 'warning', title: `${s.kategoria}: ${s.nazwa} - spadek r/r`, detail, recommendation: 'Monitorować trend.', href: '/analytics/kpi' },
    )
  }

  // 2. Spadek retencji
  const completed = [...kohorty]
    .filter((k) => !k.in_progress)
    .sort((a, b) => a.rok - b.rok || (a.sezon === 'wiosna' ? -1 : 1))
  if (completed.length >= 2) {
    const first = completed[0]
    const last = completed[completed.length - 1]
    if (last.avg_retention_sem < first.avg_retention_sem) {
      alerts.push({ id: 'ret-decline', severity: 'warning', title: 'Spadkowy trend retencji', detail: `Z ${first.avg_retention_sem.toFixed(1).replace('.', ',')} (${first.edycja}) do ${last.avg_retention_sem.toFixed(1).replace('.', ',')} sem. (${last.edycja}).`, recommendation: 'Sprawdź wdrażanie nowych osób i obciążenie sesją.', href: '/analytics/retencja' })
    }
  }

  // 3. Niski CR
  if (rekrutacje.length >= 2) {
    const s = analyzeRekrutacje(rekrutacje)
    const meanCR = mean(s.cr)
    const lastCR = s.cr[s.cr.length - 1]
    if (meanCR > 0 && lastCR < 0.7 * meanCR) {
      alerts.push({ id: 'cr-low', severity: 'warning', title: 'Niska konwersja ostatniej edycji', detail: `Konwersja ${lastCR}% wobec średniej ${meanCR.toFixed(1).replace('.', ',')}%.`, recommendation: 'Sprawdź jakość kandydatów / proces rekrutacji.', href: '/analytics/rekrutacje' })
    }
  }

  // 4. Wyciek w lejku
  if (rekrutacje.length >= 1 && kohorty.length >= 1) {
    const funnel = buildFunnel(rekrutacje, kohorty, { threshold: 2 })
    let worstIdx = -1
    let worstDrop = -1
    for (let i = 1; i < funnel.length; i++) {
      const prev = funnel[i - 1].count
      const drop = prev > 0 ? (prev - funnel[i].count) / prev : 0
      if (drop > worstDrop) {
        worstDrop = drop
        worstIdx = i
      }
    }
    if (worstIdx > 0 && worstDrop > 0.5) {
      alerts.push({ id: 'funnel-leak', severity: 'info', title: 'Duży wyciek w lejku', detail: `${funnel[worstIdx - 1].stage} → ${funnel[worstIdx].stage}: −${Math.round(worstDrop * 100)}%.`, recommendation: 'Najsłabszy etap ścieżki - punkt do poprawy.', href: '/analytics/lejek' })
    }
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

// ─── KPI rok-do-roku ─────────────────────────────────────────────────────────
// Iloraz i grupowanie mieszkaja w lib/kpi/serie.ts - tu zostaje tylko to,
// co skleja metryki w obraz calosci.

export function kpiSummary(serie: SeriaKpi[]): { up: number; down: number; typowyIloraz: number } {
  // ilorazSerii zwraca 0, gdy nie da sie policzyc: seria jednopunktowa
  // albo zerowy mianownik. Takie serie nie moga ciagnac wyniku w dol.
  const policzalne = serie.map(ilorazSerii).filter((r) => r > 0)
  if (policzalne.length === 0) return { up: 0, down: 0, typowyIloraz: 0 }
  let up = 0
  let down = 0
  for (const r of policzalne) {
    if (r > 1) up++
    else if (r < 1) down++
  }
  // Mediana, nie srednia: metryk jest kilkanascie, a jeden skok z malej bazy
  // (Gala 1 -> 5, iloraz 5) podnosil srednia do „+29%”, choc typowa metryka
  // stala w miejscu.
  const r = [...policzalne].sort((a, b) => a - b)
  const s = Math.floor(r.length / 2)
  const mediana = r.length % 2 ? r[s] : (r[s - 1] + r[s]) / 2
  return { up, down, typowyIloraz: Math.round(mediana * 100) / 100 }
}

// ─── Członkowie (widok per-osoba) ────────────────────────────────────────────

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

function scoreTrend(score: number): StrategicKpi['trend'] {
  if (score >= 70) return 'up'
  if (score < 45) return 'down'
  return 'flat'
}

export function buildStrategicKpis(
  rekrutacje: Rekrutacja[],
  kohorty: Kohorta[],
  serie: SeriaKpi[],
): StrategicKpi[] {
  const crs = rekrutacje
    .filter((r) => r.zgloszenia > 0)
    .map((r) => (r.przyjeci / r.zgloszenia) * 100)
  const avgCr = crs.length ? mean(crs) : 0
  const totalApplications = rekrutacje.reduce((s, r) => s + r.zgloszenia, 0)
  const totalAccepted = rekrutacje.reduce((s, r) => s + r.przyjeci, 0)
  const totalCr = totalApplications > 0 ? (totalAccepted / totalApplications) * 100 : 0

  const completed = kohorty.filter((k) => !k.in_progress)
  const avgRetention = completed.length ? mean(completed.map((k) => k.avg_retention_sem)) : 0
  const retentionAfter2 = kohorty.length
    ? mean(kohorty.map((k) => (k.survival?.[2] ?? retentionFraction(k.avg_retention_sem, 2) * 100)))
    : 0

  const summary = kpiSummary(serie)
  const kpiScore = clampScore(summary.typowyIloraz * 70)
  const leaderRows = serie.filter((s) => s.kategoria.toLowerCase().includes('koordynator'))
  // ilorazSerii daje 0 dla serii jednopunktowych i zerowych mianownikow,
  // wiec warunek `>= 1` sam je odsiewa.
  const leaderGrowth = leaderRows.filter((s) => ilorazSerii(s) >= 1).length
  const leaderScore = leaderRows.length ? clampScore((leaderGrowth / leaderRows.length) * 100) : 0

  const healthScore = clampScore((totalCr / 65) * 25 + (avgRetention / 4.5) * 30 + (retentionAfter2 / 100) * 25 + kpiScore * 0.2)
  const activationScore = clampScore(retentionAfter2)
  const recruitmentQuality = clampScore((avgCr / 55) * 65 + (totalCr / 45) * 35)
  const deliveryMomentum = clampScore(summary.typowyIloraz * 100)

  return [
    {
      id: 'health',
      title: 'Kondycja organizacji',
      value: `${healthScore}/100`,
      score: healthScore,
      trend: scoreTrend(healthScore),
      detail: 'Syntetyczny wynik z konwersji, retencji, utrzymania po 2 sem. i KPI r/r.',
      recommendation:
        healthScore >= 70
          ? 'Utrzymać obecny rytm i przenieść najlepsze praktyki do słabszych obszarów.'
          : 'Najpierw sprawdzić wdrażanie nowych osób, przeciążenie aktywnych i metryki ze spadkiem r/r.',
    },
    {
      id: 'leadership',
      title: 'Następcy koordynatorów',
      value: leaderRows.length ? `${leaderGrowth}/${leaderRows.length}` : 'brak',
      score: leaderScore,
      trend: scoreTrend(leaderScore),
      detail: 'Ile metryk koordynatorskich nie spada rok do roku.',
      recommendation: 'Obserwować jako wczesny sygnał, czy będzie komu prowadzić projekty.',
    },
    {
      id: 'retention-2',
      title: 'Utrzymanie po 2 semestrach',
      value: `${Math.round(retentionAfter2)}%`,
      score: activationScore,
      trend: scoreTrend(activationScore),
      detail: 'Odsetek osób z kohort aktywnych po dwóch semestrach, liczony z krzywych przeżycia.',
      recommendation: 'Najszybszy test, jak działa wdrażanie nowych osób i ich pierwsze doświadczenia w samorządzie.',
    },
    {
      id: 'recruitment-quality',
      title: 'Jakość rekrutacji',
      value: `${Math.round(avgCr)}% konwersji`,
      score: recruitmentQuality,
      trend: scoreTrend(recruitmentQuality),
      detail: `Łączy średnią konwersję edycji i konwersję całej historii (${Math.round(totalCr)}%).`,
      recommendation: 'Czytać razem z retencją: wysoka konwersja bez utrzymania może znaczyć zbyt łagodną selekcję.',
    },
    {
      id: 'momentum',
      title: 'Tempo rozwoju',
      value: `${zmianaRr(summary.typowyIloraz)} r/r`,
      score: deliveryMomentum,
      trend: scoreTrend(deliveryMomentum),
      detail: `Typowa (środkowa) zmiana KPI rok do roku; rośnie ${summary.up}, spada ${summary.down}.`,
      recommendation: 'Dobre do kwartalnego przeglądu: pokazuje, czy samorząd przyspiesza, czy traci tempo.',
    },
  ]
}

export function buildExecutiveInsights(
  rekrutacje: Rekrutacja[],
  kohorty: Kohorta[],
  serie: SeriaKpi[],
): ExecutiveInsight[] {
  const insights: ExecutiveInsight[] = []
  const strategic = buildStrategicKpis(rekrutacje, kohorty, serie)
  const health = strategic.find((k) => k.id === 'health')
  const retention2 = strategic.find((k) => k.id === 'retention-2')
  const leadership = strategic.find((k) => k.id === 'leadership')
  const momentum = strategic.find((k) => k.id === 'momentum')

  if (health && health.score < 70) {
    insights.push({
      id: 'health-watch',
      priority: health.score < 45 ? 'high' : 'medium',
      title: 'Kondycja organizacji wymaga uwagi',
      metric: health.value,
      detail: health.detail,
      action: 'Przejrzeć wdrażanie nowych osób, obciążenie aktywnych i metryki ze spadkiem r/r.',
      href: '/analytics/kpi',
    })
  }

  if (retention2 && retention2.score < 85) {
    insights.push({
      id: 'retention-after-2',
      priority: retention2.score < 65 ? 'high' : 'medium',
      title: 'Wczesna retencja jest kluczowym punktem kontroli',
      metric: retention2.value,
      detail: 'Ten wskaźnik najszybciej pokazuje, czy nowi członkowie przechodzą z rekrutacji do realnego działania.',
      action: 'Dodać rozmowy po 30, 60 i 90 dniach i mierzyć aktywność każdej osoby w pierwszym semestrze.',
      href: '/analytics/retencja',
    })
  }

  if (leadership && leadership.score < 75) {
    insights.push({
      id: 'leadership-pipeline',
      priority: leadership.score < 50 ? 'high' : 'medium',
      title: 'Brak następców koordynatorów może być wąskim gardłem',
      metric: leadership.value,
      detail: leadership.detail,
      action: 'Prowadzić osobną listę kandydatów na koordynatorów i oceniać gotowość następców w każdym projekcie.',
      href: '/analytics/kpi',
    })
  }

  if (momentum && momentum.score >= 110) {
    insights.push({
      id: 'momentum-upside',
      priority: 'low',
      title: 'Samorząd przyspiesza',
      metric: momentum.value,
      detail: 'Średni wynik KPI rok do roku rośnie - warto znaleźć praktyki, które napędzają wzrost.',
      action: 'Wybrać 3 największe wzrosty KPI i zamienić je w standard pracy dla podobnych obszarów.',
      href: '/analytics/kpi',
    })
  }

  const alerts = buildAlerts(rekrutacje, kohorty, serie)
  for (const alert of alerts.slice(0, 3)) {
    insights.push({
      id: `alert-${alert.id}`,
      priority: alert.severity === 'critical' ? 'high' : alert.severity === 'warning' ? 'medium' : 'low',
      title: alert.title,
      metric: alert.severity === 'critical' ? 'KRYTYCZNY' : alert.severity === 'warning' ? 'OSTRZEŻENIE' : 'INFO',
      detail: alert.detail,
      action: alert.recommendation,
      href: alert.href,
    })
  }

  return insights
    .sort((a, b) => {
      const order: Record<ExecutiveInsight['priority'], number> = { high: 0, medium: 1, low: 2 }
      return order[a.priority] - order[b.priority]
    })
    .slice(0, 5)
}

export function kolejneSemestry(sezon: Sezon, rok: number, count: number): { label: string; sezon: Sezon; rok: number }[] {
  const out: { label: string; sezon: Sezon; rok: number }[] = []
  let s: Sezon = sezon
  let r = rok
  for (let i = 0; i < count; i++) {
    if (s === 'jesien') {
      s = 'wiosna'
      r += 1
    } else {
      s = 'jesien'
    }
    out.push({ label: `${s === 'jesien' ? 'J' : 'W'}'${String(r).slice(-2)}`, sezon: s, rok: r })
  }
  return out
}

export function memberStatusCounts(members: Czlonek[]): Record<CzlonekStatus, number> {
  const out: Record<CzlonekStatus, number> = { aktywny: 0, 'wspierający': 0, alumn: 0, zawieszone: 0, nieaktywny: 0 }
  for (const m of members) out[m.status]++
  return out
}

// Realna krzywa przeżycia z siatki: [100, % aktywnych po 1 sem, ...] (aktywnosc[t] > 0)
export function survivalFromMembers(members: Czlonek[]): number[] {
  if (members.length === 0) return [100]
  const maxLen = Math.max(...members.map((m) => m.aktywnosc.length))
  const out = [100]
  for (let t = 0; t < maxLen; t++) {
    const active = members.filter((m) => (m.aktywnosc[t] ?? 0) > 0).length
    out.push(Math.round((active / members.length) * 1000) / 10)
  }
  return out
}
