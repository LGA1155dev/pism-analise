/**
 * main.js
 * Ponto de entrada do site. Aguarda o loader terminar (fontes + modelo 3D
 * pré-carregados) e só então inicializa cursor, partículas, efeitos de
 * interação, a cena 3D do hero e as animações de scroll — nessa ordem,
 * para que tudo já exista quando as animações de entrada começarem.
 */
import { initLoader } from './loader.js';
import { Hero3D } from './hero3d.js';
import { initScroll } from './scroll.js';
import { initCursor } from './cursor.js';
import { initParticles } from './particles.js';
import {
  initHeroSpotlight,
  initTiltCards,
  initRippleButtons,
  initNoiseLayer
} from './effects.js';
import { debounce } from './utils.js';

/** Guarda as referências vivas para permitir cleanup caso necessário no futuro. */
const app = {
  hero3d: null,
  cursor: null,
  particles: null,
  cleanups: []
};

async function bootstrap() {
  // 1. Loader: aguarda fontes + modelo .glb (ou o timeout de segurança)
  await initLoader();

  // 2. Cursor customizado + botões magnéticos
  app.cursor = initCursor();

  // 3. Partículas do hero (canvas 2D puro)
  const particlesCanvas = document.getElementById('particlesCanvas');
  if (particlesCanvas) {
    app.particles = initParticles(particlesCanvas);
  }

  // 4. Camada de ruído (grain) sobre toda a página
  const noiseCanvas = document.getElementById('noiseCanvas');
  if (noiseCanvas) {
    app.cleanups.push(initNoiseLayer(noiseCanvas));
  }

  // 5. Cena 3D do hero (notebook.glb)
  const heroCanvas = document.getElementById('heroCanvas');
  if (heroCanvas && window.THREE) {
    app.hero3d = new Hero3D(heroCanvas);
  }

  // 6. Spotlight do hero — também alimenta o parallax de mouse do modelo 3D
  const heroSection = document.getElementById('hero');
  const spotlightEl = document.getElementById('heroSpotlight');
  if (heroSection && spotlightEl) {
    app.cleanups.push(
      initHeroSpotlight(heroSection, spotlightEl, (x, y) => {
        if (app.hero3d) app.hero3d.setMouse(x, y);
      })
    );
  }

  // 7. Tilt 3D nos cards + ripple nos botões
  app.cleanups.push(initTiltCards());
  app.cleanups.push(initRippleButtons());

  // 8. Scroll suave + todas as animações ligadas a scroll (GSAP/ScrollTrigger)
  initScroll({ hero3d: app.hero3d });

  // 9. Pequenos detalhes finais
  const footerYear = document.getElementById('footerYear');
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  // Reajusta o ScrollTrigger em resizes maiores (ex.: rotação de tela)
  window.addEventListener(
    'resize',
    debounce(() => {
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 200)
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
