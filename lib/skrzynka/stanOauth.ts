import { SignJWT, jwtVerify } from 'jose'

const CEL = 'skrzynka-oauth'

/** Po co była zgoda - oba cele wracają tym samym adresem `/api/skrzynka/oauth`. */
export type CelOauth = 'skrzynka' | 'kalendarz' | 'dysk'

function sekret(): Uint8Array {
  const s = process.env.DECK_SESSION_SECRET ?? ''
  if (s.length < 32) throw new Error('DECK_SESSION_SECRET musi mieć co najmniej 32 znaki')
  return new TextEncoder().encode(s)
}

/** `state` zgody Google: podpisany, krótko ważny i związany z kontem, które zaczęło łączenie - chroni przed podrzuceniem cudzego kodu. */
export async function podpiszStan(uid: string, cel: CelOauth = 'skrzynka'): Promise<string> {
  return new SignJWT({ uid, cel }).setProtectedHeader({ alg: 'HS256' }).setAudience(CEL).setIssuedAt().setExpirationTime('10m').sign(sekret())
}

/** Cel ważnego `state` tego konta; `null` - state zły, przeterminowany albo cudzy. Stary state bez celu = skrzynka. */
export async function celStanu(stan: string, uid: string): Promise<CelOauth | null> {
  try {
    const { payload } = await jwtVerify(stan, sekret(), { audience: CEL })
    if (payload.uid !== uid) return null
    return payload.cel === 'kalendarz' || payload.cel === 'dysk' ? payload.cel : 'skrzynka'
  } catch {
    return null
  }
}

export async function sprawdzStan(stan: string, uid: string): Promise<boolean> {
  return (await celStanu(stan, uid)) !== null
}
