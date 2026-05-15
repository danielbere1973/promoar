# PromoAR — Estado del Proyecto
**Stack:** Next.js 14, Prisma, Neon (PostgreSQL), TypeScript  
**Usuario de prueba:** litadescuentos@gmail.com

---

## SCRAPERS — ESTADO

| Scraper | Archivo | Estado | Notas |
|---------|---------|--------|-------|
| Coto | `lib/scrapers/coto.ts` | ✅ Funcionando | |
| MODO | `lib/scrapers/modo.ts` | ✅ Funcionando | |
| Diarco | `lib/scrapers/diarco.ts` | ✅ Funcionando | |
| Jumbo | `lib/scrapers/jumbo.ts` | ✅ Funcionando | Playwright |
| Disco | `lib/scrapers/disco.ts` | ✅ Funcionando | Playwright |
| Vea | `lib/scrapers/vea.ts` | ✅ Funcionando | Playwright |
| ChangoMas | `lib/scrapers/changomas.ts` | ✅ Funcionando | Playwright |
| Carrefour | `lib/scrapers/carrefour.ts` | ⚠️ Pendiente probar | Playwright, SPA VTEX |
| Mercado Pago | `lib/scrapers/mercadopago.ts` | ⚠️ Parcial | Playwright, trae promos pero son de Cyber Monday nov 2025 (expiradas). Cuando haya promos vigentes debería funcionar |
| Cuenta DNI | `lib/scrapers/cuentadni.ts` | ✅ Funcionando | axios+cheerio, 20 promos, días hardcodeados en IMG_MAP |

---

## FEATURES IMPLEMENTADAS

### URLs SEO con slugs
- Campo `slug TEXT UNIQUE` agregado a tabla `promos` con SQL directo en Neon
- `npx prisma db pull` y `npx prisma generate` ya corridos
- `lib/utils/promoSlug.ts` — genera slugs como `coto-20pct-reintegro-icbc-sab-dom`
- `app/promos/[slug]/page.tsx` — página de detalle con metadata dinámica
- Click en tarjeta → navega directo a `/promos/[slug]` (sin modal)
- Modal como fallback para promos sin slug todavía

### Filtro de Indumentaria
- Agregado a `CATEGORIAS_FILTER` en `app/page.tsx`

---

## FIXES IMPORTANTES EN ESTA SESIÓN

### route.ts (app/api/promos/route.ts)
1. **Fix matcheo solo-wallet:** `if (!card.walletId) return false` en lugar de `if (card.bankId) return false` — permite que cards Banco+MODO matcheen promos de solo MODO
2. **Regla especial Cuenta DNI:** Si promo requiere Banco Provincia + Cuenta DNI, basta con que el usuario tenga Cuenta DNI (implica tener cuenta en Banco Provincia)

### perfil/page.tsx
- Toggle MODO oculto cuando entityType === 'wallet' — evitaba que Cuenta DNI se guardara como MODO

---

## PENDIENTES

### Inmediatos
1. **Re-scrapear todo** — para generar slugs en todas las promos existentes
2. **Verificar Carrefour** — probar si trae promos correctamente
3. **Sacar logs de debug** — hay `console.log` de debug en `cuentadni.ts` y `mercadopago.ts`
4. **MercadoPago** — investigar URL de promos QR en comercios físicos (no están en `promociones.mercadopago.com.ar` sino en la app). Posible: interceptar tráfico con Charles Proxy

### Próximos scrapers sugeridos (en orden de prioridad)
1. ICBC — `beneficios.icbc.com.ar` — HTML plano, fácil
2. Banco Ciudad / BUEPP — Playwright
3. Credicoop — `beneficios.bancocredicoop.coop` — Playwright
4. Banco Patagonia — Playwright
5. Galicia — SPA con API interna, complejo
6. BNA, BBVA, Santander, Macro, Supervielle — cubiertos en parte por MODO

### Features futuras
- Agregar Cuenta DNI como opción en lista de wallets del perfil de usuario (ya está en DB)
- Scrapers de bancos con NFC (tarjeta física) — cobrando más relevancia
- Diseño visual con Claude Design (pendiente para más adelante)
- `generateStaticParams` para pre-renderizar páginas de promos populares

---

## DATOS TÉCNICOS ÚTILES

### IDs importantes en la DB (Neon)
- Wallet Cuenta DNI: `5a90bf8a-6f95-449f-b4f6-8647a6d3c9b4`
- Banco Provincia de Buenos Aires: `cmnulzeoy0007qlkk1oepw305`
- Wallet MODO: `cmnulzh04000aqlkk8mnpzo46`
- Wallet Mercado Pago: `cmnulzfz80009qlkkuyavwcvh`

### SQL útiles
```sql
-- Ver slugs generados
SELECT title, slug FROM "promos" WHERE slug IS NOT NULL LIMIT 10;

-- Borrar promos por fuente para re-scrapear
DELETE FROM "promo_requirements" WHERE "promoId" IN (SELECT id FROM "promos" WHERE "sourceUrl" LIKE '%coto.com.ar%');
DELETE FROM "promos" WHERE "sourceUrl" LIKE '%coto.com.ar%';

-- Ver perfil financiero de un usuario
SELECT b.name as banco, w.name as wallet, cn.name as red, uc."cardType"
FROM users u
JOIN financial_profiles fp ON fp."userId" = u.id
JOIN user_cards uc ON uc."financialProfileId" = fp.id
LEFT JOIN banks b ON b.id = uc."bankId"
LEFT JOIN wallets w ON w.id = uc."walletId"
LEFT JOIN card_networks cn ON cn.id = uc."cardNetworkId"
WHERE u.email = 'litadescuentos@gmail.com';
```

### validDays bitmask
- bit 0 = domingo, 1 = lunes, 2 = martes, 3 = miércoles, 4 = jueves, 5 = viernes, 6 = sábado
- 127 = todos los días
- 2 = solo lunes, 16 = solo jueves, 65 = sáb+dom, 62 = lun-vie
