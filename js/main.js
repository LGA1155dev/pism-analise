/* ==========================================================================
   PISM Intelligence — main.js
   Vanilla JS, sem dependências pesadas. Tudo que não é essencial ao
   primeiro paint é adiado ou carregado sob demanda (ver scene3d.js).
   ========================================================================== */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------------------------------------------------------------------- */
/* LOADER                                                                  */
/* ---------------------------------------------------------------------- */
function initLoader() {
  const loader = document.getElementById('loader');
  const fill = document.getElementById('loaderBarFill');
  const percent = document.getElementById('loaderPercent');
  const status = document.getElementById('loaderStatus');
  if (!loader) return;

  const messages = ['carregando ativos', 'sincronizando indicadores', 'montando painel'];
  let progress = 0;
  let msgIndex = 0;

  const tick = () => {
    progress = Math.min(100, progress + Math.random() * 18);
    fill.style.width = progress + '%';
    percent.textContent = Math.floor(progress) + '%';
    if (progress > (msgIndex + 1) * 33 && msgIndex < messages.length - 1) {
      msgIndex += 1;
      status.textContent = messages[msgIndex];
    }
    if (progress < 100) {
      requestAnimationFrame(() => setTimeout(tick, 60));
    } else {
      status.textContent = 'pronto';
      setTimeout(() => {
        loader.classList.add('is-hidden');
        document.body.style.overflow = '';
      }, 250);
    }
  };

  document.body.style.overflow = 'hidden';
  tick();

  // Failsafe: nunca deixa o loader travado por mais de 3.5s
  setTimeout(() => loader.classList.add('is-hidden'), 3500);
}

/* ---------------------------------------------------------------------- */
/* CURSOR PERSONALIZADO (apenas desktop com ponteiro fino)                */
/* ---------------------------------------------------------------------- */
function initCursor() {
  if (isTouch || prefersReducedMotion) return;
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (!dot || !ring) return;

  let ringX = 0, ringY = 0, mouseX = 0, mouseY = 0;

  window.addEventListener('pointermove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
  });

  const magneticEls = document.querySelectorAll('[data-magnetic]');
  magneticEls.forEach((el) => {
    el.addEventListener('mouseenter', () => ring.classList.add('is-active'));
    el.addEventListener('mouseleave', () => ring.classList.remove('is-active'));
  });

  const animateRing = () => {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
    requestAnimationFrame(animateRing);
  };
  animateRing();
}

/* ---------------------------------------------------------------------- */
/* MAGNETIC BUTTONS (leve deslocamento ao aproximar o mouse)               */
/* ---------------------------------------------------------------------- */
function initMagnetic() {
  if (isTouch || prefersReducedMotion) return;
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${x * 0.18}px, ${y * 0.3}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

/* ---------------------------------------------------------------------- */
/* TILT SUAVE NOS CARDS DO PAINEL                                         */
/* ---------------------------------------------------------------------- */
function initTilt() {
  if (isTouch || prefersReducedMotion) return;
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(700px) rotateX(${py * -6}deg) rotateY(${px * 6}deg)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

/* ---------------------------------------------------------------------- */
/* SPLIT DE TEXTO (palavras/caracteres) COM REVELAÇÃO                      */
/* ---------------------------------------------------------------------- */
function splitText(el, unit) {
  const text = el.textContent;
  const parts = unit === 'chars' ? [...text] : text.split(/(\s+)/);
  el.textContent = '';
  parts.forEach((part) => {
    if (part.trim() === '') {
      el.append(part);
      return;
    }
    const span = document.createElement('span');
    span.className = 'split-unit';
    span.textContent = part;
    el.append(span);
  });
}

function initSplitText() {
  document.querySelectorAll('[data-split-words]').forEach((el) => splitText(el, 'words'));
  document.querySelectorAll('[data-split-chars]').forEach((el) => splitText(el, 'chars'));
}

/* ---------------------------------------------------------------------- */
/* REVELAÇÃO POR SCROLL (IntersectionObserver único para tudo)             */
/* ---------------------------------------------------------------------- */
function initReveal() {
  const targets = document.querySelectorAll(
    '[data-reveal], .metrics__grid, .features__grid, .process__list, .showcase-card, .split-unit'
  );

  if (prefersReducedMotion) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

  targets.forEach((el) => observer.observe(el));
}

/* ---------------------------------------------------------------------- */
/* CONTADORES NUMÉRICOS                                                    */
/* ---------------------------------------------------------------------- */
function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const animateCounter = (el) => {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      el.textContent = (Number.isInteger(target) ? Math.floor(value) : value.toFixed(1)).toString().replace('.', ',') + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if (prefersReducedMotion) {
    counters.forEach((el) => {
      el.textContent = el.dataset.target.replace('.', ',') + (el.dataset.suffix || '');
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });

  counters.forEach((el) => observer.observe(el));
}

/* ---------------------------------------------------------------------- */
/* CANVAS DE PARTÍCULAS LEVE (hero) — pausa fora de tela / reduced motion  */
/* ---------------------------------------------------------------------- */
function initParticles() {
  const canvas = document.getElementById('particlesCanvas');
  if (!canvas || prefersReducedMotion) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  let width, height, particles;
  let rafId = null;
  let running = false;

  const COUNT_DESKTOP = 70;
  const COUNT_MOBILE = 28;

  function resize() {
    width = canvas.width = canvas.offsetWidth * devicePixelRatio;
    height = canvas.height = canvas.offsetHeight * devicePixelRatio;
  }

  function makeParticles() {
    const count = window.innerWidth < 700 ? COUNT_MOBILE : COUNT_DESKTOP;
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      a: Math.random() * 0.5 + 0.15,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(78, 242, 192, 1)';
    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
      ctx.globalAlpha = p.a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (running) rafId = requestAnimationFrame(draw);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(draw);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  resize();
  makeParticles();
  start();

  window.addEventListener('resize', () => { resize(); makeParticles(); }, { passive: true });

  // Pausa a animação quando o hero sai da viewport (economia de CPU/bateria)
  const hero = document.getElementById('hero');
  if (hero) {
    new IntersectionObserver((entries) => {
      entries[0].isIntersecting ? start() : stop();
    }, { threshold: 0 }).observe(hero);
  }

  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : (hero && hero.getBoundingClientRect().top < innerHeight ? start() : null);
  });
}

/* ---------------------------------------------------------------------- */
/* CARREGAMENTO SOB DEMANDA DA CENA 3D                                     */
/* Só importa Three.js quando a seção #visualizacao3d se aproxima da tela  */
/* ---------------------------------------------------------------------- */
function initScene3DLazyLoad() {
  const section = document.getElementById('visualizacao3d');
  if (!section) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        import('./scene3d.js')
          .then((mod) => mod.initScene3D('scene3dCanvas'))
          .catch((err) => console.warn('Cena 3D não pôde ser iniciada:', err));
      }
    });
  }, { rootMargin: '600px 0px' });

  observer.observe(section);
}

/* ---------------------------------------------------------------------- */
/* RODAPÉ — ANO ATUAL                                                      */
/* ---------------------------------------------------------------------- */
function initFooterYear() {
  const el = document.getElementById('footerYear');
  if (el) el.textContent = new Date().getFullYear();
}

/* ---------------------------------------------------------------------- */
/* BOOT                                                                    */
/* ---------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initLoader();
  initSplitText();
  initReveal();
  initCounters();
  initCursor();
  initMagnetic();
  initTilt();
  initParticles();
  initScene3DLazyLoad();
  initFooterYear();
});