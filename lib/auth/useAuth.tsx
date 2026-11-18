'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { firebaseSkonfigurowany } from './firebase'
import type { Rola } from './role'
import { odnowSesje } from './odnow'

export interface StanSesji {
  /** Adres e-mail przy koncie z hasłem; etykieta kodu przy wejściu na kod. */
  kto: string | null
  rola: Rola | null
  /** Skąd wzięła się sesja - decyduje, czy w ogóle potrzebujemy Firebase. */
  sposob: 'haslo' | 'kod' | null
  laduje: boolean
  blad: string | null
}

interface Wartosc extends StanSesji {
  zalogujHaslem: (email: string, haslo: string) => Promise<void>
  zalogujKodem: (kod: string) => Promise<boolean>
  wyloguj: () => Promise<void>
}

const PUSTA: StanSesji = { kto: null, rola: null, sposob: null, laduje: true, blad: null }
const Kontekst = createContext<Wartosc | null>(null)

/** Pyta serwer, kto jest zalogowany - jedna odpowiedź dla obu dróg wejścia. */
async function ktoJestem(): Promise<Pick<StanSesji, 'kto' | 'rola' | 'sposob'>> {
  const res = await fetch('/api/session')
  if (!res.ok) return { kto: null, rola: null, sposob: null }
  const dane = await res.json()
  return { kto: dane.kto ?? null, rola: dane.rola ?? null, sposob: dane.sposob ?? null }
}

/**
 * Sesja żyje w jednym miejscu dla całej aplikacji.
 *
 * Wcześniej `useAuth()` był wołany w ośmiu komponentach i każde wywołanie
 * niezależnie odpytywało `/api/session` oraz zakładało własny nasłuch Firebase.
 * Na stronie Analytics dawało to dwa komplety zapytań i cztery weryfikacje
 * podpisu tokenu po tę samą odpowiedź - stąd wolne wchodzenie w moduły.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [stan, setStan] = useState<StanSesji>(PUSTA)
  const odpiecie = useRef<(() => void) | null>(null)

  const odswiez = useCallback(async () => {
    const kim = await ktoJestem()
    setStan({ ...kim, laduje: false, blad: null })
    return kim
  }, [])

  /**
   * Nasłuch odnawiania tokenu zakładamy dopiero wtedy, gdy jest po co: token
   * wygasa po godzinie i Firebase odnawia go sam, więc ciasteczko musi jechać
   * za nim. Osoby wchodzące kodem nie dotykają Firebase w ogóle, więc i pakiet
   * ładujemy leniwie - nie ma powodu, żeby wisiał w każdej podstronie.
   */
  const pilnujTokenu = useCallback(async () => {
    if (!firebaseSkonfigurowany || odpiecie.current) return
    const [{ onIdTokenChanged }, { auth }] = await Promise.all([
      import('firebase/auth'),
      import('./firebase'),
    ])
    odpiecie.current = onIdTokenChanged(auth(), async (user) => {
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }))
        const { signOut } = await import('firebase/auth')
        await signOut(auth())
        setStan({ ...PUSTA, laduje: false, blad: error ?? 'To konto nie ma dostępu do DECK' })
        return
      }
      const { rola, email } = await res.json()
      setStan({ kto: email, rola, sposob: 'haslo', laduje: false, blad: null })
    })
  }, [])

  useEffect(() => {
    let zywy = true
    void (async () => {
      let kim = await ktoJestem()
      // Wygasły token (godzina bez odnowienia) to nie wylogowanie - Firebase
      // pamięta konto, więc odnawiamy ciasteczko i pytamy jeszcze raz.
      if (!kim.rola && (await odnowSesje())) kim = await ktoJestem()
      if (!zywy) return
      setStan({ ...kim, laduje: false, blad: null })
      if (kim.sposob === 'haslo') void pilnujTokenu()
    })()
    return () => {
      zywy = false
      odpiecie.current?.()
      odpiecie.current = null
    }
  }, [pilnujTokenu])

  const zalogujHaslem = useCallback(
    async (email: string, haslo: string) => {
      setStan((s) => ({ ...s, blad: null }))
      try {
        const [{ signInWithEmailAndPassword }, { auth }] = await Promise.all([
          import('firebase/auth'),
          import('./firebase'),
        ])
        await pilnujTokenu()
        await signInWithEmailAndPassword(auth(), email, haslo)
      } catch {
        // Nie zdradzamy, czy pomylono adres, czy hasło.
        setStan((s) => ({ ...s, blad: 'Nieprawidłowy e-mail lub hasło' }))
      }
    },
    [pilnujTokenu],
  )

  const zalogujKodem = useCallback(
    async (kod: string) => {
      setStan((s) => ({ ...s, blad: null }))
      const res = await fetch('/api/kod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kod }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }))
        setStan((s) => ({ ...s, blad: error ?? 'Kod nie zadziałał' }))
        return false
      }
      await odswiez()
      return true
    },
    [odswiez],
  )

  /** Wylogowanie nie pyta, którą drogą się weszło - kasuje wszystko. */
  const wyloguj = useCallback(async () => {
    if (firebaseSkonfigurowany) {
      const [{ signOut }, { auth }] = await Promise.all([
        import('firebase/auth'),
        import('./firebase'),
      ])
      await signOut(auth()).catch(() => {})
    }
    await fetch('/api/session', { method: 'DELETE' })
    setStan({ ...PUSTA, laduje: false })
  }, [])

  return (
    <Kontekst.Provider value={{ ...stan, zalogujHaslem, zalogujKodem, wyloguj }}>
      {children}
    </Kontekst.Provider>
  )
}

export function useAuth(): Wartosc {
  const wartosc = useContext(Kontekst)
  if (!wartosc) throw new Error('useAuth wymaga AuthProvider - sprawdź app/layout.tsx')
  return wartosc
}
