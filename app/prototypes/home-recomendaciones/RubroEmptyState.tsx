'use client'

import { RUBRO_EMPTY_COPY, type RubroEmptyReason } from './data'

// Estado vacío explícito por rubro — nunca se omite el rubro (RFC-008 §2.2 / definicion-producto-home.md §2.3).
export default function RubroEmptyState({ reason, wide }: { reason: RubroEmptyReason; wide?: boolean }) {
  return (
    <div
      style={{
        border: '1px dashed var(--border)',
        borderRadius: wide ? 16 : 18,
        padding: wide ? '22px 18px' : '28px 16px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}
    >
      {RUBRO_EMPTY_COPY[reason]}
    </div>
  )
}
