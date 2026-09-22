# Card de oportunidad — Home Design System — para decisión del CPO

**Estado**: 10 variantes construidas y verificadas, en paleta clara/sobria, con logos
reales de comercio. Pendiente de que el CPO elija cuál promover (o pida otra ronda).

**Dónde probarlas**: `http://localhost:3000/prototypes/oportunidad-card` (dev local,
rama `feature/nueva-home`). Teclas 1-9/0 para saltar directo a cada variante, flechas
para navegar, R para reiniciar el estado de la que tiene gesto (Swipe).

## Contexto

Las primeras 10 variantes se descartaron por completo: estaban en dark mode/glass,
un lenguaje visual ajeno al resto del producto y a lo que se ve en la competencia
(Banco Galicia, Buepp, MODO, BBVA). Se rehicieron desde cero en paleta clara,
reciclando los tokens `brand`/`accent` ya existentes en `tailwind.config.ts`, y
reemplazando los placeholders de logo (iniciales + color plano) por los logos reales
de los comercios de ejemplo (Carrefour, YPF, Farmacity, Coto), tomados de
`Commerce.logoUrl` en la base de dev.

## Tabla de variantes

| # | Variante | Eje | Cuándo es la elección correcta | Su costo |
|---|---|---|---|---|
| 1 | Número Dominante | Jerarquía: el % como protagonista absoluto | El usuario escanea rápido buscando "cuánto ahorro" | Poco contexto sobre día/tope a primera vista |
| 2 | Logo First | Layout tipo Galicia: bloque de imagen/color arriba + eyebrow naranja | Se quiere el look más fiel a la referencia principal | Ocupa más alto, menos denso en grilla |
| 3 | Wallet Hero | Logo + badge de tope arriba, fila de días tipo Buepp | Cuando el día de vigencia es dato crítico para decidir | Fila de días pesa si hay pocas promos con días variables |
| 4 | Compacta | Grilla 2 columnas de tiles tipo MODO | Para listar muchas oportunidades a la vez (home, sección "más promos") | Poco espacio para contexto (tope, red, vencimiento) |
| 5 | Match Badge | Eyebrow naranja "Ya tenés {medio} — te sirve" | Cuando el ángulo de personalización (perfil del usuario) es el gancho | Depende de tener perfil cargado; sin eso pierde sentido |
| 6 | Contexto Temporal | Tinte cálido + punto pulsante para urgencia ("vence hoy") | Para la promo destacada del día, con vencimiento cercano | No escala bien a una lista larga (todo urgente = nada urgente) |
| 7 | Comparativa | Muestra la 2da mejor alternativa del rubro, con barra de progreso | Cuando se quiere justificar por qué esta gana sobre otra | Requiere tener un "alt" real y relevante, si no se siente artificial |
| 8 | Minimal | Fila compacta, casi sin padding, mínimo motion | Para densidad alta tipo lista/tabla, uso repetido diario | Poco atractivo como pieza destacada/hero |
| 9 | Editorial | Titular grande narrando la promo como historia | Momento hero, primera card del home, poco frecuente | No es reusable en grilla, pesado si se repite |
| 10 | Swipe | Gesto de arrastre (derecha=guardar, izquierda=descartar) | Para un flujo de descubrimiento tipo "revisar y decidir" | Requiere touch/mouse drag, no apto para densidad ni teclado |

## Cambios de producción hechos para soportar esta exploración

- `middleware.ts`: se agregó `/prototypes` a `PUBLIC_PATHS` (evita el 307 de auth-gate
  al abrir el picker). Es un cambio real, aunque chico, sobre un archivo de producción —
  pendiente de decidir en Fase 6 (promoción) si se mantiene o se revierte al borrar la
  superficie de prototipo.
- Todo lo demás vive aislado en `app/prototypes/oportunidad-card/`, no importado desde
  código de producción.

## Próximo paso

Espera decisión del CPO: qué variante (o combinación) promover al Home real, o si pide
otra ronda de iteración antes de elegir.
