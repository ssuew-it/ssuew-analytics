import Link from 'next/link'
import { najblizszyTermin } from '@/lib/dziennik/terminy'
import type { WpisCyklu } from '@/lib/dziennik/typy'
import type { ZrodloOtwarte } from '@/lib/orbita/typy'
import { naIso, type Data } from '@/lib/planer/trwanie'

const LINK = 'font-mono text-[10.5px] uppercase tracking-[0.12em] text-deck-accent underline-offset-2 hover:underline'

/**
 * Przejście z obowiązku do Orbity. „w Orbicie” tylko dla tego samego wystąpienia
 * terminu - zeszłoroczne zadanie nie blokuje tegorocznego. `zrodla: null` (błąd odczytu) = zawsze „Weź”.
 */
export function WezDoOrbity({ wpis, dzis, zrodla }: { wpis: WpisCyklu; dzis: Data; zrodla: ZrodloOtwarte[] | null }) {
  const termin = naIso(najblizszyTermin(wpis, dzis))
  const jest = zrodla?.some((z) => z.wpisId === wpis.id && z.termin === termin)
  return jest ? (
    <Link href="/orbita?widok=lista" className={LINK}>w Orbicie</Link>
  ) : (
    <Link href={`/orbita?zDziennika=${encodeURIComponent(wpis.id)}`} className={LINK}>Weź do Orbity</Link>
  )
}
