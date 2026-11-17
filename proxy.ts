import { NextResponse, type NextRequest } from 'next/server'

const PUBLICZNE = ['/login']

/**
 * Wyłącznie wygoda: nie pokazuj pustych ekranów bez sesji.
 * Bezpieczeństwo siedzi w trasach /api/*, które weryfikują podpis tokenu
 * (lib/auth/guard.ts). Weryfikacja podpisu przy każdym żądaniu o obrazek
 * byłaby kosztem bez pożytku.
 */
export function proxy(req: NextRequest) {
  const sciezka = req.nextUrl.pathname
  if (PUBLICZNE.includes(sciezka) || sciezka.startsWith('/api')) return NextResponse.next()

  // Dwie drogi wejścia: konto z hasłem albo kod. Wystarczy jedna.
  const maSesje = req.cookies.get('deck_session') || req.cookies.get('deck_kod')
  if (!maSesje) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
