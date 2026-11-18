'use client'
import { useEffect, useRef } from 'react'
import type { Scena } from '@/lib/deck/ekranLogowania'

/**
 * Tło ekranu logowania - jedna z trzech scen na jednym płótnie. Każda scena to
 * fabryka: dostaje wymiary, zwraca funkcję rysującą jedną klatkę. `tempo` to
 * mnożnik prędkości: 1 normalnie, do 4 w trakcie przejścia do kokpitu.
 */
type Rysuj = (ctx: CanvasRenderingContext2D, tempo: number) => void
type Fabryka = (szer: number, wys: number, moc: number) => Rysuj

const ZIELEN = '46, 230, 166'
const LOD = '190, 255, 230'
const BURSZTYN = '217, 176, 106'

const ZNAKI = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ｦｧｨｩｪｫ<>[]{}/\\=+*'
const ROZMIAR = 15

const deszcz: Fabryka = (szer, wys, moc) => {
  // Każda kolumna startuje z innej wysokości, żeby deszcz nie ruszał równo.
  const kolumny = Array.from({ length: Math.ceil(szer / ROZMIAR) }, () => Math.random() * -wys)
  const znak = () => ZNAKI[Math.floor(Math.random() * ZNAKI.length)]
  return (ctx, tempo) => {
    // Półprzezroczyste przykrycie zamiast czyszczenia: to ono robi smugę.
    ctx.fillStyle = 'rgba(7, 9, 13, 0.09)'
    ctx.fillRect(0, 0, szer, wys)
    ctx.font = `${ROZMIAR}px ui-monospace, monospace`
    for (let i = 0; i < kolumny.length; i++) {
      const x = i * ROZMIAR
      const y = kolumny[i]
      ctx.fillStyle = `rgba(${LOD}, ${moc})`
      ctx.fillText(znak(), x, y)
      ctx.fillStyle = `rgba(${ZIELEN}, ${moc * 0.55})`
      ctx.fillText(znak(), x, y - ROZMIAR)
      kolumny[i] = y > wys + Math.random() * 400 ? 0 : y + ROZMIAR * tempo
    }
  }
}

const radar: Fabryka = (szer, wys, moc) => {
  const k = moc / 0.3
  // Na szerokim ekranie środek pod tekstem, z dala od formularza po prawej.
  const cx = szer >= 1024 ? szer * 0.3 : szer * 0.5
  const cy = wys * 0.55
  const R = Math.hypot(szer, wys) * 0.42
  const SZEROKOSC_WIAZKI = 0.9
  let kat = Math.random() * Math.PI * 2
  const nowyCel = () => ({ a: Math.random() * Math.PI * 2, r: R * (0.15 + Math.random() * 0.8) })
  const cele = Array.from({ length: 16 }, nowyCel)

  return (ctx, tempo) => {
    ctx.clearRect(0, 0, szer, wys)
    ctx.lineWidth = 1
    ctx.strokeStyle = `rgba(${ZIELEN}, ${0.11 * k})`
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath()
      ctx.arc(cx, cy, (R * i) / 5, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(cx - R, cy)
    ctx.lineTo(cx + R, cy)
    ctx.moveTo(cx, cy - R)
    ctx.lineTo(cx, cy + R)
    ctx.stroke()

    // Wiązka: klin, który za krawędzią gaśnie. Gradient stożkowy rysuje to
    // jednym wypełnieniem; starsza przeglądarka dostaje płaski klin.
    const od = kat - SZEROKOSC_WIAZKI
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, R, od, kat)
    ctx.closePath()
    if (typeof ctx.createConicGradient === 'function') {
      const g = ctx.createConicGradient(od, cx, cy)
      const koniec = SZEROKOSC_WIAZKI / (Math.PI * 2)
      g.addColorStop(0, `rgba(${ZIELEN}, 0)`)
      g.addColorStop(koniec, `rgba(${ZIELEN}, ${0.2 * k})`)
      g.addColorStop(Math.min(1, koniec + 0.001), `rgba(${ZIELEN}, 0)`)
      ctx.fillStyle = g
    } else {
      ctx.fillStyle = `rgba(${ZIELEN}, ${0.06 * k})`
    }
    ctx.fill()
    ctx.strokeStyle = `rgba(${LOD}, ${0.35 * k})`
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(kat) * R, cy + Math.sin(kat) * R)
    ctx.stroke()

    // Cel świeci, gdy wiązka go minęła, i gaśnie aż do następnego obrotu.
    for (let i = 0; i < cele.length; i++) {
      const c = cele[i]
      const za = (((kat - c.a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      if (za > Math.PI * 1.9 && Math.random() < 0.02) cele[i] = nowyCel()
      const jasnosc = Math.exp(-za / 2.4)
      if (jasnosc < 0.02) continue
      const x = cx + Math.cos(c.a) * c.r
      const y = cy + Math.sin(c.a) * c.r
      ctx.fillStyle = `rgba(${i % 5 === 0 ? BURSZTYN : LOD}, ${jasnosc * 0.9 * k})`
      ctx.beginPath()
      ctx.arc(x, y, 2.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgba(${ZIELEN}, ${jasnosc * 0.5 * k})`
      ctx.beginPath()
      ctx.arc(x, y, 2.2 + (1 - jasnosc) * 10, 0, Math.PI * 2)
      ctx.stroke()
    }
    kat += 0.035 * tempo
  }
}

const siec: Fabryka = (szer, wys, moc) => {
  const k = moc / 0.3
  const ZASIEG = 150
  const ile = Math.max(30, Math.min(90, Math.round((szer * wys) / 16000)))
  const wezly = Array.from({ length: ile }, () => ({
    x: Math.random() * szer,
    y: Math.random() * wys,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
  }))
  // Pakiety: jasny punkt biegnie wzdłuż krawędzi do najbliższego sąsiada.
  let pakiety: { a: number; b: number; t: number }[] = []
  let licznik = 0

  return (ctx, tempo) => {
    ctx.clearRect(0, 0, szer, wys)
    for (const w of wezly) {
      w.x += w.vx * tempo
      w.y += w.vy * tempo
      if (w.x < 0 || w.x > szer) w.vx *= -1
      if (w.y < 0 || w.y > wys) w.vy *= -1
    }

    ctx.lineWidth = 1
    for (let i = 0; i < wezly.length; i++) {
      for (let j = i + 1; j < wezly.length; j++) {
        const d = Math.hypot(wezly[i].x - wezly[j].x, wezly[i].y - wezly[j].y)
        if (d >= ZASIEG) continue
        ctx.strokeStyle = `rgba(${ZIELEN}, ${(1 - d / ZASIEG) * 0.4 * k})`
        ctx.beginPath()
        ctx.moveTo(wezly[i].x, wezly[i].y)
        ctx.lineTo(wezly[j].x, wezly[j].y)
        ctx.stroke()
      }
    }
    ctx.fillStyle = `rgba(${LOD}, ${0.55 * k})`
    for (const w of wezly) {
      ctx.beginPath()
      ctx.arc(w.x, w.y, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }

    if (licznik++ % Math.max(4, Math.round(16 / tempo)) === 0) {
      const a = Math.floor(Math.random() * wezly.length)
      let b = -1
      let najblizej = ZASIEG
      wezly.forEach((w, i) => {
        const d = Math.hypot(w.x - wezly[a].x, w.y - wezly[a].y)
        if (i !== a && d < najblizej) {
          najblizej = d
          b = i
        }
      })
      if (b >= 0) pakiety.push({ a, b, t: 0 })
    }
    pakiety = pakiety.filter((p) => p.t <= 1)
    for (const p of pakiety) {
      const A = wezly[p.a]
      const B = wezly[p.b]
      ctx.fillStyle = `rgba(${BURSZTYN}, ${0.9 * k})`
      ctx.beginPath()
      ctx.arc(A.x + (B.x - A.x) * p.t, A.y + (B.y - A.y) * p.t, 2, 0, Math.PI * 2)
      ctx.fill()
      p.t += 0.04 * tempo
    }
  }
}

const SCENY_RYSOWANIA: Record<Scena, Fabryka> = { deszcz, radar, siec }

type Props = {
  scena: Scena
  /** 0-1. Wyżej niż 0.35 i tekst nad spodem przestaje być czytelny. */
  moc?: number
  /** Przejście do kokpitu: scena rozpędza się do czterech razy szybciej. */
  przyspiesz?: boolean
}

export function TloLogowania({ scena, moc = 0.3, przyspiesz = false }: Props) {
  const plotno = useRef<HTMLCanvasElement>(null)
  const cel = useRef(1)

  useEffect(() => {
    cel.current = przyspiesz ? 4 : 1
  }, [przyspiesz])

  useEffect(() => {
    const c = plotno.current
    if (!c) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = c.getContext('2d', { alpha: true })
    if (!ctx) return

    let rysuj: Rysuj = () => {}
    let szer = 0
    let wys = 0
    function wymiaruj() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      szer = window.innerWidth
      wys = window.innerHeight
      c!.width = szer * dpr
      c!.height = wys * dpr
      c!.style.width = `${szer}px`
      c!.style.height = `${wys}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      rysuj = SCENY_RYSOWANIA[scena](szer, wys, moc)
    }

    let tempo = 1
    let klatka = 0
    let uchwyt = 0
    let dziala = true
    function petla() {
      if (!dziala) return
      // Co druga klatka: 30 fps wystarczy tłu, a oszczędza baterię.
      if (klatka++ % 2 === 0) {
        tempo += (cel.current - tempo) * 0.15
        rysuj(ctx!, tempo)
      }
      uchwyt = requestAnimationFrame(petla)
    }
    function widocznosc() {
      // Karta w tle nie ma po co liczyć klatek.
      if (document.hidden) {
        dziala = false
        cancelAnimationFrame(uchwyt)
      } else if (!dziala) {
        dziala = true
        petla()
      }
    }

    wymiaruj()
    petla()
    window.addEventListener('resize', wymiaruj)
    document.addEventListener('visibilitychange', widocznosc)
    return () => {
      dziala = false
      cancelAnimationFrame(uchwyt)
      window.removeEventListener('resize', wymiaruj)
      document.removeEventListener('visibilitychange', widocznosc)
    }
  }, [scena, moc])

  return <canvas ref={plotno} className="deck-rain" data-scena={scena} aria-hidden="true" />
}
