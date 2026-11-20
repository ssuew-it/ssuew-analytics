'use client'
import { useState } from 'react'
import type { Zadanie } from '@/lib/orbita/typy'
import { biezacy, planDnia, zapas } from '@/lib/orbita/zapas'
import type { Data } from '@/lib/planer/trwanie'
import { KartaEtapu } from './KartaEtapu'
import { Lista } from './Lista'
import { Radar } from './Radar'

/** Radar z kartą wybranego zadania; poniżej 640 px radar nie ma miejsca - jest lista. */
export function WidokRadaru({ zadania, dzis, odswiez }: { zadania: Zadanie[]; dzis: Data; odswiez: () => void }) {
  const [wybrane, setWybrane] = useState<string | null>(null)
  const z = zadania.find((x) => x.id === wybrane && x.zamkniete === null)
  const k = z ? biezacy(z) : null

  return (
    <>
      <div className="hidden space-y-4 sm:block">
        <Radar plan={planDnia(zadania, dzis)} dzis={dzis} onWybierz={setWybrane} />
        {z && k !== null && (
          <KartaEtapu key={`${z.id}-${z.etapy[k].id}`} pozycja={{ zadanie: z, etap: k, zapas: zapas(z, dzis), poCzekaniu: false }} odswiez={odswiez} />
        )}
      </div>
      <div className="sm:hidden">
        <Lista zadania={zadania} dzis={dzis} odswiez={odswiez} />
      </div>
    </>
  )
}
