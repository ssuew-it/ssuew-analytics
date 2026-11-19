import { Fragment } from 'react'

const ADRES = /(https?:\/\/[^\s<>"]+)/g

/** Akapity z pustych linii, adresy jako linki. Tekst idzie przez React - nic z treści nie staje się kodem. */
export function TekstZLinkami({ tekst }: { tekst: string }) {
  const akapity = tekst.split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean)
  return (
    <>
      {akapity.map((a, i) => (
        <p key={i} className="whitespace-pre-line break-words">
          {a.split(ADRES).map((kawalek, j) =>
            j % 2 === 1 ? (
              <a key={j} href={kawalek} target="_blank" rel="noopener noreferrer" className="text-deck-accent underline-offset-2 hover:underline">
                {kawalek}
              </a>
            ) : (
              <Fragment key={j}>{kawalek}</Fragment>
            ),
          )}
        </p>
      ))}
    </>
  )
}
