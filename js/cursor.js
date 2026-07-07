/**
 * cursor.js
 * Cursor customizado (ponto + anel) que segue o mouse com suavização,
 * cresce sobre elementos interativos, e um efeito "magnético" que puxa
 * levemente botões/links marcados com [data-magnetic] em direção ao cursor.
 * Desativado inteiramente em dispositivos touch (ver components.css).
 */
import { lerp, isCoarsePointer, prefersReducedMotion } from './utils.js';

export function initCursor() {
  if (isCoarsePointer()) return { dispose() {} };

  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  const reducedMotion = prefersReducedMotion();

  const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const dotPos = { ...target };
  const ringPos = { ...target };

  let rafId = null;

  function onPointerMove(e) {
    target.x = e.clientX;
    target.y = e.clientY;
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  function applyTransform(el, pos) {
    el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
  }

  function loop() {
    // O ponto segue quase instantaneamente; o anel tem mais "atraso" (peso)
    dotPos.x = lerp(dotPos.x, target.x, 0.35);
    dotPos.y = lerp(dotPos.y, target.y, 0.35);
    ringPos.x = lerp(ringPos.x, target.x, 0.14);
    ringPos.y = lerp(ringPos.y, target.y, 0.14);

    applyTransform(dot, dotPos);
    applyTransform(ring, ringPos);

    rafId = requestAnimationFrame(loop);
  }

  if (reducedMotion) {
    // Sem loop contínuo: apenas posiciona diretamente a cada movimento
    window.addEventListener(
      'pointermove',
      (e) => {
        applyTransform(dot, { x: e.clientX, y: e.clientY });
        applyTransform(ring, { x: e.clientX, y: e.clientY });
      },
      { passive: true }
    );
  } else {
    rafId = requestAnimationFrame(loop);
  }

  // ---- Estado "ativo" do anel sobre elementos interativos ----
  const interactiveSelector = 'a, button, [data-magnetic], [data-tilt]';
  function onOver(e) {
    if (e.target.closest(interactiveSelector)) ring.classList.add('is-active');
  }
  function onOut(e) {
    if (e.target.closest(interactiveSelector)) ring.classList.remove('is-active');
  }
  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointerout', onOut);

  // ---- Botões / links magnéticos ----
  const magneticEls = Array.from(document.querySelectorAll('[data-magnetic]'));
  const magneticCleanups = magneticEls.map((el) => bindMagnetic(el, reducedMotion));

  function bindMagnetic(el, reduced) {
    let raf = null;
    const pos = { x: 0, y: 0 };
    const targetPos = { x: 0, y: 0 };

    function onMove(e) {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      targetPos.x = relX * 0.3;
      targetPos.y = relY * 0.3;
      if (reduced) {
        el.style.transform = `translate(${targetPos.x}px, ${targetPos.y}px)`;
      } else if (!raf) {
        raf = requestAnimationFrame(tick);
      }
    }

    function tick() {
      pos.x = lerp(pos.x, targetPos.x, 0.18);
      pos.y = lerp(pos.y, targetPos.y, 0.18);
      el.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

      if (Math.abs(pos.x - targetPos.x) > 0.1 || Math.abs(pos.y - targetPos.y) > 0.1) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
      }
    }

    function onLeave() {
      targetPos.x = 0;
      targetPos.y = 0;
      if (reduced) {
        el.style.transform = 'translate(0, 0)';
      } else if (!raf) {
        raf = requestAnimationFrame(tick);
      }
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }

  return {
    dispose() {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      magneticCleanups.forEach((fn) => fn());
    }
  };
}
