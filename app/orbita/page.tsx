import { redirect } from 'next/navigation'
import { ktoNaStronie } from '@/lib/auth/naStronie'
import { dzisWarszawa } from '@/lib/czas'
import { OrbitaClient, type Widok } from '@/components/orbita/OrbitaClient'

const WIDOKI: Widok[] = ['dzis', 'radar', 'lista']

export default async function OrbitaPage({ searchParams }: { searchParams: Promise<{ widok?: string; zDziennika?: string }> }) {
  const kto = await ktoNaStronie()
  if (!kto) redirect('/login')
  // Zadania funkcji są tylko dla konta instytucji - zarząd wraca do kokpitu.
  if (kto.rola !== 'owner') redirect('/')

  const { widok, zDziennika } = await searchParams
  return (
    <OrbitaClient
      dzis={dzisWarszawa(new Date())}
      widok={WIDOKI.includes(widok as Widok) ? (widok as Widok) : 'dzis'}
      zDziennika={zDziennika || null}
    />
  )
}
