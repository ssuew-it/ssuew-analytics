import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

/**
 * Admin SDK omija reguły Firestore. Każde miejsce, które z niego korzysta, MUSI
 * samo sprawdzić, kto pyta - inaczej byłoby otwartym oknem do bazy.
 *
 * Inicjalizacja jest idempotentna, bo Next trzyma jeden proces dla wielu tras,
 * a dwa wywołania `initializeApp` rzucają błędem o powtórzonej aplikacji.
 */
function aplikacja(): App {
  if (getApps().length) return getApps()[0]
  const klucz = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!klucz) throw new Error('Brak FIREBASE_SERVICE_ACCOUNT')
  return initializeApp({ credential: cert(JSON.parse(klucz)) })
}

export function bazaAdmin(): Firestore {
  return getFirestore(aplikacja())
}

export function wydarzeniaRef(semestrId: string) {
  return bazaAdmin().collection('semestry').doc(semestrId).collection('wydarzenia')
}

export function propozycjeRef(semestrId: string) {
  return bazaAdmin().collection('semestry').doc(semestrId).collection('propozycje')
}

export function semestrRef(semestrId: string) {
  return bazaAdmin().collection('semestry').doc(semestrId)
}

export function komentarzeRef(semestrId: string) {
  return bazaAdmin().collection('semestry').doc(semestrId).collection('komentarze')
}

export function obecnoscRef(semestrId: string) {
  return bazaAdmin().collection('semestry').doc(semestrId).collection('obecnosc')
}

export function ustawieniaRef(nazwa: string) {
  return bazaAdmin().collection('ustawienia').doc(nazwa)
}

/**
 * Odprawa asystenta. Kolekcja nie ma reguły klienta, więc jest zamknięta regułą
 * końcową - czyta i pisze wyłącznie serwer. Zarząd jej nie zobaczy.
 */
export function odprawaRef() {
  return bazaAdmin().collection('asystent').doc('odprawa')
}

/** Rozmowy asystenta - tylko serwer; reguła końcowa zamyka je przed przeglądarką. */
export function rozmowyRef() {
  return bazaAdmin().collection('asystentRozmowy')
}

/** Notatki asystenta - tylko serwer; reguła końcowa zamyka je przed przeglądarką. */
export function notatkiRef() {
  return bazaAdmin().collection('asystentNotatki')
}

/**
 * Lista stron panelu Strony. Celowo poza `ustawienia/` - tamtą kolekcję reguła
 * daje do odczytu zarządowi, a strony są tylko dla właściciela. Kolekcja
 * `strony` nie ma reguły klienta, więc zamyka ją reguła końcowa.
 */
export function stronyRef() {
  return bazaAdmin().collection('strony').doc('lista')
}
