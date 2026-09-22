'use client'
import React from 'react'
import type { RubroDisplayInfo, RubroSlotEmptyReason } from '@/lib/homeDecisionContract'
import { emptySlotText } from '@/lib/homeCopy'

type Props = {
  rubro: RubroDisplayInfo
  reason: RubroSlotEmptyReason
}

// Estado vacío explícito por rubro (CPO Direction 12/8/2026, punto "estado
// vacío explícito cuando corresponda") — el rubro sigue ocupando su lugar en
// la Home, nunca desaparece silenciosamente.
export default function RubroEmptySlot({ rubro, reason }: Props) {
  return (
    <div className="w-full">
      <div className="text-[11px] font-bold text-[#1D3D6E] dark:text-[#8AADD4] uppercase tracking-wide mb-2 flex items-center gap-1.5 px-4 md:px-0">
        {rubro.icon && <span aria-hidden="true">{rubro.icon}</span>}
        {rubro.label}
      </div>
      <div className="mx-4 md:mx-0 rounded-2xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-[#E4E8EF] dark:border-slate-700 px-4 py-4">
        <p className="text-[12px] text-[#8B96A5] dark:text-slate-400">{emptySlotText(reason)}</p>
      </div>
    </div>
  )
}
