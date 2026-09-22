import { describe, it, expect } from 'vitest'
import { resolveCoverageBadge } from './coverageBadge'

describe('resolveCoverageBadge', () => {
  it('UNKNOWN devuelve null — sin badge, sin ícono, sin color', () => {
    expect(resolveCoverageBadge('UNKNOWN')).toBeNull()
    expect(resolveCoverageBadge(null)).toBeNull()
    expect(resolveCoverageBadge(undefined)).toBeNull()
  })

  it('NEARBY devuelve el badge "Cerca tuyo" con ícono de pin', () => {
    const badge = resolveCoverageBadge('NEARBY')
    expect(badge).not.toBeNull()
    expect(badge?.icon).toBe('📍')
    expect(badge?.label).toBe('Cerca tuyo')
    expect(badge?.labelMobile).toBe('Cerca')
    expect(badge?.ariaLabel).toMatch(/cerca/i)
  })

  it('ONLINE devuelve el badge "Online" con ícono de globo', () => {
    const badge = resolveCoverageBadge('ONLINE')
    expect(badge).not.toBeNull()
    expect(badge?.icon).toBe('🌐')
    expect(badge?.label).toBe('Online')
    expect(badge?.labelMobile).toBe('Online')
    expect(badge?.ariaLabel).toMatch(/online/i)
  })

  it('TERRITORIAL usa el alcance real (coverageLabel) en el texto, no un "nacional" genérico', () => {
    const badge = resolveCoverageBadge('TERRITORIAL', 'Buenos Aires')
    expect(badge).not.toBeNull()
    expect(badge?.icon).toBe('🗺️')
    expect(badge?.label).toBe('Cobertura en Buenos Aires')
    expect(badge?.labelMobile).toBe('Buenos Aires')
    expect(badge?.ariaLabel).toContain('Buenos Aires')
  })

  it('TERRITORIAL con múltiples provincias refleja la lista completa', () => {
    const badge = resolveCoverageBadge('TERRITORIAL', 'CABA, Santa Fe')
    expect(badge?.label).toBe('Cobertura en CABA, Santa Fe')
    expect(badge?.labelMobile).toBe('CABA, Santa Fe')
  })

  it('TERRITORIAL con alcance nacional real usa "Todo el país", no un default fijo', () => {
    const badge = resolveCoverageBadge('TERRITORIAL', 'Todo el país')
    expect(badge?.label).toBe('Cobertura en Todo el país')
    expect(badge?.labelMobile).toBe('Todo el país')
  })

  it('TERRITORIAL sin coverageLabel cae a un texto genérico como último recurso', () => {
    const badge = resolveCoverageBadge('TERRITORIAL')
    expect(badge?.label).toBe('Cobertura en Cobertura territorial')
    expect(badge?.labelMobile).toBe('Cobertura territorial')
  })

  it('el significado no depende solo del color/emoji: cada estado expone label y ariaLabel de texto', () => {
    for (const status of ['NEARBY', 'TERRITORIAL', 'ONLINE'] as const) {
      const badge = resolveCoverageBadge(status, 'Córdoba')
      expect(badge?.label.length).toBeGreaterThan(0)
      expect(badge?.ariaLabel.length).toBeGreaterThan(0)
      expect(badge?.colorClass.length).toBeGreaterThan(0)
    }
  })
})
