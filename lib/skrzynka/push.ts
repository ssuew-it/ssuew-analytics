import { createRemoteJWKSet, jwtVerify } from 'jose'

const CERTYFIKATY = 'https://www.googleapis.com/oauth2/v3/certs'
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

/**
 * Pub/Sub podpisuje każde powiadomienie tokenem OIDC Google. Sprawdzamy
 * podpis, wystawcę, odbiorcę (adres naszej trasy) i konto subskrypcji -
 * bez tego każdy mógłby wywoływać synchronizację.
 */
export async function zweryfikujPush(naglowek: string | null): Promise<boolean> {
  const konto = process.env.SKRZYNKA_PUSH_KONTO
  const adres = process.env.SKRZYNKA_ADRES
  const token = naglowek?.startsWith('Bearer ') ? naglowek.slice('Bearer '.length) : ''
  if (!konto || !adres || !token) return false
  jwks ??= createRemoteJWKSet(new URL(CERTYFIKATY))
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: `${adres.replace(/\/+$/, '')}/api/skrzynka/push`,
    })
    return payload.email === konto && payload.email_verified === true
  } catch {
    return false
  }
}
