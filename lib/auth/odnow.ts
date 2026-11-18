'use client'
import { firebaseSkonfigurowany } from './firebase'

let trwa: Promise<boolean> | null = null

/**
 * Odnawia ciasteczko `deck_session` z konta, które Firebase pamięta w przeglądarce.
 *
 * Ciasteczko to token Firebase ważny godzinę. Odnawia go nasłuch w useAuth,
 * ale ten startuje dopiero, gdy serwer potwierdzi sesję - po godzinie przerwy
 * serwer mówi „Brak sesji”, nasłuch nie rusza i strona zostawała bez danych,
 * choć konto było zalogowane. Kilka zapytań naraz dzieli jedno odnowienie.
 */
export function odnowSesje(): Promise<boolean> {
  if (!firebaseSkonfigurowany) return Promise.resolve(false)
  trwa ??= (async () => {
    try {
      const { auth } = await import('./firebase')
      const a = auth()
      await a.authStateReady()
      if (!a.currentUser) return false
      const token = await a.currentUser.getIdToken(true)
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      return res.ok
    } catch {
      return false
    } finally {
      // Następne wygaśnięcie (za godzinę) ma prawo spróbować od nowa.
      setTimeout(() => {
        trwa = null
      }, 0)
    }
  })()
  return trwa
}

/** fetch, który przy 401 odnawia sesję i ponawia zapytanie jeden raz. */
export async function fetchZSesja(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (res.status !== 401) return res
  return (await odnowSesje()) ? fetch(url, init) : res
}
