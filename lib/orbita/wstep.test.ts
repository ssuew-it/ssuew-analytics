import { describe, it, expect } from 'vitest'
import { wstepDoClaude } from '@/lib/orbita/wstep'
import { szkieletDokumentu } from '@/lib/orbita/szkielet'
import type { Etap, Zadanie } from '@/lib/orbita/typy'

const zadanie = (etapy: Etap[], zmiany: Partial<Zadanie> = {}): Zadanie => ({
  id: 'z', tytul: 'Zarządzenie ws. uchwał strategicznych', kontekst: 'Standaryzacja trybu', termin: '2026-12-20',
  zrodlo: null, etapy, utworzono: 0, zmieniono: 0, zamkniete: null, ...zmiany,
})

describe('wstepDoClaude', () => {
  it('pełny wstęp dla drugiego etapu z ustaleniami koncepcji', () => {
    const [k, ...reszta] = szkieletDokumentu()
    const z = zadanie([{ ...k, zamkniety: 1, wynik: 'Tryb: zarządzenie\nhttps://docs.google.com/x' }, ...reszta])
    expect(wstepDoClaude(z)).toBe(
      [
        'Pracuję nad: Zarządzenie ws. uchwał strategicznych',
        'Termin: 20.12.2026',
        'Kontekst: Standaryzacja trybu',
        '',
        'Teraz etap 2 z 5: Projekt',
        'Cel etapu: Pełny tekst projektu',
        'Zacznij od: Rozmowa z Claude na podstawie ustaleń koncepcji',
        'Gotowe, gdy: Projekt skompletowany i sprawdzony przez Claude',
        'Materiały: brak',
        '',
        'Ustalenia z poprzednich etapów:',
        '- Koncepcja: Tryb: zarządzenie',
        '  https://docs.google.com/x',
        '',
        'Pozostałe etapy: Konsultacje, Poprawki, Przyjęcie',
        '',
        'Pomóż mi przejść ten etap. Zacznij od pytań, jeśli czegoś brakuje.',
      ].join('\n'),
    )
  })

  it('bez terminu, bez zamkniętych etapów, ostatni etap', () => {
    const e: Etap = { ...szkieletDokumentu()[0], materialy: 'Statut https://a.pl' }
    const w = wstepDoClaude(zadanie([e], { termin: null, kontekst: '' }))
    expect(w).toContain('Termin: bez terminu')
    expect(w).toContain('Kontekst: brak')
    expect(w).toContain('Materiały: Statut https://a.pl')
    expect(w).toContain('Ustalenia z poprzednich etapów:\nbrak')
    expect(w).toContain('Pozostałe etapy: brak')
    expect(w.endsWith('Pomóż mi przejść ten etap. Zacznij od pytań, jeśli czegoś brakuje.')).toBe(true)
  })

  it('zamknięty wynik pusty nie trafia do ustaleń', () => {
    const [k, p] = szkieletDokumentu()
    expect(wstepDoClaude(zadanie([{ ...k, zamkniety: 1 }, p]))).toContain('Ustalenia z poprzednich etapów:\nbrak')
  })

  it('zamknięte zadanie - wstęp dla ostatniego etapu', () => {
    const s = szkieletDokumentu().map((e) => ({ ...e, zamkniety: 1 }))
    expect(wstepDoClaude(zadanie(s, { zamkniete: 1 }))).toContain('Teraz etap 5 z 5: Przyjęcie')
  })

  it('bez długich myślników', () => {
    expect(wstepDoClaude(zadanie(szkieletDokumentu()))).not.toMatch(/[—–]/)
  })
})
