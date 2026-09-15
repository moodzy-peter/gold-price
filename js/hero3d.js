/* ==========================================================================
   TAMAYA GOLD — Hero 3D Visual (Three.js via CDN)
   Renders a floating, slowly rotating gold bar + coin composition.
   Falls back to a CSS gradient object on touch devices or when WebGL/Three
   fails to initialize, so the hero never breaks.
   ========================================================================== */

const canvas = document.getElementById("hero-canvas");
const fallback = document.querySelector(".hero-visual-fallback");
const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
const isNarrowViewport = window.innerWidth < 768;

function showFallback() {
  if (canvas) canvas.style.display = "none";
  if (fallback) fallback.style.display = "block";
}

if (!canvas || isCoarsePointer || isNarrowViewport) {
  showFallback();
} else {
  init3D().catch(function (err) {
    console.warn("TAMAYA GOLD: 3D hero unavailable, using CSS fallback.", err);
    showFallback();
  });
}

/**
 * A small procedural "light tent" scene used only to generate a PMREM
 * environment map, so the metallic gold material has warm highlights to
 * reflect. Written inline (rather than importing three/examples'
 * RoomEnvironment) because that module bare-imports "three", which fails
 * without an import map when loaded straight from a CDN URL.
 */
function createStudioEnvironment(THREE) {
  const scene = new THREE.Scene();

  function panel(width, height, color, intensity, position, rotation) {
    const mat = new THREE.MeshBasicMaterial({ color: color });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.material.color.multiplyScalar(intensity);
    scene.add(mesh);
  }

  panel(6, 6, 0xfff1cf, 6, [0, 0, -4], [0, 0, 0]);
  panel(6, 6, 0xffe3ad, 3, [0, 0, 4], [0, Math.PI, 0]);
  panel(6, 6, 0xfff8e6, 4, [-4, 0, 0], [0, Math.PI / 2, 0]);
  panel(6, 6, 0x8a6b2e, 2, [4, 0, 0], [0, -Math.PI / 2, 0]);
  panel(6, 6, 0xffffff, 5, [0, 4, 0], [Math.PI / 2, 0, 0]);
  panel(6, 6, 0x2a2013, 1, [0, -4, 0], [-Math.PI / 2, 0, 0]);

  return scene;
}

async function init3D() {
  const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");

  if (!window.WebGLRenderingContext) throw new Error("WebGL unsupported");

  const container = canvas.parentElement;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(34, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 0.3, 8);

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  // Procedural studio environment so the metallic material has something
  // bright to reflect — a fully metallic PBR material looks near-black
  // without an environment map, no matter how strong the direct lights are.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(createStudioEnvironment(THREE), 0.04).texture;
  pmrem.dispose();

  // ---- Lighting ----
  scene.add(new THREE.AmbientLight(0xffe9b8, 0.7));

  const keyLight = new THREE.DirectionalLight(0xfff3d6, 2.6);
  keyLight.position.set(4, 6, 4);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xffcf7a, 1.1);
  rimLight.position.set(-5, -2, -3);
  scene.add(rimLight);

  const spot = new THREE.SpotLight(0xffe9b8, 1.8, 20, 0.5, 1);
  spot.position.set(0, 5, 3);
  scene.add(spot);

  // ---- Materials ----
  const goldMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd9b45c,
    metalness: 1,
    roughness: 0.22,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    reflectivity: 1,
  });
  const coinMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe8c565,
    metalness: 1,
    roughness: 0.24,
    clearcoat: 0.5,
    reflectivity: 1,
  });

  // ---- Gold bar (rounded box via bevelled geometry) ----
  function createBarGeometry() {
    const shape = new THREE.Shape();
    const w = 1.3,
      h = 0.55,
      r = 0.08;
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.75, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 8 });
  }

  const bar = new THREE.Mesh(createBarGeometry(), goldMaterial);
  bar.rotation.set(0.2, 0.55, -0.1);
  bar.castShadow = true;
  scene.add(bar);

  const coinGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.09, 64);
  const coin1 = new THREE.Mesh(coinGeo, coinMaterial);
  coin1.position.set(1.5, 1.15, 0.5);
  coin1.rotation.set(Math.PI / 2.3, 0.3, 0);
  coin1.castShadow = true;
  scene.add(coin1);

  const coin2 = new THREE.Mesh(coinGeo, coinMaterial);
  coin2.position.set(-1.7, -1, -0.4);
  coin2.rotation.set(Math.PI / 2.1, -0.4, 0.2);
  coin2.castShadow = true;
  scene.add(coin2);

  // ---- Fine particles ----
  const particleCount = 90;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({ color: 0xf4e3a8, size: 0.02, transparent: true, opacity: 0.55 });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // ---- Ground shadow catcher ----
  const shadowGeo = new THREE.PlaneGeometry(10, 10);
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.25 });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -1.4;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  let rafId;
  let resizeTimeout;
  const clock = new THREE.Clock();
  let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (!reduceMotion) {
      bar.rotation.y = 0.55 + t * 0.18;
      bar.position.y = Math.sin(t * 0.9) * 0.12;

      coin1.rotation.z = t * 0.6;
      coin1.position.y = 1.15 + Math.sin(t * 1.1 + 1) * 0.18;

      coin2.rotation.z = -t * 0.5;
      coin2.position.y = -1 + Math.sin(t * 1.3) * 0.18;

      particles.rotation.y = t * 0.02;
    }

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }, 120);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) cancelAnimationFrame(rafId);
    else animate();
  });
}
