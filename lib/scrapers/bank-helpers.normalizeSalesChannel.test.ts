import { describe, it, expect, vi } from 'vitest'
import { normalizeSalesChannel } from './bank-helpers'

describe('normalizeSalesChannel', () => {
  it('ONLINE se mantiene igual', () => {
    expect(normalizeSalesChannel('ONLINE')).toBe('ONLINE')
  })

  it('BOTH se mantiene igual', () => {
    expect(normalizeSalesChannel('BOTH')).toBe('BOTH')
  })

  it('el legacy "FISICA" se normaliza a PHYSICAL', () => {
    expect(normalizeSalesChannel('FISICA')).toBe('PHYSICAL')
  })

  it('"PHYSICAL" ya normalizado se mantiene igual', () => {
    expect(normalizeSalesChannel('PHYSICAL')).toBe('PHYSICAL')
  })

  it('null y undefined caen a UNKNOWN sin warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(normalizeSalesChannel(null)).toBe('UNKNOWN')
    expect(normalizeSalesChannel(undefined)).toBe('UNKNOWN')
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('un valor desconocido cae a UNKNOWN y loggea un warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(normalizeSalesChannel('CUALQUIER_COSA')).toBe('UNKNOWN')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain('CUALQUIER_COSA')
    warnSpy.mockRestore()
  })
})
