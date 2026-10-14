import { SignJWT, jwtVerify } from 'jose'

const CEL = 'skrzynka-oauth'

function sekret(): Uint8Array {
  const s = process.env.DECK_SESSION_SECRET ?? ''
  if (s.length < 32) throw new Error('DECK_SESSION_SECRET musi mieć co najmniej 32 znaki')
  return new TextEncoder().encode(s)
}

/** `state` zgody Google: podpisany, krótko ważny i związany z kontem, które zaczęło łączenie - chroni przed podrzuceniem cudzego kodu. */
export async function podpiszStan(uid: string): Promise<string> {
  return new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setAudience(CEL).setIssuedAt().setExpirationTime('10m').sign(sekret())
}

export async function sprawdzStan(stan: string, uid: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(stan, sekret(), { audience: CEL })
    return payload.uid === uid
  } catch {
    return false
  }
}
