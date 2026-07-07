/**
 * hero3d.js
 * Centerpiece 3D do hero. Carrega ./models/notebook.glb via GLTFLoader,
 * centraliza e normaliza sua escala automaticamente, e orquestra luz
 * cinematográfica (ambient + directional + point + spot + light-sweep),
 * um "bloom falso" (sprite aditivo atrás do modelo), parallax de mouse,
 * animação de scroll e uma animação de entrada quando o modelo termina
 * de carregar.
 *
 * `this.gem` é `null` até o modelo carregar. Todo método que o utiliza
 * verifica `if (!this.gem) return;` antes de agir, então nunca há erro
 * de acesso a propriedade indefinida, mesmo que o scroll/mouse disparem
 * eventos antes do carregamento terminar.
 */
export class Hero3D {
  constructor(canvas) {
    this.canvas = canvas;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isMobile = window.matchMedia('(max-width: 700px)').matches;

    this.mouse = { x: 0, y: 0 };
    this.mouseTarget = { x: 0, y: 0 };
    this.scrollProgress = 0;

    this.gem = null; // preenchido quando o GLTF terminar de carregar
    this._baseScale = 1;
    this._entrancePlayed = false;

    this.clock = new THREE.Clock();
    this._raf = null;

    this._buildScene();
    this._bindEvents();
    this.resize();

    // Renderiza um frame imediatamente para não deixar o canvas em branco
    // enquanto o modelo ainda está sendo baixado.
    this.renderer.render(this.scene, this.camera);

    if (!this.reducedMotion) this._loop();
  }

  /** Monta renderer, câmera, luzes, sombra de contato e dispara o loader do modelo. */
  _buildScene() {
    // ---- Renderer ----
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isMobile,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    this.renderer = renderer;

    // ---- Cena e câmera ----
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 0.2, 6.4);
    this._baseCameraZ = 6.4;

    // ---- Iluminação cinematográfica ----
    // Ambient fria e discreta, só para as sombras não ficarem totalmente pretas
    this.ambient = new THREE.AmbientLight(0x2b2f31, 0.9);
    this.scene.add(this.ambient);

    // Key light: luz direcional principal, projeta sombra
    this.keyLight = new THREE.DirectionalLight(0xf5efe6, 1.7);
    this.keyLight.position.set(3, 4.5, 5);
    this.keyLight.castShadow = !this.isMobile;
    if (this.keyLight.castShadow) {
      this.keyLight.shadow.mapSize.set(1024, 1024);
      this.keyLight.shadow.radius = 6;
      this.keyLight.shadow.camera.near = 0.5;
      this.keyLight.shadow.camera.far = 20;
    }
    this.scene.add(this.keyLight);

    // Fill light: point light suave do lado oposto, simula um "HDR" barato
    this.fillLight = new THREE.PointLight(0xffffff, 0.6, 14, 2);
    this.fillLight.position.set(-4, 1, -2);
    this.scene.add(this.fillLight);

    // Rim / accent light (mint), contorna as bordas do notebook
    this.rimLight = new THREE.PointLight(0x7fd9c4, 6, 12, 2);
    this.rimLight.position.set(-3, 1.2, 2);
    this.scene.add(this.rimLight);

    // Spot light de cima, dá o "clarão" central de vitrine
    this.spotLight = new THREE.SpotLight(0xffffff, 1.2, 16, Math.PI / 7, 0.4, 1.4);
    this.spotLight.position.set(0, 5, 3);
    this.spotLight.target.position.set(0, 0, 0);
    this.spotLight.castShadow = !this.isMobile;
    this.scene.add(this.spotLight);
    this.scene.add(this.spotLight.target);

    // Light-sweep: percorre a superfície do modelo periodicamente
    this.sweepLight = new THREE.PointLight(0xffffff, 0, 8, 2);
    this.sweepLight.position.set(0, 0, 3);
    this.scene.add(this.sweepLight);

    // ---- "Bloom falso": sprite radial aditivo atrás do modelo ----
    this.glowSprite = this._createGlowSprite();
    this.glowSprite.position.set(0, 0, -1.2);
    this.scene.add(this.glowSprite);

    // ---- Sombra de contato (disco sutil sob o modelo) ----
    const shadowGeo = new THREE.CircleGeometry(2.1, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = -1.9;
    this.contactShadow.receiveShadow = true;
    this.scene.add(this.contactShadow);

    this.baseRotation = { x: 0.35, y: -0.55 };

    // ---- Environment map simples ----
    // Materiais PBR (padrão em exports glTF/Blender) ficam pretos sem luz
    // ambiente refletida. Gera um "estúdio" de gradiente rápido via
    // PMREMGenerator só para dar reflexo/luz ambiente ao modelo — sem isso,
    // é a causa nº1 de "o modelo carregou mas não aparece".
    this._applyEnvironment();

    this._loadModel();
  }

  /** Gera e aplica um environment map de gradiente simples (sem HDRI externo). */
  _applyEnvironment() {
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(20, 32, 32);
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 2;
    envCanvas.height = 256;
    const ctx = envCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#3a3a3a');
    gradient.addColorStop(0.5, '#151515');
    gradient.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);

    const envTexture = new THREE.CanvasTexture(envCanvas);
    const envMat = new THREE.MeshBasicMaterial({ map: envTexture, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(envGeo, envMat));

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environment = envMap;
    pmrem.dispose();
  }

  /** Gera uma sprite radial (canvas gerado em runtime) usada como "glow" atrás do modelo. */
  _createGlowSprite() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(127, 217, 196, 0.55)');
    gradient.addColorStop(1, 'rgba(127, 217, 196, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(6, 6, 1);
    return sprite;
  }

  /**
   * Carrega ./models/notebook.glb, centraliza via Box3, normaliza a escala,
   * ativa sombras em todos os meshes e só então atribui `this.gem`.
   */
  _loadModel() {
    const loader = new THREE.GLTFLoader();

    loader.load(
      './models/macbook.glb',
      (gltf) => {
        const model = gltf.scene;
        let meshCount = 0;

        model.traverse((child) => {
          if (child.isMesh) {
            meshCount++;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // ---- Diagnóstico ----
        // Se o modelo carregou mas não tem nenhum mesh, ou o mesh não tem
        // material, algo está errado no arquivo em si (não no código).
        if (meshCount === 0) {
          console.warn(
            '[Hero3D] O notebook.glb carregou, mas não contém nenhum mesh visível ' +
              '(gltf.scene.children está vazio de meshes). Verifique se o arquivo ' +
              'exportado realmente contém geometria, ou se é um ponteiro do Git LFS.'
          );
        }

        // Centraliza o modelo na origem
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.y -= center.y;
        model.position.z -= center.z;

        // Normaliza a escala para caber num "palco" consistente
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z) || 1;
        const targetSize = 2.4;
        this._baseScale = targetSize / maxDimension;

        console.info(
          `[Hero3D] notebook.glb carregado: ${meshCount} mesh(es), ` +
            `bounding box = ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}, ` +
            `escala aplicada = ${this._baseScale.toFixed(4)}`
        );

        if (!isFinite(maxDimension) || maxDimension === 0) {
          console.warn(
            '[Hero3D] Bounding box inválida (tamanho zero ou infinito). O modelo ' +
              'pode não ter geometria real, ou todas as coordenadas estão em (0,0,0).'
          );
        }

        model.rotation.x = this.baseRotation.x;
        model.rotation.y = this.baseRotation.y;

        // Começa "colapsado" para a animação de entrada
        model.scale.setScalar(0.001);

        this.scene.add(model);
        this.gem = model;

        this._playEntrance();
      },
      undefined,
      (error) => {
        console.error(
          '[Hero3D] Falha ao carregar ./models/notebook.glb — verifique se o ' +
            'caminho está correto, se o servidor local está rodando, e se o ' +
            'arquivo é realmente um .glb binário válido (não um ponteiro de ' +
            'Git LFS nem um .gltf separado sem os arquivos .bin/texturas).',
          error
        );
        this._showFallbackPlaceholder();
      }
    );
  }

  /**
   * Mostra um cubo de aresta visível (wireframe) no lugar do modelo caso o
   * carregamento falhe — assim fica claro que a cena 3D está funcionando e
   * o problema é especificamente no arquivo .glb, não no restante do código.
   */
  _showFallbackPlaceholder() {
    const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const material = new THREE.MeshBasicMaterial({
      color: 0x7fd9c4,
      wireframe: true
    });
    this.gem = new THREE.Mesh(geometry, material);
    this.gem.rotation.x = this.baseRotation.x;
    this.gem.rotation.y = this.baseRotation.y;
    this._baseScale = 1;
    this.scene.add(this.gem);
    this._playEntrance();
  }

  /** Animação de entrada: o notebook "materializa" com escala e leve giro. */
  _playEntrance() {
    if (this._entrancePlayed || !this.gem) return;
    this._entrancePlayed = true;

    if (window.gsap) {
      window.gsap.to(this.gem.scale, {
        x: this._baseScale,
        y: this._baseScale,
        z: this._baseScale,
        duration: 1.4,
        ease: 'power3.out'
      });
      window.gsap.from(this.gem.rotation, {
        y: this.baseRotation.y - Math.PI * 0.6,
        duration: 1.6,
        ease: 'power3.out'
      });
      window.gsap.to(this.rimLight, {
        intensity: 6,
        duration: 1.2,
        ease: 'power2.out'
      });
    } else {
      // Fallback sem GSAP: aplica a escala final diretamente
      this.gem.scale.setScalar(this._baseScale);
    }
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    if (this.reducedMotion) this.renderer.render(this.scene, this.camera);
  }

  /** Chamado pelo scroll.js com o progresso 0→1 do hero fixado (pinned). */
  setScrollProgress(p) {
    this.scrollProgress = p;
    if (this.reducedMotion) this._applyScroll();
  }

  /** Chamado pelo effects.js com a posição normalizada do mouse (-1 → 1). */
  setMouse(x, y) {
    this.mouseTarget.x = x;
    this.mouseTarget.y = y;
    if (this.reducedMotion) this._applyMouseImmediate();
  }

  /** Dolly de câmera, rotação e leve aumento de escala conforme o scroll. */
  _applyScroll() {
    const p = this.scrollProgress;

    this.camera.position.z = this._baseCameraZ - p * 2.6;

    if (!this.gem) return;

    this.gem.rotation.y = this.baseRotation.y + p * Math.PI * 1.6;
    this.gem.rotation.x = this.baseRotation.x + p * 0.5;
    this.gem.position.y = Math.sin(p * Math.PI) * 0.35;

    const scaleFactor = 1 + p * 0.18;
    this.gem.scale.setScalar(this._baseScale * scaleFactor);

    this.contactShadow.material.opacity = 0.28 * (1 - p * 0.4);
  }

  /** Aplica o parallax de mouse instantaneamente (usado em reduced-motion). */
  _applyMouseImmediate() {
    this.camera.position.x = this.mouseTarget.x * 0.3;
    this.camera.position.y = 0.2 - this.mouseTarget.y * 0.2;
    this.camera.lookAt(0, 0, 0);

    if (!this.gem) return;
    this.gem.rotation.y += this.mouseTarget.x * 0.15;
    this.gem.rotation.x += this.mouseTarget.y * 0.1;
  }

  /** Loop principal: interpola mouse, reaplica scroll, idle e luz de varredura. */
  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    const t = this.clock.getElapsedTime();

    this.mouse.x += (this.mouseTarget.x - this.mouse.x) * 0.06;
    this.mouse.y += (this.mouseTarget.y - this.mouse.y) * 0.06;

    this._applyScroll();

    if (this.gem) {
      this.gem.rotation.y += this.mouse.x * 0.15;
      this.gem.rotation.x += this.mouse.y * 0.1;
      this.gem.rotation.z = Math.sin(t * 0.2) * 0.03; // vida sutil no idle
      // Flutuação (floating) suave sobreposta ao deslocamento do scroll
      this.gem.position.y += Math.sin(t * 0.8) * 0.004;
    }

    this.glowSprite.material.opacity = 0.7 + Math.sin(t * 0.6) * 0.15;

    this.camera.position.x += (this.mouse.x * 0.3 - this.camera.position.x) * 0.08;
    this.camera.position.y += ((0.2 - this.mouse.y * 0.2) - this.camera.position.y) * 0.08;
    this.camera.lookAt(0, 0, 0);

    // Light-sweep: percorre a cena a cada ~7s, com fade in/out
    const sweepCycle = (t % 7) / 7;
    const sweepAngle = sweepCycle * Math.PI * 2;
    this.sweepLight.position.set(Math.cos(sweepAngle) * 3, Math.sin(sweepAngle) * 2, 2.5);
    this.sweepLight.intensity = Math.max(0, Math.sin(sweepCycle * Math.PI)) * 5;

    this.renderer.render(this.scene, this.camera);
  }

  /** Libera recursos. Percorre os meshes do GLTF (não há geometry única). */
  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);

    if (this.gem) {
      this.gem.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat) => {
              Object.keys(mat).forEach((key) => {
                const value = mat[key];
                if (value && value.isTexture) value.dispose();
              });
              mat.dispose();
            });
          }
        }
      });
    }

    if (this.glowSprite) {
      this.glowSprite.material.map.dispose();
      this.glowSprite.material.dispose();
    }

    if (this.contactShadow) {
      this.contactShadow.geometry.dispose();
      this.contactShadow.material.dispose();
    }

    this.renderer.dispose();
  }
}