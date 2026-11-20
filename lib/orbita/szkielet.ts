import type { Etap, RodzajEtapu } from './typy'

function etap(nazwa: string, rodzaj: RodzajEtapu, dni: number, cel: string, zacznijOd: string, gotoweGdy: string, czekaNa: string[] = []): Etap {
  return { id: crypto.randomUUID(), nazwa, rodzaj, cel, zacznijOd, materialy: '', gotoweGdy, dni, czekaNa, czekamDo: null, zamkniety: null, wynik: '' }
}

/** Szkielet zadania „Dokument normatywny” (zarządzenie, standard, uchwała) - spec sekcja 4. */
export function szkieletDokumentu(): Etap[] {
  return [
    etap('Koncepcja', 'praca', 3, 'Podstawa wprowadzenia, tryb i charakter dokumentu', 'Rozmowa z Claude, jak to może wyglądać', 'Koncepcja ustalona'),
    etap('Projekt', 'praca', 7, 'Pełny tekst projektu', 'Rozmowa z Claude na podstawie ustaleń koncepcji', 'Projekt skompletowany i sprawdzony przez Claude'),
    etap('Konsultacje', 'czekanie', 14, 'Uwagi RUSS i KR', 'Wysłanie projektu do RUSS i KR', 'Uwagi otrzymane albo minął termin', ['RUSS', 'KR']),
    etap('Poprawki', 'praca', 3, 'Uwagi z konsultacji wprowadzone', 'Rozmowa z Claude z uwagami', 'Wersja ostateczna gotowa'),
    etap('Przyjęcie', 'praca', 7, 'Podpis albo głosowanie i publikacja', 'Przekazanie do podpisu lub na posiedzenie', 'Dokument przyjęty i opublikowany'),
  ]
}

/** Pierwszy etap zadania z „Własnymi etapami”. */
export function etapPusty(): Etap {
  return etap('', 'praca', 3, '', '', '')
}
