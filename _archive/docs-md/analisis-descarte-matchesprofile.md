# Análisis de descarte de `matchesProfile()`

Responde a "CPO Decision — Análisis de descarte de `matchesProfile()`". Pregunta única:
**¿qué porcentaje del descarte total produce cada regla de `matchesProfile()`?** Documento
de medición, no de propuesta — la recomendación sobre la Alternativa B queda para el final,
como último paso, no como punto de partida.

## Metodología

- Instrumentación **temporal**, en un script aparte (`scratch_discard_analysis.ts`). No se
  modificó `lib/getPromos.ts` ni `matchesProfile()` real — se reimplementó la misma lógica
  (copiada línea por línea de `lib/getPromos.ts:843-941`) agregando contadores. No queda
  instrumentación permanente en el código de producción.
- **40 casos**: 5 usuarios reales con perfil financiero cargado (`admin@promoar.com.ar`,
  `litadescuentos@gmail.com`, `danielbere@gmail.com`, `bubah22@gmail.com`,
  `niksicvuja.ar@gmail.com`) × 4 provincias (Buenos Aires, CABA, Córdoba, Santa Fe) × 2
  vistas (`week`, `today`).
- Para cada caso se reprodujo el mismo camino que usa el oráculo: `getCandidatePromosForProfile()`
  (la query SQL permisiva ya existente, sin tocar) para obtener el pool de candidatas, y
  luego se evaluaron sus `requirements` contra las cards del usuario.
- **Una sola atribución por promo**: si una promo tiene varios `requirements`, se recorren en
  el orden en que los devuelve Prisma y, si ninguno matchea, el descarte se atribuye al
  motivo del **primer requirement evaluado** — nunca se cuenta una promo más de una vez.
  Si esa promo está guardada por el usuario (`savedPromoIds`), cuenta como "aceptadas"
  directamente (mismo criterio que el algoritmo real).
- Dentro de la Regla 3 (banco solo o wallet solo), cuando ninguna card matchea, se atribuye
  el motivo de la card que llegó **más lejos** en la cascada de checks antes de fallar (la
  que más condiciones sí cumplió) — es la interpretación más generosa de "primer punto de
  incompatibilidad" para esa card, y evita atribuir sistemáticamente todo a `bankId` solo
  por ser el primer check de la cascada.
- No se descubrió ninguna categoría de descarte nueva durante la instrumentación — las 12
  categorías pedidas por la CPO alcanzaron para clasificar el 100% de los casos.

## Resultado agregado (40 casos, 223.688 evaluaciones candidata×caso)

```
Pool de candidatas (SQL permisivo)         223.688  (100%)
│
├─▶ Aceptadas por matchesProfile()         118.716  (53.1%)
│
└─▶ Descartadas                            104.972  (46.9%)
      │
      ├─▶ regla banco+wallet                85.876   (81.8% del descarte)
      ├─▶ bankId                             16.696   (15.9% del descarte)
      ├─▶ cardNetworkId                       2.320    (2.2% del descarte)
      ├─▶ accountType                            68    (0.1% del descarte)
      ├─▶ cardType                               12   (<0.1% del descarte)
      ├─▶ walletId                                0    (0.0%)
      ├─▶ segmentId                               0    (0.0%)
      ├─▶ cardSegmentId                           0    (0.0%)
      ├─▶ cardTier                                0    (0.0%)
      ├─▶ regla Cuenta DNI                        0    (0.0%)
      ├─▶ sin requirements                        0    (0.0%)
      └─▶ otros                                   0    (0.0%)
```

| Motivo | Cantidad | % del total | % del descarte |
|---|---:|---:|---:|
| aceptadas | 118.716 | 53,07% | — |
| regla banco+wallet | 85.876 | 38,39% | 81,81% |
| bankId | 16.696 | 7,46% | 15,91% |
| cardNetworkId | 2.320 | 1,04% | 2,21% |
| accountType | 68 | 0,03% | 0,06% |
| cardType | 12 | 0,01% | 0,01% |
| walletId | 0 | 0,00% | 0,00% |
| segmentId | 0 | 0,00% | 0,00% |
| cardSegmentId | 0 | 0,00% | 0,00% |
| cardTier | 0 | 0,00% | 0,00% |
| regla Cuenta DNI | 0 | 0,00% | 0,00% |
| sin requirements | 0 | 0,00% | 0,00% |
| otros | 0 | 0,00% | 0,00% |
| **Total** | **223.688** | **100%** | **100%** |

Nota sobre el 53% de aceptación agregado: es más alto que el 84% de descarte puntual medido
antes (caso único `bubah22@gmail.com`/Buenos Aires en la medición HTTP) porque acá se
promedian 40 casos distintos, incluyendo usuarios con perfiles financieros muy amplios
(muchos bancos/wallets cargados) donde el pool SQL permisivo ya viene más ajustado. El
patrón por regla (qué explica el descarte cuando lo hay) es el dato relevante para esta
pregunta, no el ratio agregado aceptado/descartado.

## Lectura del resultado

Casi todo el descarte (**97,7%**) se concentra en dos motivos que la Alternativa B **no**
proponía subir a SQL:

- **`regla banco+wallet` (81,8%)**: el caso donde el requirement exige banco Y wallet en
  cards separadas del mismo usuario (líneas 863-893 de `matchesProfile()`). Es exactamente
  la lógica combinatoria que el documento `candidate-retrieval-v2.md` identificó como "la
  parte frágil" y recomendó **dejar en TypeScript**, no portar a SQL.
- **`bankId` (15,9%)**: el usuario simplemente no tiene ese banco en su perfil. La query SQL
  ya filtra por `bankId = ANY(userBankIds)`, así que este descarte ocurre cuando el
  requirement puntual pide un banco que el usuario SÍ tiene en alguna otra parte de su
  perfil (otra wallet, otro banco) pero no en la card específica que exige ese requirement,
  o cuando el `EXISTS` del SQL matcheó por `walletId` y no por `bankId`. No es un caso que
  `cardNetworkId`/`cardType`/`accountType` puedan resolver.

Las tres reglas que la Alternativa B proponía subir a SQL —`cardNetworkId`, `cardType`,
`accountType`— explican en conjunto solo **2,28% del descarte total** (2.400 de 104.972
casos). `walletId`, `segmentId`, `cardSegmentId`, `cardTier` y "Cuenta DNI" no aportaron
ningún descarte en esta muestra.

## Contra el objetivo de negocio planteado por la CPO

> "Si `cardNetwork`, `cardType` y `accountType` explican la gran mayoría del descarte, la
> Alternativa B pasa a ser una candidata fuerte. Si explican solo una fracción menor, no
> tiene sentido invertir otro spike en esa dirección."

Explican el **2,28%** del descarte medido. Es una fracción menor, no la gran mayoría.

## Recomendación

Con esta evidencia, la Alternativa B no tiene potencial real: aunque se subieran
`cardNetworkId`/`cardType`/`accountType` a la query SQL, el pool de candidatas bajaría de
223.688 a aproximadamente 221.288 (menos del 2% de reducción) — no resuelve el problema de
fondo que motivó todo este análisis (pool de miles de filas hidratadas de más). El costo de
implementación y mantenimiento de esa regla extra en SQL no se justifica frente a una
reducción marginal.

El motivo dominante del descarte (`regla banco+wallet`, 82%) es precisamente la parte que
`candidate-retrieval-v2.md` ya había descartado portar a SQL por ser lógica combinatoria
frágil — y el segundo motivo (`bankId`, 16%) tampoco es simplificable sin acercarse a
replicar el filtro real de perfil en SQL, algo que DR-004 rechazó explícitamente por riesgo
de falsos negativos.

Esto no cierra la posibilidad de reducir el pool — solo descarta el camino específico que
proponía la Alternativa B. Las alternativas A (precómputo) y C (candidatas por lo visible en
pantalla) del documento anterior no fueron evaluadas en este análisis y siguen abiertas.
