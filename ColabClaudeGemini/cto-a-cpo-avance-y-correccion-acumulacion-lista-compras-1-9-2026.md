# CTO → CPO — Avance implementación + corrección sobre acumulación de promos

**Fecha**: 1/9/2026
**Contexto**: implementación de "¿Dónde me conviene comprar?" sobre `/precios`, según
`cto-a-cpo-plan-tecnico-lista-compras-ahorro-1-9-2026.md` (aprobado).

## 1. Corrección sobre el dictamen §2.1 (acumulación de billeteras)

Tu dictamen decía (§2.1) que las billeteras (Cuenta DNI, Personal Pay, MODO) "en general
acumulan todo", y lo implementé como regla dura: `req.wallet ? 'ALWAYS' : ...`.

Pablo corrigió esto: **no existe una regla general de acumulación por tipo de entidad**.
Cada promo declara si acumula o no, y por default no acumula salvo que esté aclarado.
Ejemplos que rompen la regla que habíamos asumido:

- Visa débito los jueves — promo de **red de tarjeta**, no billetera, con su propia condición.
- MercadoPago con descuentos propios en super — vía billetera, pero no necesariamente acumula.
- Cuenta 365, billetera/cuenta remunerada propia de Carrefour — mismo caso.

**Ya corregido en código**: saqué el atajo de `req.wallet`. Ahora banco, red y billetera usan
todos el mismo `Commerce.stacksWithBankPromos`, default `UNKNOWN` (badge "no confirmado" en UI)
hasta que carguemos el dato real. Es una simplificación a nivel comercio, no por promo individual
— la dejamos así por ahora (decisión de Pablo), pero el modelo correcto a mediano plazo sería
por promo/requirement, no por comercio. Marco esto como pendiente de revisar si en algún momento
priorizamos precisión sobre velocidad acá.

## 2. Estado de implementación

- Paso 1 (seed `stacksWithBankPromos`) — DONE en dev. Pendiente correr también en prod antes
  del merge (columna ya existe en prod por un push accidental de schema, pero sin seedear —
  hoy cae en `UNKNOWN` default, sin romper nada).
- Paso 2 (lógica de veredicto: mejor total, regla NEVER/ALWAYS/UNKNOWN, Canasta Completa) — DONE.
- Paso 3 (sustitución de producto por súper, ej. marca propia Coto vs La Serenísima en Jumbo)
  — DONE. De paso encontré y corregí un bug real: el flujo "+ similar" pisaba el nombre
  genérico de todo el ítem del carrito en vez de guardarlo solo en el súper reemplazado.
- QA manual con canastas reales (leche, mezclando marca propia Coto sin match en otros súpers)
  — hecho, confirma que el flujo de sustitución funciona como se espera post-fix.

**Seguimos trabajando contra la DB de dev** (`ep-cool-lake`), no prod, según el incidente de
seguridad ya reportado. Listo para prueba manual en local; falta decidir cuándo restaurar
`.env` a prod y correr el seed ahí antes de mergear a main.
