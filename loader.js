/**
 * loader.js
 * Loader cinematográfico: acompanha o carregamento real das fontes e do
 * modelo 3D (notebook.glb), anima uma porcentagem suavizada e só revela o
 * site quando tudo estiver pronto (ou após um tempo limite de segurança,
 * para nunca travar o usuário numa tela preta caso um asset falhe).
 */
import { clamp, lerp } from './utils.js';

const SAFETY_TIMEOUT_MS = 6000; // nunca prende o usuário além disso
const STATUS_MESSAGES = [
  'carregando ativos',
  'preparando o modelo 3D',
  'sincronizando indicadores',
  'quase lá'
];

export function initLoader() {
  const loaderEl = document.getElementById('loader');
  const barFillEl = document.getElementById('loaderBarFill');
  const percentEl = document.getElementById('loaderPercent');
  const statusEl = document.getElementById('loaderStatus');

  let realProgress = 0; // 0 → 1, progresso "de verdade" das tarefas
  let displayedProgress = 0; // 0 → 1, progresso suavizado mostrado na tela
  let rafId = null;
  let statusIndex = 0;

  document.body.classList.add('is-loading');

  // Alterna a mensagem de status periodicamente para dar sensação de processo
  const statusInterval = setInterval(() => {
    statusIndex = (statusIndex + 1) % STATUS_MESSAGES.length;
    statusEl.textContent = STATUS_MESSAGES[statusIndex];
  }, 900);

  /** Anima `displayedProgress` em direção a `realProgress` a cada frame. */
  function tick() {
    displayedProgress = lerp(displayedProgress, realProgress, 0.08);
    const shown = clamp(Math.round(displayedProgress * 100), 0, 100);
    barFillEl.style.width = `${shown}%`;
    percentEl.textContent = `${shown}%`;

    if (shown < 100) {
      rafId = requestAnimationFrame(tick);
    }
  }
  tick();

  /** Tarefa 1: espera as fontes web carregarem. */
  const fontsTask = (document.fonts && document.fonts.ready
    ? document.fonts.ready
    : Promise.resolve()
  ).catch(() => {});

  /**
   * Tarefa 2: baixa o notebook.glb via fetch, medindo bytes reais quando o
   * servidor informa `content-length`. Se falhar (arquivo ainda não existe,
   * CORS, etc.), resolve mesmo assim para não travar o loader — o
   * hero3d.js fará seu próprio carregamento via GLTFLoader depois.
   */
  const modelTask = fetch('/models/macbook.glb')
    .then((res) => {
      if (!res.body || !res.ok) return;
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body.getReader();
      let received = 0;

      function pump() {
        return reader.read().then(({ done, value }) => {
          if (done) return;
          received += value.length;
          if (total > 0) {
            modelProgress = clamp(received / total, 0, 1);
            recomputeProgress();
          }
          return pump();
        });
      }
      return pump();
    })
    .catch(() => {});

  let fontsProgress = 0;
  let modelProgress = 0;

  fontsTask.then(() => {
    fontsProgress = 1;
    recomputeProgress();
  });

  /** Combina o progresso das duas tarefas com pesos (o modelo pesa mais). */
  function recomputeProgress() {
    realProgress = fontsProgress * 0.25 + modelProgress * 0.75;
    if (!rafId) tick();
  }

  return new Promise((resolve) => {
    let settled = false;

    function finish() {
      if (settled) return;
      settled = true;
      clearInterval(statusInterval);
      realProgress = 1;

      // Garante que a barra chegue visualmente a 100% antes de sumir
      const finalizeInterval = setInterval(() => {
        displayedProgress = lerp(displayedProgress, 1, 0.2);
        const shown = clamp(Math.round(displayedProgress * 100), 0, 100);
        barFillEl.style.width = `${shown}%`;
        percentEl.textContent = `${shown}%`;

        if (shown >= 100) {
          clearInterval(finalizeInterval);
          statusEl.textContent = 'pronto';
          playExitTransition();
        }
      }, 16);
    }

    function playExitTransition() {
      // Usa GSAP se disponível (carregado via CDN no index.html);
      // cai para um fade simples via CSS caso não esteja.
      if (window.gsap) {
        window.gsap.to(loaderEl, {
          opacity: 0,
          duration: 0.6,
          delay: 0.2,
          ease: 'power2.out',
          onComplete: () => {
            loaderEl.style.display = 'none';
            document.body.classList.remove('is-loading');
            resolve();
          }
        });
      } else {
        loaderEl.style.transition = 'opacity 0.6s ease';
        loaderEl.style.opacity = '0';
        setTimeout(() => {
          loaderEl.style.display = 'none';
          document.body.classList.remove('is-loading');
          resolve();
        }, 650);
      }
    }

    Promise.all([fontsTask, modelTask]).then(finish);

    // Rede de segurança: nunca deixa o usuário preso no loader
    setTimeout(finish, SAFETY_TIMEOUT_MS);
  });
}
