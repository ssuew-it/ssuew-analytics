'use client'
import { useState } from 'react'
import { Download, FileText, ImageDown } from 'lucide-react'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

async function captureRoot(): Promise<string | null> {
  const node = document.getElementById('export-root')
  if (!node) return null
  return toPng(node, { backgroundColor: '#07090D', pixelRatio: 2, cacheBust: true })
}

export function ExportButton() {
  const [busy, setBusy] = useState<null | 'png' | 'pdf'>(null)

  async function exportPng() {
    setBusy('png')
    try {
      const url = await captureRoot()
      if (!url) return
      const a = document.createElement('a')
      a.href = url
      a.download = `ssuew-${today()}.png`
      a.click()
    } finally {
      setBusy(null)
    }
  }

  async function exportPdf() {
    setBusy('pdf')
    try {
      const url = await captureRoot()
      if (!url) return
      const img = new Image()
      img.src = url
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
      })
      const pdf = new jsPDF({
        orientation: img.width >= img.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [img.width, img.height],
      })
      pdf.addImage(url, 'PNG', 0, 0, img.width, img.height)
      pdf.save(`ssuew-${today()}.pdf`)
    } finally {
      setBusy(null)
    }
  }

  const przycisk =
    'flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-deck-muted transition hover:bg-white/8 hover:text-deck-text disabled:opacity-40'

  // Podpisy zamiast samych ikon - bez najechania nie było wiadomo, co robią.
  return (
    <div className="deck-chip flex items-center gap-1 rounded-lg p-1" role="group" aria-label="Pobierz widok">
      <span className="flex items-center gap-1 pl-1.5 pr-0.5 text-[11px] text-deck-muted">
        <Download size={13} className="text-deck-accent" aria-hidden="true" />
        Pobierz
      </span>
      <button type="button" onClick={exportPng} disabled={!!busy} className={przycisk} title="Zapisz widok jako obraz PNG">
        <ImageDown size={13} aria-hidden="true" />
        {busy === 'png' ? '...' : 'PNG'}
      </button>
      <button type="button" onClick={exportPdf} disabled={!!busy} className={przycisk} title="Zapisz widok jako PDF">
        <FileText size={13} aria-hidden="true" />
        {busy === 'pdf' ? '...' : 'PDF'}
      </button>
    </div>
  )
}
