import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const SLIDES = [
  // SLIDE 1: PORTADA / HOOK
  {
    badge: 'GUÍA DEFINITIVA DE AHORRO 🇦🇷',
    badgeColor: '#3B82F6',
    title: '¿Cuánto estás perdiendo por no aprovechar los reintegros?',
    subtitle: 'En Argentina, usar la tarjeta o billetera equivocada te cuesta más de $60.000 al mes.',
    highlight: 'Te presentamos los 3 comparadores interactivos de PromoAR para no pagar de más nunca más.',
    footer: 'Deslizá para ver los 3 comparadores 👉',
    categoryIcon: '💡',
    accentColor: '#3B82F6',
    tagList: ['100% Gratuito', 'Sin Registro Requerido', 'Datos Actualizados'],
  },

  // SLIDE 2: COMPARADOR 1 - SUPERMERCADOS
  {
    slideNum: '01',
    badge: 'COMPARADOR #1',
    badgeColor: '#10B981',
    title: 'Simulador de Supermercados 🛒',
    subtitle: 'Coto · Jumbo · Carrefour · Disco · Vea · ChangoMás',
    mainMetric: 'Hasta $35.000',
    metricLabel: 'de reintegro promedio por mes',
    bodyText: 'Elegís tu banco (Galicia, Nación, Santander, BBVA...) o tu billetera (Cuenta DNI, MODO, Mercado Pago) y el simulador te muestra exactamente qué día de la semana te conviene hacer la compra grande.',
    bulletPoints: [
      '✅ Compara topes por cuenta vs por transacción',
      '✅ Detecta descuentos acumulables con MODO',
      '✅ Te avisa si hay cuotas sin interés vigentes',
    ],
    accentColor: '#10B981',
    footer: 'Deslizá para el siguiente comparador 👉',
  },

  // SLIDE 3: COMPARADOR 2 - COMBUSTIBLE
  {
    slideNum: '02',
    badge: 'COMPARADOR #2',
    badgeColor: '#F59E0B',
    title: 'Comparador de Combustible ⛽',
    subtitle: 'YPF · Shell · Axion · Puma',
    mainMetric: 'Hasta $20.000',
    metricLabel: 'de ahorro mensual en nafta y diésel',
    bodyText: 'Llenar el tanque hoy cuesta caro. Con este comparador ves al instante qué día de la semana tiene el mejor reintegro en cada petrolera según tus tarjetas y apps de pago.',
    bulletPoints: [
      '✅ App YPF vs MODO vs Cuenta DNI vs bancos',
      '✅ Tope semanal y mensual calculado al detalle',
      '✅ Filtro rápido por tipo de combustible (Nafta / Diésel)',
    ],
    accentColor: '#F59E0B',
    footer: 'Deslizá para el siguiente comparador 👉',
  },

  // SLIDE 4: COMPARADOR 3 - FARMACIAS
  {
    slideNum: '03',
    badge: 'COMPARADOR #3',
    badgeColor: '#EC4899',
    title: 'Comparador de Farmacias 💊',
    subtitle: 'Farmacity · Central Oeste · Farmacias del Pueblo · OpenFarma',
    mainMetric: 'Hasta 35% OFF',
    metricLabel: 'en medicamentos y cuidado personal',
    bodyText: 'Perfumería, pañales y medicamentos tienen los descuentos más altos de la semana, pero los días cambian según la cadena. Este comparador te ordena las promos por fecha y medio de pago.',
    bulletPoints: [
      '✅ Descuentos exclusivos jubilados y plan sueldo',
      '✅ Cobertura en las principales cadenas de todo el país',
      '✅ Letra chica y exclusiones explicadas en criollo',
    ],
    accentColor: '#EC4899',
    footer: 'Deslizá para ver cómo usarlos 👉',
  },

  // SLIDE 5: CIERRE / CALL TO ACTION
  {
    slideNum: '04',
    badge: 'TODO EN UN SOLO LUGAR 🚀',
    badgeColor: '#6366F1',
    title: 'Ahorrá tiempo y dinero todos los días.',
    subtitle: 'Más de 1.500 promociones bancarias y de comercios verificadas a diario en Argentina.',
    mainMetric: '100% Gratis',
    metricLabel: 'sin suscripción ni datos ocultos',
    ctaBox: {
      url: 'promoar.com.ar',
      instructions: 'Entrá directo desde el link en nuestra bio o buscá PromoAR en tu navegador.',
    },
    actionItems: [
      '📌 Guardá este post para consultarlo antes de hacer las compras.',
      '👥 Compartilo con un amigo o familiar para que deje de pagar de más.',
      '📲 Seguinos en @promoar para enterarte de promos antes que nadie.',
    ],
    accentColor: '#6366F1',
    footer: 'promoar.com.ar · Promociones bancarias inteligentes',
  },
]

function generateHtml(slide: any, index: number, total: number): string {
  const isHook = index === 0
  const isCta = index === total - 1

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        width: 1080px;
        height: 1350px;
        background: #070F1E;
        color: #F8FAFC;
        font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 80px 80px 70px 80px;
      }

      /* Glows de fondo */
      .bg-glow-1 {
        position: absolute;
        top: -150px;
        right: -150px;
        width: 650px;
        height: 650px;
        background: radial-gradient(circle, ${slide.accentColor}33 0%, rgba(7,15,30,0) 70%);
        border-radius: 50%;
        filter: blur(80px);
        pointer-events: none;
      }

      .bg-glow-2 {
        position: absolute;
        bottom: -150px;
        left: -150px;
        width: 600px;
        height: 600px;
        background: radial-gradient(circle, #1E3A8A33 0%, rgba(7,15,30,0) 70%);
        border-radius: 50%;
        filter: blur(80px);
        pointer-events: none;
      }

      /* Header */
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 10;
      }

      .logo-pill {
        display: flex;
        align-items: center;
        gap: 14px;
        background: rgba(15, 34, 61, 0.85);
        border: 1.5px solid rgba(255, 255, 255, 0.12);
        padding: 12px 24px;
        border-radius: 9999px;
        backdrop-filter: blur(12px);
      }

      .logo-icon {
        width: 38px;
        height: 38px;
        background: linear-gradient(135deg, #2563EB, #1D4ED8);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 22px;
        color: #FFFFFF;
      }

      .logo-text {
        font-weight: 900;
        font-size: 26px;
        letter-spacing: -0.5px;
        color: #FFFFFF;
      }

      .logo-tag {
        font-size: 13px;
        font-weight: 700;
        color: #60A5FA;
        background: rgba(96, 165, 250, 0.15);
        padding: 3px 10px;
        border-radius: 9999px;
        margin-left: 4px;
      }

      .slide-counter {
        font-size: 18px;
        font-weight: 800;
        color: #94A3B8;
        background: rgba(15, 34, 61, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 8px 18px;
        border-radius: 9999px;
      }

      /* Content Area */
      .content {
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: 32px;
        margin-top: auto;
        margin-bottom: auto;
      }

      .badge {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 22px;
        border-radius: 9999px;
        font-size: 16px;
        font-weight: 900;
        letter-spacing: 1px;
        text-transform: uppercase;
        background: ${slide.accentColor}22;
        color: ${slide.accentColor};
        border: 1.5px solid ${slide.accentColor}55;
      }

      .title {
        font-size: ${isHook ? '58px' : '52px'};
        font-weight: 900;
        line-height: 1.15;
        letter-spacing: -1.5px;
        color: #FFFFFF;
      }

      .subtitle {
        font-size: 24px;
        font-weight: 700;
        color: #94A3B8;
        line-height: 1.4;
      }

      /* Metric Card */
      .metric-card {
        background: linear-gradient(145deg, rgba(15, 34, 61, 0.9), rgba(10, 22, 40, 0.95));
        border: 2px solid ${slide.accentColor}44;
        border-radius: 32px;
        padding: 36px 44px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .metric-value {
        font-size: 64px;
        font-weight: 900;
        letter-spacing: -2px;
        color: ${slide.accentColor};
        line-height: 1;
      }

      .metric-label {
        font-size: 20px;
        font-weight: 700;
        color: #E2E8F0;
      }

      .body-text {
        font-size: 22px;
        line-height: 1.5;
        color: #CBD5E1;
        font-weight: 500;
      }

      .bullet-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 8px;
      }

      .bullet-item {
        font-size: 21px;
        font-weight: 700;
        color: #F1F5F9;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      /* CTA Box */
      .cta-card {
        background: linear-gradient(135deg, #1E3A8A 0%, #0F223D 100%);
        border: 2px solid #3B82F688;
        border-radius: 32px;
        padding: 40px;
        text-align: center;
        box-shadow: 0 25px 60px rgba(37, 99, 235, 0.25);
      }

      .cta-url {
        font-size: 44px;
        font-weight: 900;
        color: #FFFFFF;
        letter-spacing: -1px;
        margin-bottom: 12px;
      }

      .cta-sub {
        font-size: 20px;
        font-weight: 600;
        color: #93C5FD;
      }

      /* Footer */
      .footer {
        z-index: 10;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 30px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .footer-cta {
        font-size: 19px;
        font-weight: 800;
        color: ${slide.accentColor};
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .footer-brand {
        font-size: 16px;
        font-weight: 700;
        color: #64748B;
      }
    </style>
  </head>
  <body>
    <div class="bg-glow-1"></div>
    <div class="bg-glow-2"></div>

    <!-- Header -->
    <div class="header">
      <div class="logo-pill">
        <div class="logo-icon">%</div>
        <div class="logo-text">PromoAR</div>
        <span class="logo-tag">App</span>
      </div>
      <div class="slide-counter">${index + 1} / ${total}</div>
    </div>

    <!-- Main Content -->
    <div class="content">
      <div class="badge">${slide.badge}</div>
      <h1 class="title">${slide.title}</h1>
      <p class="subtitle">${slide.subtitle}</p>

      ${slide.mainMetric ? `
        <div class="metric-card">
          <div class="metric-value">${slide.mainMetric}</div>
          <div class="metric-label">${slide.metricLabel}</div>
          ${slide.bodyText ? `<p class="body-text">${slide.bodyText}</p>` : ''}
          ${slide.bulletPoints ? `
            <div class="bullet-list">
              ${slide.bulletPoints.map((bp: string) => `<div class="bullet-item">${bp}</div>`).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${isHook && slide.highlight ? `
        <div class="metric-card" style="border-color: #3B82F666;">
          <p class="body-text" style="font-size: 24px; font-weight: 600; color: #E2E8F0;">
            ${slide.highlight}
          </p>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px;">
            ${slide.tagList.map((t: string) => `
              <span style="background: #1E293B; border: 1px solid #334155; padding: 8px 16px; border-radius: 9999px; font-size: 16px; font-weight: 700; color: #60A5FA;">
                ✨ ${t}
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${isCta ? `
        <div class="cta-card">
          <div class="cta-url">🌐 ${slide.ctaBox.url}</div>
          <div class="cta-sub">${slide.ctaBox.instructions}</div>
        </div>
        <div class="bullet-list">
          ${slide.actionItems.map((ai: string) => `
            <div class="bullet-item" style="font-size: 19px; color: #CBD5E1;">${ai}</div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-cta">${slide.footer}</div>
      <div class="footer-brand">@promoar.com.ar</div>
    </div>
  </body>
  </html>
  `
}

async function main() {
  console.log('🚀 Iniciando renderizado de placas de carrusel de Instagram (1080x1350)...')

  const outputDir = path.join(process.cwd(), 'public', 'social', 'carousel-1')
  const artifactDir = path.join('C:', 'Users', 'pablo', '.gemini', 'antigravity-ide', 'brain', '2dcacf2c-b806-4356-8315-1dc73f08d749')

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 2, // Retina 2x para máxima nitidez en Instagram
  })

  for (let i = 0; i < SLIDES.length; i++) {
    const slide = SLIDES[i]
    const html = generateHtml(slide, i, SLIDES.length)
    await page.setContent(html, { waitUntil: 'networkidle' })

    const fileName = `slide-${i + 1}.png`
    const publicPath = path.join(outputDir, fileName)
    const artifactPath = path.join(artifactDir, `carousel_1_${fileName}`)

    await page.screenshot({ path: publicPath, type: 'png' })
    await page.screenshot({ path: artifactPath, type: 'png' })

    console.log(`✅ Slide ${i + 1}/${SLIDES.length} generado: ${fileName}`)
  }

  await browser.close()
  console.log('🎉 ¡Carrusel completo exportado con éxito en public/social/carousel-1/!')
}

main().catch(console.error)
