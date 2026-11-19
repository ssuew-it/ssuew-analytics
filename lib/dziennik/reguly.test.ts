import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Dziennik czyta tylko serwer (Admin SDK). Przeglądarka nie może go czytać - nawet właściciel. */
describe('firestore.rules a Dziennik', () => {
  const reguly = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8')

  it('nie otwiera kolekcji Dziennika dla klienta', () => {
    expect(reguly).not.toMatch(/dziennik/i)
  })

  it('kończy się regułą zamykającą wszystko inne', () => {
    expect(reguly).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/)
  })
})
