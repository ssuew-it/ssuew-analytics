/** Jednorazowa konfiguracja Search Console - ta sama w pustym panelu i przy dodawaniu. */
export function InstrukcjaDostepu({ email }: { email: string | null }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-[12px] leading-relaxed text-deck-muted">
      <li>W Google Cloud, w projekcie Firebase, włącz „Google Search Console API”.</li>
      <li>
        W Search Console strony: Ustawienia → Użytkownicy i uprawnienia → Dodaj użytkownika:{' '}
        <code className="break-all text-deck-text">{email ?? 'adres konta serwisowego (client_email)'}</code>, uprawnienie
        „Ograniczone”.
      </li>
      <li>Stronę, której nie ma w Search Console, najpierw tam dodaj i zweryfikuj.</li>
    </ol>
  )
}
