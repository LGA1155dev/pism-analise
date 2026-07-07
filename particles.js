/**
 * particles.js
 * Sistema leve de partículas em Canvas 2D puro (sem bibliotecas), com
 * atração/repulsão suave ao mouse. Roda apenas dentro do hero e pausa
 * automaticamente quando a seção sai da viewport ou o usuário pede
 * movimento reduzido.
 */
import { clamp, randomBetween, prefersReducedMotion, observeInView, observeResize } from './utils.js';

const PARTICLE_COUNT_DESKTOP = 70;
const PARTICLE_COUNT_MOBILE = 28;
const LINK_DISTANCE = 120;
const MOUSE_RADIUS = 140;

export function initParticles(canvas) {
  const ctx = canvas.getContext('2d');
  const reducedMotion = prefersReducedMotion();

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let particles = [];
  let running = false;
  let rafId = null;

  const mouse = { x: -9999, y: -9999, active: false };

  function createParticles() {
    const count = window.matchMedia('(max-width: 700px)').matches
      ? PARTICLE_COUNT_MOBILE
      : PARTICLE_COUNT_DESKTOP;

    particles = Array.from({ length: count }, () => ({
      x: randomBetween(0, width),
      y: randomBetween(0, height),
      vx: randomBetween(-0.15, 0.15),
      vy: randomBetween(-0.15, 0.15),
      radius: randomBetween(1, 2.2)
    }));
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createParticles();
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      // Leve atração ao mouse quando próximo, para dar sensação de "vida"
      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS) {
          const force = (1 - dist / MOUSE_RADIUS) * 0.03;
          p.vx += (dx / (dist || 1)) * force;
          p.vy += (dy / (dist || 1)) * force;
        }
      }

      p.x += p.vx;
      p.y += p.vy;

      // Amortecimento para não acelerar infinitamente
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Wrap-around nas bordas
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(127, 217, 196, 0.55)';
      ctx.fill();
    }

    // Linhas conectando partículas próximas (efeito de "rede de dados")
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DISTANCE) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(127, 217, 196, ${0.12 * (1 - dist / LINK_DISTANCE)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    if (running) rafId = requestAnimationFrame(step);
  }

  function start() {
    if (running || reducedMotion) return;
    running = true;
    rafId = requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  }

  function onPointerLeave() {
    mouse.active = false;
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.parentElement.addEventListener('pointerleave', onPointerLeave);

  const stopResizeObserver = observeResize(canvas.parentElement, resize);

  // Só anima enquanto o hero estiver visível — economiza CPU/GPU no resto do scroll
  const stopInViewObserver = observeInView(canvas.parentElement, (visible) => {
    if (visible) start();
    else stop();
  });

  resize();
  if (!reducedMotion) {
    // Desenha um frame estático mesmo se reduced-motion estiver ativo
    step();
  }

  return {
    dispose() {
      stop();
      window.removeEventListener('pointermove', onPointerMove);
      canvas.parentElement.removeEventListener('pointerleave', onPointerLeave);
      stopResizeObserver();
      stopInViewObserver();
    }
  };
}
