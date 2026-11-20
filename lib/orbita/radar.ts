/** Odległość od środka (0-1) koduje zapas: w środku to, co trzeba zacząć dziś (spec sekcja 9). */
export function promien(zapas: number | null): number {
  if (zapas === null) return 0.95
  if (zapas < 0) return 0.1
  if (zapas === 0) return 0.2
  if (zapas <= 3) return 0.4
  if (zapas <= 14) return 0.62
  return 0.82
}

/** Kąt w radianach, stały dla zadania - z hasza id, jak kolory osób w Planerze. */
export function kat(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return ((h % 360) * Math.PI) / 180
}
