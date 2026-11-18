export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toFixed(decimals)
}

/**
 * Iloraz rok do roku (teraz / przed) jako zmiana ze znakiem: 0,6 → „-40%”,
 * 1,29 → „+29%”. Sam iloraz w procentach („60% r/r”) czyta się jak zmianę
 * i myli. 0 to umowa ilorazSerii: nie da się policzyć.
 */
export function zmianaRr(iloraz: number): string {
  if (!(iloraz > 0)) return '-'
  const p = Math.round((iloraz - 1) * 100)
  if (p === 0) return iloraz === 1 ? '0%' : iloraz > 1 ? '+<1%' : '-<1%'
  return `${p > 0 ? '+' : '-'}${Math.abs(p)}%`
}
