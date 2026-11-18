// Ciemny motyw dla wykresów recharts - jedno miejsce na kolory/osie.
export const chartTheme = {
  grid: '#21262D',
  axis: '#7D8590',
  accent: '#2EE6A6',
  violet: '#8B7CF6',
  // [accent, violet, błękit, złoto] - kolejne serie
  series: ['#2EE6A6', '#8B7CF6', '#B5D4F4', '#d9b06a'],
} as const

export const axisTick = { fontSize: 11, fill: chartTheme.axis } as const

export const tooltipStyle = {
  background: '#161B22',
  border: '1px solid #21262D',
  borderRadius: 8,
  fontSize: 12,
  color: '#E6EDF3',
} as const

/**
 * Wartość w dymku wykresu po polsku: przecinek dziesiętny, pas prognozy
 * („[lo, hi]”) jako „lo - hi”. Recharts sam pokazuje surowe „46.4”.
 */
export function liczbaPl(v: unknown): string {
  const jedna = (x: unknown) =>
    typeof x === 'number' ? x.toLocaleString('pl-PL', { maximumFractionDigits: 2 }) : String(x)
  return Array.isArray(v) ? v.map(jedna).join(' - ') : jedna(v)
}
