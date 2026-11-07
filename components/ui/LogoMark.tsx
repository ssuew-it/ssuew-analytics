import Image from 'next/image'

export function LogoMark() {
  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 place-items-center rounded-lg border border-deck-accent/40 bg-deck-accent/12 p-1.5 shadow-[0_0_28px_rgba(46,230,166,0.22)]"
    >
      <Image src="/logo-mark.png" alt="" width={512} height={512} className="h-full w-full" priority />
    </span>
  )
}
