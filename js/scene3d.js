/* ==========================================================================
   PISM Intelligence — scene3d.js
   Módulo isolado e carregado sob demanda (ver main.js -> initScene3DLazyLoad).

   COMO COLOCAR SEU PRÓPRIO ELEMENTO 3D:
   1. Coloque seu arquivo .glb (ou .gltf + texturas) dentro da pasta /models/
   2. Ajuste a constante MODEL_PATH abaixo com o nome do arquivo
   3. Se preferir, ajuste MODEL_SCALE e MODEL_Y para enquadrar o modelo

   Enquanto nenhum modelo é encontrado, uma rede de nós procedural
   (placeholder) é exibida no lugar, para que a seção nunca fique vazia.
   ========================================================================== */

const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.module.js';
const GLTF_LOADER_CDN = 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

const MODEL_PATH = '../models/model.glb';
const MODEL_SCALE = 2;
const MODEL_Y = 0;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function initScene3D(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const stage = canvas.closest('.scene3d__stage');
  const spinner = document.createElement('div');
  spinner.className = 'scene3d__spinner';
  stage?.appendChild(spinner);

  const THREE = await import(THREE_CDN);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.4, 4.2);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  // Iluminação básica (necessária caso um modelo com materiais PBR seja carregado)
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0x9fb4ff, 1.1);
  key.position.set(3, 4, 2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x4ef2c0, 0.6);
  rim.position.set(-3, -1, -2);
  scene.add(rim);

  let subject = buildPlaceholderNetwork(THREE);
  scene.add(subject);

  // Tenta carregar um modelo real do usuário; se não existir, mantém o placeholder
  try {
    const { GLTFLoader } = await import(GLTF_LOADER_CDN);
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(MODEL_PATH);
    scene.remove(subject);
    subject = gltf.scene;
    subject.scale.setScalar(MODEL_SCALE);
    subject.position.y = MODEL_Y;
    scene.add(subject);
  } catch (err) {
    // Sem modelo ainda — segue com o placeholder procedural. Isso é esperado
    // até que um arquivo seja colocado em /models/.
  }

  spinner.remove();

  /* ----- Responsividade do canvas ----- */
  function resize() {
    const rect = stage.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();

  /* ----- Parallax suave com o mouse (desktop) / estático em mobile ----- */
  let targetRotX = 0, targetRotY = 0;
  stage.addEventListener('pointermove', (e) => {
    const rect = stage.getBoundingClientRect();
    targetRotY = ((e.clientX - rect.left) / rect.width - 0.5) * 0.6;
    targetRotX = ((e.clientY - rect.top) / rect.height - 0.5) * 0.4;
  });

  /* ----- Loop de renderização, pausado fora de tela ----- */
  let running = true;
  let frame = null;

  function animate() {
    if (!running) return;
    if (!prefersReducedMotion) {
      subject.rotation.y += 0.0028;
      subject.rotation.x += (targetRotX - subject.rotation.x) * 0.04;
      subject.rotation.y += (targetRotY * 0.5);
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }
  animate();

  new IntersectionObserver((entries) => {
    running = entries[0].isIntersecting;
    if (running && !frame) animate();
  }, { threshold: 0 }).observe(stage);

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running && !frame) animate();
  });
}

/* ---------------------------------------------------------------------- */
/* PLACEHOLDER PROCEDURAL — rede de nós conectados (tema: dados cruzados) */
/* ---------------------------------------------------------------------- */
function buildPlaceholderNetwork(THREE) {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x0d1420,
      emissive: 0x4ef2c0,
      emissiveIntensity: 0.25,
      metalness: 0.3,
      roughness: 0.35,
      wireframe: false,
    })
  );
  group.add(core);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.02, 1),
    new THREE.MeshBasicMaterial({ color: 0x4ef2c0, wireframe: true, transparent: true, opacity: 0.5 })
  );
  group.add(wire);

  // Nós orbitando representando fontes de dados dispersas convergindo ao centro
  const nodeGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const nodeMat = new THREE.MeshStandardMaterial({ color: 0x6c8cff, emissive: 0x6c8cff, emissiveIntensity: 0.6 });
  const linkMat = new THREE.LineBasicMaterial({ color: 0x6c8cff, transparent: true, opacity: 0.35 });

  const nodeCount = 10;
  for (let i = 0; i < nodeCount; i++) {
    const phi = Math.acos(-1 + (2 * i) / nodeCount);
    const theta = Math.sqrt(nodeCount * Math.PI) * phi;
    const radius = 1.9;
    const pos = new THREE.Vector3(
      radius * Math.cos(theta) * Math.sin(phi),
      radius * Math.sin(theta) * Math.sin(phi),
      radius * Math.cos(phi)
    );
    const node = new THREE.Mesh(nodeGeo, nodeMat);
    node.position.copy(pos);
    group.add(node);

    const points = [pos, new THREE.Vector3(0, 0, 0)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    group.add(new THREE.Line(lineGeo, linkMat));
  }

  return group;
}