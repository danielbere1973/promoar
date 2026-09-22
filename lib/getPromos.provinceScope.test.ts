import { describe, it, expect, vi } from 'vitest'

// getPromos.ts instancia PrismaClient a nivel de módulo — se mockea para poder
// importar solo las funciones puras de texto (describeProvinceScope/displayProvinceName)
// sin necesitar una conexión real a la base.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: any) => fn }))

const { describeProvinceScope, displayProvinceName } = await import('./getPromos')

describe('displayProvinceName', () => {
  it('presenta CABA y provincias con tilde en el caso común', () => {
    expect(displayProvinceName('caba')).toBe('CABA')
    expect(displayProvinceName('cordoba')).toBe('Córdoba')
    expect(displayProvinceName('buenos aires')).toBe('Buenos Aires')
    expect(displayProvinceName('rio negro')).toBe('Río Negro')
  })

  it('cae a Title Case genérico para provincias sin caso especial', () => {
    expect(displayProvinceName('chubut')).toBe('Chubut')
  })
})

describe('describeProvinceScope — TERRITORIAL nunca asume "nacional" por defecto', () => {
  it('una sola provincia devuelve el nombre puntual', () => {
    expect(describeProvinceScope(['Buenos Aires'])).toBe('Buenos Aires')
  })

  it('2-3 provincias devuelven un listado corto, no "todo el país"', () => {
    expect(describeProvinceScope(['CABA', 'Santa Fe'])).toBe('CABA, Santa Fe')
  })

  it('4 o más provincias se resumen como cobertura nacional', () => {
    expect(describeProvinceScope(['Buenos Aires', 'Córdoba', 'Santa Fe', 'Mendoza'])).toBe('Todo el país')
  })

  it('provincias duplicadas (mismo valor normalizado) no inflan el conteo hacia "nacional"', () => {
    expect(describeProvinceScope(['Buenos Aires', 'Bs As', 'Provincia de Buenos Aires'])).toBe('Buenos Aires')
  })

  it('el valor explícito "todas" siempre es nacional sin importar el conteo', () => {
    expect(describeProvinceScope(['todas'])).toBe('Todo el país')
  })
})
