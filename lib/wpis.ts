/** Zakładki „Wpisz dane”, do których prowadzą linki z modułów. */
export type ZakladkaWpisu = 'rekrutacja' | 'kohorta' | 'kpi' | 'rocznik' | 'projekt'

const ZAKLADKI: ZakladkaWpisu[] = ['rekrutacja', 'kohorta', 'kpi', 'rocznik', 'projekt']

/** Dane wpisuje się w jednym miejscu; moduły tylko tu kierują - z edycją do poprawy, jeśli jest. */
export function linkWpisu(zakladka: ZakladkaWpisu, edycja?: string): string {
  const q = new URLSearchParams({ tab: zakladka })
  if (edycja) q.set('edycja', edycja)
  return `/analytics/wpis?${q}`
}

export function zakladkaZAdresu(v: string | null): ZakladkaWpisu {
  return ZAKLADKI.includes(v as ZakladkaWpisu) ? (v as ZakladkaWpisu) : 'rekrutacja'
}
