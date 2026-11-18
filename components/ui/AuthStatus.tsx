'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { KeyRound, LogIn, LogOut, UserCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth/useAuth'

export function AuthStatus() {
  const router = useRouter()
  const { kto, rola, sposob, wyloguj } = useAuth()

  if (!rola) {
    return (
      <Link
        href="/login"
        className="deck-chip flex h-9 items-center gap-2 rounded-lg px-3 text-[11px] text-deck-muted transition hover:text-deck-text"
      >
        <LogIn size={14} />
        Zaloguj
      </Link>
    )
  }

  async function wyjdz() {
    await wyloguj()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="deck-chip flex h-9 items-center gap-2 rounded-lg px-2">
      {sposob === 'kod' ? (
        <KeyRound size={15} className="text-deck-accent" />
      ) : (
        <UserCircle size={15} className="text-deck-accent" />
      )}
      <span className="max-w-[110px] truncate text-[10px] text-deck-muted sm:max-w-[150px]">{kto}</span>
      <span className="rounded border border-deck-accent/30 bg-deck-accent/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-deck-accent">
        {rola}
      </span>
      <button
        type="button"
        onClick={wyjdz}
        className="grid h-6 w-6 place-items-center rounded-md text-deck-muted transition hover:bg-white/8 hover:text-deck-text"
        title="Wyloguj"
      >
        <LogOut size={13} />
      </button>
    </div>
  )
}
