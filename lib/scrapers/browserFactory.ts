import { chromium, Browser } from 'playwright';

/**
 * Lanza una instancia de Playwright o se conecta a un Scraping Browser remoto
 * (BrightData / ZenRows CDP) si la variable de entorno está definida.
 * Esto permite evadir WAFs (Cloudflare, F5, etc.) cuando se ejecuta en Vercel,
 * mientras sigue usando el navegador local sin costo adicional en el entorno de desarrollo.
 */
export async function launchBrowser(options?: any): Promise<Browser> {
  const wsEndpoint = process.env.SCRAPING_BROWSER_WS;
  
  if (wsEndpoint) {
    console.log('[browserFactory] Conectando a Scraping Browser Remoto (Evasión WAF activada)...');
    try {
      return await chromium.connectOverCDP(wsEndpoint);
    } catch (error) {
      console.error('[browserFactory] Error conectando al Scraping Browser:', error);
      throw error;
    }
  }
  
  console.log('[browserFactory] Lanzando Playwright local...');
  return await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    ...options
  });
}
