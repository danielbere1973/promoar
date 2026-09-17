import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function generateSocialAssets() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Convertir logo transparente a base64 para inyectarlo sin problemas
  const logoPath = path.resolve('public/promoar_logo_clean.png');
  const logoBase64 = fs.readFileSync(logoPath).toString('base64');
  const logoSrc = `data:image/png;base64,${logoBase64}`;

  // 1. IMAGEN PARA INSTAGRAM (1080x1080 Cuadrada)
  await page.setViewportSize({ width: 1080, height: 1080 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='utf-8'>
      <link href='https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap' rel='stylesheet'>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        body {
          width: 1080px;
          height: 1080px;
          background: #090D14;
          color: #fff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 75px 70px;
          position: relative;
          overflow: hidden;
        }
        .glow-top {
          position: absolute;
          top: -150px;
          right: -150px;
          width: 550px;
          height: 550px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(0,0,0,0) 70%);
        }
        .glow-bottom {
          position: absolute;
          bottom: -150px;
          left: -150px;
          width: 550px;
          height: 550px;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, rgba(0,0,0,0) 70%);
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 10;
        }
        .logo-container {
          background: #ffffff;
          padding: 10px 24px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .logo-img {
          height: 38px;
          width: auto;
          display: block;
        }
        .badge {
          background: rgba(232, 78, 39, 0.15);
          border: 1px solid rgba(232, 78, 39, 0.4);
          color: #FF7A50;
          padding: 10px 22px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .hero {
          z-index: 10;
          margin: 25px 0;
        }
        .tagline {
          font-size: 19px;
          font-weight: 800;
          color: #10B981;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 14px;
        }
        .title {
          font-size: 58px;
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -1.5px;
          margin-bottom: 24px;
        }
        .title span {
          background: linear-gradient(90deg, #60A5FA 0%, #34D399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .card-preview {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 28px;
          padding: 30px;
          backdrop-filter: blur(20px);
          box-shadow: 0 30px 60px rgba(0,0,0,0.5);
        }
        .search-bar-mock {
          background: #131B2A;
          border: 1px solid rgba(59, 130, 246, 0.4);
          border-radius: 18px;
          padding: 18px 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 20px;
          color: #94A3B8;
          margin-bottom: 24px;
        }
        .search-query {
          color: #fff;
          font-weight: 700;
        }
        .results-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .res-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .res-bank {
          font-size: 15px;
          font-weight: 800;
          color: #E2E8F0;
        }
        .res-commerce {
          font-size: 13px;
          color: #94A3B8;
          margin-top: 2px;
        }
        .res-discount {
          font-size: 24px;
          font-weight: 900;
          color: #34D399;
        }
        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 30px;
          z-index: 10;
        }
        .footer-logo {
          height: 38px;
          filter: brightness(0) invert(1);
          opacity: 0.9;
        }
        .cta-box {
          background: #fff;
          color: #090D14;
          font-weight: 800;
          padding: 16px 30px;
          border-radius: 16px;
          font-size: 18px;
          letter-spacing: -0.2px;
        }
      </style>
    </head>
    <body>
      <div class='glow-top'></div>
      <div class='glow-bottom'></div>

      <div class='header'>
        <div class='logo-container'>
          <img src='${logoSrc}' alt='PromoAR' class='logo-img' />
        </div>
        <div class='badge'>100% Gratuito · Sin Registro</div>
      </div>

      <div class='hero'>
        <div class='tagline'>¿Vas a pagar precio lleno?</div>
        <h1 class='title'>Buscá qué descuento tenés <span>antes de comprar</span></h1>
        
        <div class='card-preview'>
          <div class='search-bar-mock'>
            <span>🔍</span>
            <span>Buscando: <strong class='search-query'>'Zapatillas Nike'</strong></span>
          </div>

          <div class='results-grid'>
            <div class='res-item'>
              <div>
                <div class='res-bank'>Banco Galicia</div>
                <div class='res-commerce'>Nike / Dexter · Hoy</div>
              </div>
              <div class='res-discount'>-30%</div>
            </div>
            <div class='res-item'>
              <div>
                <div class='res-bank'>MODO + Nación</div>
                <div class='res-commerce'>Indumentaria y Calzado</div>
              </div>
              <div class='res-discount'>-25%</div>
            </div>
            <div class='res-item'>
              <div>
                <div class='res-bank'>Cuenta DNI</div>
                <div class='res-commerce'>Comercios adheridos</div>
              </div>
              <div class='res-discount'>-20%</div>
            </div>
            <div class='res-item'>
              <div>
                <div class='res-bank'>BBVA Francés</div>
                <div class='res-commerce'>Locales adheridos</div>
              </div>
              <div class='res-discount'>6 CSI</div>
            </div>
          </div>
        </div>
      </div>

      <div class='footer'>
        <div style='font-size: 28px; font-weight: 900; color: #fff; letter-spacing: -0.5px;'>
          promoar<span style='color: #F15A24;'>.com.ar</span>
        </div>
        <div class='cta-box'>Buscá tu beneficio gratis ↗</div>
      </div>
    </body>
    </html>
  `);
  
  await page.screenshot({ path: 'public/promoar_social_ig.png', type: 'png' });
  console.log('Saved public/promoar_social_ig.png');

  // 2. IMAGEN HORIZONTAL PARA X / TWITTER (1200x675)
  await page.setViewportSize({ width: 1200, height: 675 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='utf-8'>
      <link href='https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap' rel='stylesheet'>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        body {
          width: 1200px;
          height: 675px;
          background: #090D14;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 60px 70px;
          position: relative;
          overflow: hidden;
        }
        .glow-top {
          position: absolute;
          top: -150px;
          left: 400px;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, rgba(0,0,0,0) 70%);
        }
        .left-col {
          width: 520px;
          z-index: 10;
        }
        .logo-container {
          background: #ffffff;
          padding: 8px 20px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 22px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        .logo-img {
          height: 36px;
          width: auto;
          display: block;
        }
        .badge {
          display: inline-block;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          color: #34D399;
          padding: 6px 14px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 16px;
        }
        .title {
          font-size: 46px;
          font-weight: 900;
          line-height: 1.12;
          letter-spacing: -1px;
          margin-bottom: 18px;
        }
        .title span {
          background: linear-gradient(90deg, #60A5FA 0%, #34D399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtitle {
          font-size: 17px;
          color: #94A3B8;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .domain {
          font-size: 24px;
          font-weight: 900;
          color: #fff;
        }
        .domain span { color: #38BDF8; }

        .right-col {
          width: 500px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 26px;
          backdrop-filter: blur(20px);
          z-index: 10;
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
        }
        .search-bar-mock {
          background: #131B2A;
          border: 1px solid rgba(59, 130, 246, 0.4);
          border-radius: 14px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 16px;
          color: #94A3B8;
          margin-bottom: 18px;
        }
        .search-query { color: #fff; font-weight: 700; }
        .res-list { display: flex; flex-direction: column; gap: 10px; }
        .res-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .res-bank { font-size: 14px; font-weight: 800; color: #E2E8F0; }
        .res-commerce { font-size: 12px; color: #94A3B8; }
        .res-discount { font-size: 20px; font-weight: 900; color: #34D399; }
      </style>
    </head>
    <body>
      <div class='glow-top'></div>

      <div class='left-col'>
        <div class='logo-container'>
          <img src='${logoSrc}' alt='PromoAR' class='logo-img' />
        </div>
        <br>
        <div class='badge'>Buscador de Descuentos 🇦🇷</div>
        <h1 class='title'>No pagues de más.<br>Buscá <span>antes de comprar</span>.</h1>
        <p class='subtitle'>Encontrá al instante qué banco, tarjeta o billetera virtual tiene reintegro hoy en indumentaria, tecnología, combustible y más.</p>
        <div class='domain'>promoar<span>.com.ar</span></div>
      </div>

      <div class='right-col'>
        <div class='search-bar-mock'>
          <span>🔍</span>
          <span>Buscando: <strong class='search-query'>'Zapatillas Nike'</strong></span>
        </div>
        <div class='res-list'>
          <div class='res-item'>
            <div>
              <div class='res-bank'>Banco Galicia</div>
              <div class='res-commerce'>Nike / Dexter · Todos los días</div>
            </div>
            <div class='res-discount'>-30%</div>
          </div>
          <div class='res-item'>
            <div>
              <div class='res-bank'>MODO + Banco Nación</div>
              <div class='res-commerce'>Comercios adheridos</div>
            </div>
            <div class='res-discount'>-25%</div>
          </div>
          <div class='res-item'>
            <div>
              <div class='res-bank'>Cuenta DNI</div>
              <div class='res-commerce'>Billetera digital</div>
            </div>
            <div class='res-discount'>-20%</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);

  await page.screenshot({ path: 'public/promoar_social_x.png', type: 'png' });
  console.log('Saved public/promoar_social_x.png');

  // 3. IMAGEN LIGHT THEME PARA IG (1080x1080)
  await page.setViewportSize({ width: 1080, height: 1080 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='utf-8'>
      <link href='https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap' rel='stylesheet'>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        body {
          width: 1080px;
          height: 1080px;
          background: #F8FAFC;
          color: #0F172A;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 75px 70px;
          position: relative;
          overflow: hidden;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 10;
        }
        .logo-img {
          height: 46px;
          width: auto;
          display: block;
        }
        .badge {
          background: #EFF6FF;
          border: 1px solid #BFDBFE;
          color: #1D4ED8;
          padding: 10px 22px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .hero {
          z-index: 10;
          margin: 25px 0;
        }
        .tagline {
          font-size: 19px;
          font-weight: 800;
          color: #EA580C;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 14px;
        }
        .title {
          font-size: 58px;
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -1.5px;
          margin-bottom: 24px;
          color: #0B192C;
        }
        .title span {
          color: #1E3A5F;
        }
        .card-preview {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 28px;
          padding: 32px;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.08);
        }
        .search-bar-mock {
          background: #F1F5F9;
          border: 1px solid #CBD5E1;
          border-radius: 18px;
          padding: 18px 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 20px;
          color: #64748B;
          margin-bottom: 24px;
        }
        .search-query {
          color: #0F172A;
          font-weight: 800;
        }
        .results-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .res-item {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 18px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .res-bank {
          font-size: 16px;
          font-weight: 800;
          color: #0F172A;
        }
        .res-commerce {
          font-size: 13px;
          color: #64748B;
          margin-top: 2px;
        }
        .res-discount {
          font-size: 26px;
          font-weight: 900;
          color: #059669;
        }
        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid #E2E8F0;
          padding-top: 30px;
          z-index: 10;
        }
        .cta-box {
          background: #1E3A5F;
          color: #FFFFFF;
          font-weight: 800;
          padding: 16px 30px;
          border-radius: 16px;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class='header'>
        <img src='${logoSrc}' alt='PromoAR' class='logo-img' />
        <div class='badge'>100% Gratuito · Sin Registro</div>
      </div>

      <div class='hero'>
        <div class='tagline'>¿Vas a pagar precio lleno?</div>
        <h1 class='title'>Buscá qué descuento tenés <span>antes de comprar</span></h1>
        
        <div class='card-preview'>
          <div class='search-bar-mock'>
            <span>🔍</span>
            <span>Buscando: <strong class='search-query'>'Zapatillas Nike'</strong></span>
          </div>

          <div class='results-grid'>
            <div class='res-item'>
              <div>
                <div class='res-bank'>Banco Galicia</div>
                <div class='res-commerce'>Nike / Dexter · Hoy</div>
              </div>
              <div class='res-discount'>-30%</div>
            </div>
            <div class='res-item'>
              <div>
                <div class='res-bank'>MODO + Nación</div>
                <div class='res-commerce'>Indumentaria y Calzado</div>
              </div>
              <div class='res-discount'>-25%</div>
            </div>
            <div class='res-item'>
              <div>
                <div class='res-bank'>Cuenta DNI</div>
                <div class='res-commerce'>Comercios adheridos</div>
              </div>
              <div class='res-discount'>-20%</div>
            </div>
            <div class='res-item'>
              <div>
                <div class='res-bank'>BBVA Francés</div>
                <div class='res-commerce'>Locales adheridos</div>
              </div>
              <div class='res-discount'>6 CSI</div>
            </div>
          </div>
        </div>
      </div>

      <div class='footer'>
        <div style='font-size: 28px; font-weight: 900; color: #0F172A; letter-spacing: -0.5px;'>
          promoar<span style='color: #F15A24;'>.com.ar</span>
        </div>
        <div class='cta-box'>Buscá tu beneficio gratis ↗</div>
      </div>
    </body>
    </html>
  `);
  await page.screenshot({ path: 'public/promoar_social_ig_light.png', type: 'png' });
  console.log('Saved public/promoar_social_ig_light.png');

  // 4. IMAGEN LIGHT THEME PARA X (1200x675)
  await page.setViewportSize({ width: 1200, height: 675 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='utf-8'>
      <link href='https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap' rel='stylesheet'>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        body {
          width: 1200px;
          height: 675px;
          background: #F8FAFC;
          color: #0F172A;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 60px 70px;
          position: relative;
          overflow: hidden;
        }
        .left-col {
          width: 520px;
          z-index: 10;
        }
        .logo-img {
          height: 48px;
          width: auto;
          display: block;
          margin-bottom: 24px;
        }
        .badge {
          display: inline-block;
          background: #EFF6FF;
          border: 1px solid #BFDBFE;
          color: #1D4ED8;
          padding: 6px 14px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 16px;
        }
        .title {
          font-size: 46px;
          font-weight: 900;
          line-height: 1.12;
          letter-spacing: -1px;
          margin-bottom: 18px;
          color: #0B192C;
        }
        .title span {
          color: #EA580C;
        }
        .subtitle {
          font-size: 17px;
          color: #475569;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .domain {
          font-size: 26px;
          font-weight: 900;
          color: #0F172A;
        }
        .domain span { color: #F15A24; }

        .right-col {
          width: 500px;
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 24px;
          padding: 26px;
          z-index: 10;
          box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.08);
        }
        .search-bar-mock {
          background: #F1F5F9;
          border: 1px solid #CBD5E1;
          border-radius: 14px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 16px;
          color: #64748B;
          margin-bottom: 18px;
        }
        .search-query { color: #0F172A; font-weight: 800; }
        .res-list { display: flex; flex-direction: column; gap: 10px; }
        .res-item {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .res-bank { font-size: 14px; font-weight: 800; color: #0F172A; }
        .res-commerce { font-size: 12px; color: #64748B; }
        .res-discount { font-size: 20px; font-weight: 900; color: #059669; }
      </style>
    </head>
    <body>
      <div class='left-col'>
        <img src='${logoSrc}' alt='PromoAR' class='logo-img' />
        <div class='badge'>Buscador de Descuentos 🇦🇷</div>
        <h1 class='title'>No pagues de más.<br>Buscá <span>antes de comprar</span>.</h1>
        <p class='subtitle'>Encontrá al instante qué banco, tarjeta o billetera virtual tiene reintegro hoy en indumentaria, tecnología, combustible y más.</p>
        <div class='domain'>promoar<span>.com.ar</span></div>
      </div>

      <div class='right-col'>
        <div class='search-bar-mock'>
          <span>🔍</span>
          <span>Buscando: <strong class='search-query'>'Zapatillas Nike'</strong></span>
        </div>
        <div class='res-list'>
          <div class='res-item'>
            <div>
              <div class='res-bank'>Banco Galicia</div>
              <div class='res-commerce'>Nike / Dexter · Todos los días</div>
            </div>
            <div class='res-discount'>-30%</div>
          </div>
          <div class='res-item'>
            <div>
              <div class='res-bank'>MODO + Banco Nación</div>
              <div class='res-commerce'>Comercios adheridos</div>
            </div>
            <div class='res-discount'>-25%</div>
          </div>
          <div class='res-item'>
            <div>
              <div class='res-bank'>Cuenta DNI</div>
              <div class='res-commerce'>Billetera digital</div>
            </div>
            <div class='res-discount'>-20%</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
  await page.screenshot({ path: 'public/promoar_social_x_light.png', type: 'png' });
  console.log('Saved public/promoar_social_x_light.png');

  await browser.close();
}

generateSocialAssets().catch(console.error);
