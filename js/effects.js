/**
 * effects.js
 * Efeitos visuais de interação: spotlight que segue o mouse no hero
 * (também alimenta o parallax do modelo 3D via callback), tilt 3D nos
 * cards marcados com [data-tilt], ripple ao clicar em botões, e a
 * camada de ruído (grain) desenhada em canvas puro.
 */
import { clamp, isCoarsePointer, prefersReducedMotion } from './utils.js';

/**
 * Liga o spotlight do hero ao mouse e repassa a posição normalizada
 * (-1 → 1) para quem precisar (hero3d.js, via `onMouseMove`).
 */
export function initHeroSpotlight(heroEl, spotlightEl, onMouseMove) {
  function onMove(e) {
    const rect = heroEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    spotlightEl.style.setProperty('--spot-x', `${x}px`);
    spotlightEl.style.setProperty('--spot-y', `${y}px`);

    const nx = clamp((x / rect.width) * 2 - 1, -1, 1);
    const ny = clamp((y / rect.height) * 2 - 1, -1, 1);
    onMouseMove(nx, ny);
  }

  heroEl.addEventListener('pointermove', onMove);

  return () => heroEl.removeEventListener('pointermove', onMove);
}

/**
 * Aplica tilt 3D sutil (rotação em X/Y) nos elementos [data-tilt]
 * conforme a posição do mouse dentro de cada card.
 */
export function initTiltCards() {
  if (isCoarsePointer() || prefersReducedMotion()) return () => {};

  const cards = Array.from(document.querySelectorAll('[data-tilt]'));
  const cleanups = cards.map((card) => {
    function onMove(e) {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      const rotateX = clamp(py * -8, -8, 8);
      const rotateY = clamp(px * 8, -8, 8);
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    }
    function onLeave() {
      card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateY(0)';
    }
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    return () => {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerleave', onLeave);
    };
  });

  return () => cleanups.forEach((fn) => fn());
}

/** Cria um pequeno círculo de "ripple" no ponto do clique, dentro do botão. */
export function initRippleButtons() {
  const buttons = Array.from(document.querySelectorAll('.btn'));

  function onClick(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  buttons.forEach((btn) => btn.addEventListener('click', onClick));

  return () => buttons.forEach((btn) => btn.removeEventListener('click', onClick));
}

/**
 * Desenha uma camada de ruído (grain) estático em canvas, regenerada
 * ocasionalmente para dar uma textura sutil de "filme" sobre o site.
 */
export function initNoiseLayer(canvas) {
  const ctx = canvas.getContext('2d');
  const SIZE = 128; // textura pequena, repetida via CSS scaling implícito no full-bleed

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  }

  function draw() {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = SIZE;
    patternCanvas.height = SIZE;
    const pctx = patternCanvas.getContext('2d');
    const imageData = pctx.createImageData(SIZE, SIZE);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = Math.random() * 255;
      imageData.data[i] = value;
      imageData.data[i + 1] = value;
      imageData.data[i + 2] = value;
      imageData.data[i + 3] = 255;
    }
    pctx.putImageData(imageData, 0, 0);

    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Regenera o grain a cada ~200ms para um leve "flicker" de filme
  const interval = prefersReducedMotion() ? null : setInterval(draw, 200);

  window.addEventListener('resize', resize);
  resize();

  return () => {
    window.removeEventListener('resize', resize);
    if (interval) clearInterval(interval);
  };
}
