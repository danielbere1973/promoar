# Specs — banners de sponsors (carousel DynamicAdBanner)

Contexto: `app/components/DynamicAdBanner.tsx` muestra un carousel con slides de imagen real
(hoy solo Estación Mascotera) y slides tipo tarjeta CSS (Coto, MODO, Galicia, Carrefour,
Santander). El dueño del proyecto comparó ambos y las tarjetas CSS pierden feo contra la
imagen real — foto + ilustración + tipografía integrada vs. un rectángulo de color sólido con
texto encima. Decisión: reemplazar las tarjetas CSS por imágenes reales del mismo tipo que la
de Estación Mascotera, generadas o diseñadas, no maquetadas con CSS.

## Tamaño del archivo

- **1905 × 560 px** (relación de aspecto ~3.4:1)
- Formato **.webp**
- Orientación horizontal

Es el tamaño exacto del banner de referencia ya en producción
(`public/EM/carousel/envios-gratis.webp`).

## Cómo se muestra en la app (por qué importa el margen de seguridad)

| Breakpoint | Contenedor | Comportamiento |
|---|---|---|
| Desktop | 140px alto, ancho fluido (~1/3 del carousel) | `object-contain` → se ve completa, sin recortar |
| Mobile | 130px alto, ancho completo de pantalla | `object-cover` → **puede recortar bordes** laterales/verticales |

**Margen de seguridad: ~80px en los 4 bordes.** Todo el contenido clave (texto, logo, CTA)
debe estar dentro de ese margen interior, porque en mobile el borde se recorta.

## Referencia de estilo a igualar

El banner de Estación Mascotera ya en producción (`public/EM/carousel/envios-gratis.webp`)
es la vara: foto real con luz natural, cinta diagonal con cambio de color para separar
mensaje principal de secundario, íconos ilustrados propios, elementos decorativos (patitas)
como textura, botón con forma propia. Jerarquía clara, cálido, no se siente anuncio
genérico.

## Marcas a generar (orden de prioridad)

Cada una necesita: nombre de marca, título corto, subtítulo, CTA, logo — mismo dato que ya
tiene el componente, pero resuelto como imagen en vez de HTML/CSS.

1. **Coto** — acento azul `#0057A8` — "Ahorrá en tu súper" / "Mirá todas las promos vigentes
   de Coto."
2. **MODO** — acento turquesa `#0EA5A4` — "Multiplicá tus ahorros" / "Pagá con MODO y sumá
   reintegros en el acto."
3. **Galicia** — acento naranja `#F7941E` — "Descubrí tus promos" / "Exprimí al máximo tus
   tarjetas Galicia."
4. **Carrefour** — acento azul `#1C4D9E` — "Descuentos exclusivos" / "Llená el changuito en
   Carrefour y pagá menos."
5. **Santander** — acento rojo `#EC0000` — "Ahorrá todos los días" / "Conocé los beneficios
   que Santander tiene para vos."

## Dónde van los archivos

`public/sponsors/<marca>.webp` (o reusar `public/EM/carousel/` si se prefiere junto al de
Estación Mascotera) — avisar la ruta final para actualizar `SLIDES` en
`app/components/DynamicAdBanner.tsx` (cada slide pasa de `type: 'css'` a `type: 'image'` con
`src`/`alt`).
