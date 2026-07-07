/**
 * scroll.js
 * Orquestra o scroll suave (Lenis) e todas as animações ligadas a scroll
 * (GSAP + ScrollTrigger): pin do hero, scroll horizontal do painel,
 * split text (palavras/caracteres), desenho de SVG, contadores, reveals
 * em cascata e a timeline de entrada da página.
 */
import { clamp, prefersReducedMotion } from './utils.js';

let lenisInstance = null;

/** Quebra o texto de um elemento em <span class="word"> por palavra. */
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words
    .map((w) => `<span class="word">${w}</span>`)
    .join(' ');
  return Array.from(el.querySelectorAll('.word'));
}

/** Quebra o texto de um elemento em <span class="char"> por caractere. */
function splitChars(el) {
  const text = el.textContent.trim();
  el.innerHTML = Array.from(text)
    .map((c) => `<span class="char">${c === ' ' ? '&nbsp;' : c}</span>`)
    .join('');
  return Array.from(el.querySelectorAll('.char'));
}

export function initScroll({ hero3d } = {}) {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const reducedMotion = prefersReducedMotion();

  gsap.registerPlugin(ScrollTrigger);

  // ---- Scroll suave (Lenis) sincronizado com o ticker do GSAP ----
  if (!reducedMotion && window.Lenis) {
    lenisInstance = new window.Lenis({
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 1
    });
    lenisInstance.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenisInstance.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // ---- Prepara o split text de todos os elementos marcados ----
  document.querySelectorAll('[data-split-words]').forEach(splitWords);
  document.querySelectorAll('[data-split-chars]').forEach(splitChars);

  _setupIntroTimeline(gsap);
  _setupHeroPin(gsap, ScrollTrigger, hero3d);
  _setupIntroStatementReveal(gsap, ScrollTrigger);
  _setupHorizontalShowcase(gsap, ScrollTrigger);
  _setupSvgDraw(gsap, ScrollTrigger);
  _setupCounters(gsap, ScrollTrigger);
  _setupGenericReveals(gsap, ScrollTrigger);

  ScrollTrigger.refresh();
}

/** Timeline de entrada: navbar, eyebrow, título e ações do hero, na carga da página. */
function _setupIntroTimeline(gsap) {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.to('[data-reveal="nav"]', { opacity: 1, y: 0, duration: 0.7 })
    .to('.eyebrow .char', { opacity: 1, y: 0, duration: 0.4, stagger: 0.015 }, '-=0.4')
    .to('.hero__title-line .word', { opacity: 1, y: 0, duration: 0.8, stagger: 0.08 }, '-=0.2')
    .to('.hero__lead[data-reveal="fade-up"]', { opacity: 1, y: 0, duration: 0.7 }, '-=0.4')
    .to('.hero__actions[data-reveal="fade-up"]', { opacity: 1, y: 0, duration: 0.7 }, '-=0.5');
}

/** Pina o hero em tela cheia e repassa o progresso do scroll ao Hero3D. */
function _setupHeroPin(gsap, ScrollTrigger, hero3d) {
  ScrollTrigger.create({
    trigger: '.hero',
    start: 'top top',
    end: '+=100%',
    pin: true,
    scrub: true,
    onUpdate: (self) => {
      if (hero3d) hero3d.setScrollProgress(self.progress);
    }
  });
}

/**
 * Realça palavra por palavra do parágrafo de "problema" conforme o
 * usuário rola por dentro da seção — clássico efeito de leitura guiada.
 */
function _setupIntroStatementReveal(gsap, ScrollTrigger) {
  const words = document.querySelectorAll('.intro__statement .word');
  if (!words.length) return;

  gsap.set(words, { opacity: 0.25, y: 0 });

  ScrollTrigger.create({
    trigger: '.intro',
    start: 'top 70%',
    end: 'bottom 40%',
    scrub: true,
    onUpdate: (self) => {
      const activeCount = Math.floor(self.progress * words.length);
      words.forEach((word, i) => {
        gsap.to(word, {
          opacity: i <= activeCount ? 1 : 0.25,
          duration: 0.3,
          overwrite: 'auto'
        });
      });
    }
  });
}

/** Transforma a vitrine de cards em um scroll horizontal pinado. */
function _setupHorizontalShowcase(gsap, ScrollTrigger) {
  const section = document.querySelector('.showcase');
  const track = document.getElementById('showcaseTrack');
  if (!section || !track) return;

  function getScrollDistance() {
    return Math.max(track.scrollWidth - window.innerWidth, 0);
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${getScrollDistance()}`,
    pin: true,
    scrub: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      gsap.set(track, { x: -self.progress * getScrollDistance() });
    }
  });

  // Cascata de entrada dos cards assim que a seção chega na tela
  gsap.from('.showcase-card', {
    opacity: 0,
    y: 40,
    duration: 0.8,
    stagger: 0.12,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: section,
      start: 'top 80%'
    }
  });
}

/** Anima o "desenho" dos mini-gráficos SVG de cada card conforme entram na tela. */
function _setupSvgDraw(gsap, ScrollTrigger) {
  document.querySelectorAll('.draw-svg path').forEach((path) => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = length;
    path.style.strokeDashoffset = length;

    gsap.to(path, {
      strokeDashoffset: 0,
      duration: 1.4,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: path,
        start: 'top 85%',
        toggleActions: 'play none none reverse'
      }
    });
  });
}

/** Anima os contadores numéricos da seção de métricas quando entram na tela. */
function _setupCounters(gsap, ScrollTrigger) {
  document.querySelectorAll('[data-counter]').forEach((el) => {
    const target = parseFloat(el.dataset.target || '0');
    const suffix = el.dataset.suffix || '';
    const proxy = { value: 0 };

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(proxy, {
          value: target,
          duration: 1.6,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = `${Math.round(proxy.value)}${suffix}`;
          }
        });
      }
    });
  });
}

/** Reveals genéricos (fade-up, scale-in, split-words de títulos de seção). */
function _setupGenericReveals(gsap, ScrollTrigger) {
  // Elementos de fade-up fora do hero (os do hero já são tratados pela
  // timeline de entrada em `_setupIntroTimeline`, então ficam de fora aqui).
  const fadeUpTargets = Array.from(document.querySelectorAll('[data-reveal="fade-up"]')).filter(
    (el) => !el.closest('.hero')
  );

  if (fadeUpTargets.length) {
    ScrollTrigger.batch(fadeUpTargets, {
      start: 'top 85%',
      onEnter: (batch) =>
        gsap.to(batch, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' })
    });
  }

  ScrollTrigger.batch('[data-reveal="scale-in"]', {
    start: 'top 88%',
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, scale: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out' })
  });

  // Títulos de seção com split-words fora do hero
  document.querySelectorAll('.section-title[data-split-words], .cta__title[data-split-words]').forEach((title) => {
    gsap.to(title.querySelectorAll('.word'), {
      opacity: 1,
      y: 0,
      duration: 0.7,
      stagger: 0.06,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: title,
        start: 'top 85%'
      }
    });
  });
}

export function getLenis() {
  return lenisInstance;
}
