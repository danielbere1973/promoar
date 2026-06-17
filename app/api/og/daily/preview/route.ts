export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pages = Math.min(parseInt(searchParams.get('pages') ?? '3'), 6)
  const n = Math.min(parseInt(searchParams.get('n') ?? '3'), 8)
  const interval = parseInt(searchParams.get('interval') ?? '4000')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PromoAR — Promos del día</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a1628;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: sans-serif;
      gap: 20px;
    }
    .slideshow {
      position: relative;
      width: min(540px, 95vw);
      aspect-ratio: 1;
    }
    .slide {
      position: absolute;
      inset: 0;
      opacity: 0;
      transition: opacity 0.6s ease-in-out;
    }
    .slide.active { opacity: 1; }
    .slide img {
      width: 100%;
      height: 100%;
      border-radius: 16px;
      display: block;
    }
    .dots {
      display: flex;
      gap: 10px;
    }
    .dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      cursor: pointer;
      transition: background 0.3s;
    }
    .dot.active { background: #D94F2B; }
    .controls {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    button {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      padding: 8px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover { background: rgba(255,255,255,0.2); }
    .page-label {
      color: rgba(255,255,255,0.5);
      font-size: 13px;
    }
    .progress {
      position: absolute;
      bottom: 0; left: 0;
      height: 3px;
      background: #D94F2B;
      border-radius: 0 0 16px 16px;
      animation: none;
    }
    @keyframes progress-bar {
      from { width: 0% }
      to { width: 100% }
    }
  </style>
</head>
<body>
  <div class="slideshow" id="slideshow">
    ${Array.from({ length: pages }, (_, i) => `
    <div class="slide${i === 0 ? ' active' : ''}" id="slide${i}">
      <img src="/api/og/daily?n=${n}&page=${i + 1}" alt="Promos día ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}">
      <div class="progress" id="progress${i}"></div>
    </div>`).join('')}
  </div>
  <div class="dots">
    ${Array.from({ length: pages }, (_, i) => `<div class="dot${i === 0 ? ' active' : ''}" onclick="goTo(${i})"></div>`).join('')}
  </div>
  <div class="controls">
    <button onclick="prev()">◀</button>
    <span class="page-label" id="label">1 / ${pages}</span>
    <button onclick="next()">▶</button>
    <button onclick="togglePause()" id="pauseBtn">⏸</button>
  </div>
  <div class="controls">
    ${Array.from({ length: pages }, (_, i) => `<a href="/api/og/daily?n=${n}&page=${i + 1}" download="promoar-dia-${i + 1}.png"><button>⬇ Slide ${i + 1}</button></a>`).join('')}
  </div>

  <script>
    const total = ${pages};
    const INTERVAL = ${interval};
    let current = 0;
    let paused = false;
    let timer = null;
    let progressAnim = null;

    function goTo(idx) {
      document.getElementById('slide' + current).classList.remove('active');
      document.querySelectorAll('.dot')[current].classList.remove('active');
      current = (idx + total) % total;
      document.getElementById('slide' + current).classList.add('active');
      document.querySelectorAll('.dot')[current].classList.add('active');
      document.getElementById('label').textContent = (current + 1) + ' / ' + total;
      startProgress();
    }

    function next() { goTo(current + 1); if (!paused) resetTimer(); }
    function prev() { goTo(current - 1); if (!paused) resetTimer(); }

    function startProgress() {
      const bar = document.getElementById('progress' + current);
      bar.style.animation = 'none';
      bar.offsetHeight; // reflow
      if (!paused) {
        bar.style.animation = 'progress-bar ' + INTERVAL + 'ms linear forwards';
      }
    }

    function resetTimer() {
      clearInterval(timer);
      timer = setInterval(() => goTo(current + 1), INTERVAL);
      startProgress();
    }

    function togglePause() {
      paused = !paused;
      document.getElementById('pauseBtn').textContent = paused ? '▶' : '⏸';
      if (paused) {
        clearInterval(timer);
        document.getElementById('progress' + current).style.animation = 'none';
      } else {
        resetTimer();
      }
    }

    resetTimer();
  </script>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
