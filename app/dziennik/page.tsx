import { redirect } from 'next/navigation'
import { ktoNaStronie } from '@/lib/auth/naStronie'
import { dzisWarszawa } from '@/lib/czas'
import { DZIALY, type Dzial } from '@/lib/dziennik/typy'
import { DziennikClient } from '@/components/dziennik/DziennikClient'

/** Powroty ze zgody na Dysk (`/api/skrzynka/oauth`, cel `dysk`). */
const BLEDY: Record<string, string> = {
  'inne-konto': 'Zgoda przyszła z innego konta niż kontakt@samorzad.ue.wroc.pl - zaloguj się w Google jako kontakt@ i spróbuj ponownie.',
  odmowa: 'Zgoda w Google nie została udzielona.',
  niepolaczona: 'Najpierw połącz skrzynkę - Dysk korzysta z tej samej zgody Google.',
  'brak-dysku': 'Zgoda Google nie obejmuje Dysku - kliknij „Połącz Dysk” jeszcze raz i zaznacz uprawnienie do plików.',
  'niepelna-zgoda': 'Przy zgodzie na Dysk zostaw zaznaczone także uprawnienia Gmaila - inaczej skrzynka straciłaby dostęp. Spróbuj ponownie.',
  konfiguracja: 'Połączenie z Google nie jest skonfigurowane na serwerze (zmienne SKRZYNKA_* na Vercelu).',
  polaczenie: 'Nie udało się połączyć z Dyskiem - spróbuj ponownie.',
}

export default async function DziennikPage({ searchParams }: { searchParams: Promise<{ dysk?: string; blad?: string; dzial?: string }> }) {
  const kto = await ktoNaStronie()
  if (!kto) redirect('/login')
  // Księga funkcji jest tylko dla konta instytucji - zarząd wraca do kokpitu.
  if (kto.rola !== 'owner') redirect('/')

  const { dysk, blad, dzial } = await searchParams
  const komunikat = blad ? (BLEDY[blad] ?? BLEDY.polaczenie) : dysk === 'ok' ? 'Dysk połączony - kopie księgi trafią na Dysk kontakt@.' : null
  const dzialStartowy = (DZIALY as readonly string[]).includes(dzial ?? '') ? (dzial as Dzial) : null

  return <DziennikClient dzis={dzisWarszawa(new Date())} komunikat={komunikat} dzialStartowy={dzialStartowy} />
}
