# PISM Intelligence — Landing Page

Landing page premium (estilo Awwwards) para apresentar o painel Power BI do PISM.
Stack: **HTML5 + CSS3 + JavaScript puro (ES Modules)**, com Three.js, GSAP/ScrollTrigger e Lenis carregados via CDN.

## Estrutura

```
index.html
css/
  style.css        → tokens de design, layout, tipografia, responsividade
  components.css   → navbar, botões, cards, cursor, loader
  animations.css    → keyframes e estados iniciais de reveal
js/
  utils.js          → helpers (lerp, clamp, debounce, throttle, observers...)
  loader.js         → loader cinematográfico (preload de fontes + notebook.glb)
  particles.js      → partículas em canvas puro, com interação de mouse
  cursor.js         → cursor customizado + botões magnéticos
  effects.js        → spotlight do hero, tilt cards, ripple, camada de ruído
  hero3d.js         → cena Three.js do notebook 3D (GLTFLoader)
  scroll.js         → Lenis + GSAP ScrollTrigger (pin, scroll horizontal, split text, contadores...)
  main.js           → ponto de entrada, orquestra a ordem de inicialização
models/
  notebook.glb      → ⚠️ adicione aqui o seu modelo 3D (ver abaixo)
assets/             → imagens/ícones adicionais, se precisar
```

## Antes de rodar: adicione o modelo 3D

Este projeto **não inclui** o arquivo binário `notebook.glb` — ele precisa ser
colocado por você em `models/notebook.glb`. O código já está pronto para:

- Carregar o modelo via `THREE.GLTFLoader`.
- Centralizá-lo automaticamente (via `Box3`).
- Normalizar sua escala, não importa o tamanho original do modelo.
- Ativar sombra em todos os meshes.
- Rodar a animação de entrada (materialização) assim que o modelo carregar.

Se o arquivo não existir, o site continua funcionando normalmente (loader,
scroll, cards, etc.) — apenas o notebook não aparecerá na cena.

## Como rodar

Como o `index.html` usa ES Modules (`<script type="module">`) e `fetch()`,
ele precisa ser servido por um servidor local (não abra o arquivo direto com
`file://`). Duas opções simples:

```bash
# Python
python3 -m http.server 5500

# Node (sem instalar nada globalmente)
npx serve .
```

Depois acesse `http://localhost:5500` (ou a porta indicada).

## Bibliotecas usadas (via CDN, já referenciadas no index.html)

- Three.js r128 (`three.min.js`)
- GLTFLoader (addon oficial do Three.js, versão compatível com r128)
- GSAP 3.12.5 + ScrollTrigger
- Lenis 1.1.13 (smooth scroll)

## Notas de performance e acessibilidade

- Partículas e cursor customizado são desativados automaticamente em
  dispositivos touch e quando `prefers-reduced-motion: reduce` está ativo.
- O hero 3D e as partículas pausam quando saem da viewport (`IntersectionObserver`).
- `ResizeObserver` mantém o canvas do hero e das partículas sempre no tamanho correto.
- O loader tem um tempo limite de segurança (6s) para nunca travar o usuário
  numa tela preta caso algum asset falhe ao carregar.
