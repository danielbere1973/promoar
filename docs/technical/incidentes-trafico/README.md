# Incidentes de tráfico no deseado / consumo de infraestructura

**Domain**: Technical
**Knowledge Type**: Support
**Authority**: No

Carpeta dedicada a documentar cada episodio de tráfico automatizado (scrapers, bots,
crawlers) que generó consumo anómalo en Neon/Vercel, su diagnóstico y su fix. Objetivo:
tener memoria escrita de qué se probó, qué funcionó y qué quedó pendiente, para no repetir
investigación desde cero cada vez que aparece un patrón nuevo.

**Filosofía general** (aclarada explícitamente por Dani, 17/7/2026): "A mí no me jode que
me scrapeen. Me jode que me generan un gasto para beneficio de otros." El objetivo no es
bloquear el acceso a datos públicos por principio, sino evitar que terceros externalicen su
costo de infraestructura sobre la cuenta de PromoAR.

## Documentos

- [2026-07-cronologia-neon-bot-traffic.md](2026-07-cronologia-neon-bot-traffic.md) —
  cronología completa 8/7 al 17/7/2026: 4 incidentes (IPs OVH fijas, promos vencidas con
  query extra, promos borradas con el mismo patrón, scraping rotativo AR + bug del
  rate-limit + Googlebot/Bingbot), fixes aplicados, y estado abierto.

## Mecanismos de defensa activos hoy

- **Vercel Firewall**: bloqueo de IPs específicas confirmadas como scrapers, ruleset nativo
  "Bot Protection" en modo Challenge, ruleset nativo "AI Bots" en modo Block.
- **`middleware.ts`**: geo-block por país (excepto crawlers de buscadores permitidos),
  rate-limit propio en memoria (sliding window) sobre `/promos/`, `/comercios/`,
  `/api/promos`, `/api/search` — 15 req/min general, 5 req/min si el User-Agent no matchea
  patrón de navegador real.
