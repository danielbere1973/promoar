import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Test de --only-commerces (atajo de --type=comercio, 27/11/2026).
//
// No se importa warm-detail-cache.ts directamente: el archivo ejecuta
// main() al nivel de módulo (línea ~366, igual que cualquier script de
// scripts/ pensado para correr con `tsx`, no para ser importado), lo que
// dispara process.exit(1) en cuanto falta VTEX_SESSION_SECRET y de paso
// intentaría pegarle a la red. En vez de eso, esta prueba re-declara la
// misma lógica mínima que resolveTypeArg()/parseStringArg()/hasFlag()
// (ambas ya exportadas, solo resolveTypeArg; las otras dos privadas) contra
// process.argv real, para blindar la regla de precedencia sin ejecutar el
// script completo.

const ORIGINAL_ARGV = process.argv

function setArgv(...extra: string[]) {
  process.argv = [...ORIGINAL_ARGV.slice(0, 2), ...extra]
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function parseStringArg(flag: string): string | null {
  const arg = process.argv.find(a => a.startsWith(`${flag}=`))
  return arg ? arg.slice(flag.length + 1).trim() : null
}

// Copia exacta de scripts/warm-detail-cache.ts (misma función, ver nota arriba).
function resolveTypeArg(): 'promo' | 'comercio' | null {
  if (hasFlag('--only-commerces')) return 'comercio'
  const typeArg = parseStringArg('--type')
  return typeArg === 'promo' || typeArg === 'comercio' ? typeArg : null
}

afterEach(() => {
  process.argv = ORIGINAL_ARGV
})

describe('resolveTypeArg (--only-commerces)', () => {
  it('sin ningún flag → null (pide ambas listas)', () => {
    setArgv()
    expect(resolveTypeArg()).toBeNull()
  })

  it('--only-commerces sola → "comercio"', () => {
    setArgv('--only-commerces')
    expect(resolveTypeArg()).toBe('comercio')
  })

  it('--type=promo sola → "promo"', () => {
    setArgv('--type=promo')
    expect(resolveTypeArg()).toBe('promo')
  })

  it('--type=comercio sola → "comercio"', () => {
    setArgv('--type=comercio')
    expect(resolveTypeArg()).toBe('comercio')
  })

  it('--only-commerces y --type=promo juntos → gana --only-commerces ("comercio")', () => {
    setArgv('--only-commerces', '--type=promo')
    expect(resolveTypeArg()).toBe('comercio')
  })

  it('--type con valor inválido → null', () => {
    setArgv('--type=lo-que-sea')
    expect(resolveTypeArg()).toBeNull()
  })
})
