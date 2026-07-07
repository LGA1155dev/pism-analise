/**
 * utils.js
 * Funções puras e helpers de baixo nível, sem estado próprio,
 * usadas por todos os outros módulos do site.
 */

/** Interpolação linear entre `a` e `b`, com fator `t` (0 → 1). */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Limita `value` entre `min` e `max`. */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Remapeia `value` de um intervalo [inMin, inMax] para [outMin, outMax]. */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

/** Retorna uma versão "debounced" de `fn`: só executa após `delay` ms de silêncio. */
export function debounce(fn, delay = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Retorna uma versão "throttled" de `fn`: executa no máximo 1x a cada `limit` ms. */
export function throttle(fn, limit = 100) {
  let waiting = false;
  return (...args) => {
    if (waiting) return;
    fn(...args);
    waiting = true;
    setTimeout(() => (waiting = false), limit);
  };
}

/** true se o dispositivo é considerado "mobile" pela largura da viewport. */
export function isMobile() {
  return window.matchMedia('(max-width: 700px)').matches;
}

/** true se o usuário pediu para reduzir animações no sistema operacional. */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** true se o dispositivo não tem hover fino (touch), usado para desativar cursor/tilt. */
export function isCoarsePointer() {
  return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

/**
 * Observa o redimensionamento de um elemento e chama `callback(entry)`.
 * Encapsula o ResizeObserver nativo para uso simples e com cleanup fácil.
 */
export function observeResize(element, callback) {
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) callback(entry);
  });
  ro.observe(element);
  return () => ro.disconnect();
}

/**
 * Observa a entrada/saída de um elemento na viewport e chama `callback(isVisible, entry)`.
 * Usado para pausar trabalho custoso (partículas, render 3D) fora de tela.
 */
export function observeInView(element, callback, options = { threshold: 0.1 }) {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) callback(entry.isIntersecting, entry);
  }, options);
  io.observe(element);
  return () => io.disconnect();
}

/** Gera um número pseudoaleatório entre min e max. */
export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
