import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildHelena } from './helena-model.js';

const host = document.querySelector('[data-model-view]');
const status = document.querySelector('[data-model-status]');
const productKey = new URLSearchParams(window.location.search).get('produto') || 'helena';
const productNames = { 'doce-amanhecer': 'Doce Amanhecer', 'com-todo-amor': 'Com Todo Amor', 'momento-especial': 'Momento Especial', personalizada: 'Monte do seu jeito', helena: 'Cesta Helena' };
const selectedProductName = productNames[productKey] || 'Cesta Helena';

try {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Modelo 3D da cesta. Arraste para girar, clique em um item para examiná-lo ou use os botões de câmera.');
  renderer.domElement.tabIndex = 0;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(35, 1, 0.05, 30);
  camera.position.set(4, 2.9, 6.7);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.85, 0);
  controls.minDistance = 0.65;
  controls.maxDistance = 10;
  controls.enableDamping = true;
  controls.enableZoom = false;
  controls.enablePan = false;
  // Full vertical orbit: the user can drag upward and downward around the basket.
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = Math.PI - 0.05;
  controls.update();
  controls.saveState();
  renderer.domElement.addEventListener('wheel', event => {
    const offset = camera.position.clone().sub(controls.target);
    const factor = Math.exp(Math.max(-240, Math.min(240, event.deltaY)) * 0.0012);
    offset.multiplyScalar(factor).clampLength(controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    // Passive listener: the same wheel gesture also scrolls the document downward.
  }, { passive: true });

  scene.add(new T.HemisphereLight('#fff4eb', '#997780', 1.8));
  const key = new T.DirectionalLight('#fff5e8', 3.2);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.001;
  scene.add(key);
  const fill = new T.DirectionalLight('#d7eefa', 1.15);
  fill.position.set(-4, 3, -3);
  scene.add(fill);

  const model = buildHelena();
  scene.add(model);
  const productHeading = document.querySelector('.demo-three-page aside h2');
  const productKicker = document.querySelector('.demo-three-page aside .kicker');
  if (productHeading) productHeading.textContent = `${selectedProductName} em 360°.`;
  if (productKicker) productKicker.textContent = selectedProductName;
  const homeCamera = new T.Vector3(4, 2.9, 6.7);
  const homeTarget = new T.Vector3(0, 1.85, 0);
  const homeTransforms = new Map(model.children.map(child => [child, { position: child.position.clone(), scale: child.scale.clone() }]));
  let motion = null;
  const ground = new T.Mesh(new T.CircleGeometry(2.3, 96), new T.MeshStandardMaterial({ color: '#e6d9ce', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  const observer = new ResizeObserver(() => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  observer.observe(host);
  let visible = true;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    if (motion) {
      const progress = Math.min(1, (performance.now() - motion.start) / motion.duration);
      const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      motion.update(eased);
      if (progress === 1) { const complete = motion.complete; motion = null; complete?.(); }
    }
    controls.update();
    renderer.render(scene, camera);
  });
  status.textContent = 'Arraste para qualquer direção • Use a roda do mouse para aproximar • Clique em um item para focar sem removê-lo.';
  host.dataset.ready = 'true';

  function animate(update, complete) { motion = { start: performance.now(), duration: 520, update, complete }; }
  function restoreBasket() {
    model.children.forEach(child => { child.visible = true; child.position.copy(homeTransforms.get(child).position); child.scale.copy(homeTransforms.get(child).scale); });
    controls.target.copy(homeTarget);
    camera.position.copy(homeCamera);
    controls.minDistance = 0.65;
    status.textContent = 'Cesta completa em 360°. Clique em um item para aproximar sem removê-lo.';
  }
  function focusPart(part) {
    if (!part) return;
    const bounds = new T.Box3().setFromObject(part);
    const sphere = bounds.getBoundingSphere(new T.Sphere());
    const center = sphere.center;
    const direction = center.clone().sub(new T.Vector3(0, 1.15, 0));
    if (direction.lengthSq() < 0.05) direction.set(0, 0.5, 1);
    direction.normalize();
    const focus = center.clone().addScaledVector(direction, 0.48);
    const distance = Math.max(1.05, sphere.radius * 3.2);
    const cameraDirection = camera.position.clone().sub(controls.target).normalize();
    const targetCamera = focus.clone().addScaledVector(cameraDirection, distance);
    const cameraStart = camera.position.clone(), targetStart = controls.target.clone();
    controls.minDistance = Math.max(0.35, sphere.radius * 0.65);
    controls.maxDistance = 10;
    status.textContent = `Aproximando ${part.userData.label || part.name}. Os itens continuam na cesta.`;
    animate(t => {
      camera.position.lerpVectors(cameraStart, targetCamera, t);
      controls.target.lerpVectors(targetStart, focus, t);
    }, () => { status.textContent = `${part.userData.label || part.name} em foco. Arraste para continuar girando a cesta.`; });
  }
  const returnButton = document.querySelector('[data-return-model]');
  if (returnButton) returnButton.addEventListener('click', restoreBasket);

  const fullscreenButton = document.querySelector('[data-fullscreen]');
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.querySelector('.demo-three-scene').requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {
      status.textContent = 'Tela cheia não está disponível neste navegador.';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreenButton.textContent = document.fullscreenElement ? '× Sair da tela cheia' : '⛶ Tela cheia';
    if (document.fullscreenElement) setTimeout(() => observer.observe(host), 50);
  });

  const dialog = document.querySelector('[data-card-dialog]');
  function showCard(type) {
    document.querySelector('[data-card-title]').textContent = type === 'brand' ? 'Ella Sorriu' : 'Uma cartinha para você';
    document.querySelector('[data-card-text]').textContent = type === 'brand'
      ? 'Flores · Presentes · Balões. Presentes personalizados em Mogi das Cruzes e região. Feitos com cuidado para transformar momentos em lembranças.'
      : 'Que a sua chegada seja cercada de carinho, delicadeza e muitos motivos para sorrir. Esta é uma mensagem de exemplo da demonstração.';
    dialog.showModal();
  }
  document.querySelector('[data-close-card]').addEventListener('click', () => dialog.close());

  const pointer = new T.Vector2();
  const ray = new T.Raycaster();
  let down;
  renderer.domElement.addEventListener('pointerdown', event => { down = [event.clientX, event.clientY]; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(model.children, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node && node !== model && !node.userData.separable && !node.userData.card) node = node.parent;
      if (node?.userData.separable) { focusPart(node); return; }
      if (node?.userData.card) { showCard(node.userData.card); return; }
    }
  });

  document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.camera === 'reset') { restoreBasket(); controls.reset(); return; }
    const offset = camera.position.clone().sub(controls.target);
    if (button.dataset.camera === 'in' || button.dataset.camera === 'out') offset.multiplyScalar(button.dataset.camera === 'in' ? 0.8 : 1.25);
    else offset.applyAxisAngle(new T.Vector3(0, 1, 0), button.dataset.camera === 'left' ? -0.4 : 0.4);
    offset.clampLength(controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }));

  document.querySelector('[data-export-model]').addEventListener('click', async function () {
    this.disabled = true;
    status.textContent = 'Preparando o arquivo 3D…';
    const previousVisibility = model.children.map(child => child.visible);
    const previousTransforms = model.children.map(child => ({ position: child.position.clone(), scale: child.scale.clone() }));
    try {
      model.children.forEach(child => { child.visible = true; child.position.copy(homeTransforms.get(child).position); child.scale.copy(homeTransforms.get(child).scale); });
      const binary = await new GLTFExporter().parseAsync(model, { binary: true });
      const url = URL.createObjectURL(new Blob([binary], { type: 'model/gltf-binary' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cesta-helena-aproximada.glb';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      status.textContent = 'Modelo exportado em arquivo GLB.';
    } catch (_) {
      status.textContent = 'Não foi possível exportar. Tente novamente.';
    } finally {
      model.children.forEach((child, index) => { child.visible = previousVisibility[index]; child.position.copy(previousTransforms[index].position); child.scale.copy(previousTransforms[index].scale); });
      this.disabled = false;
    }
  });

  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    controls.dispose();
    renderer.dispose();
  }, { once: true });
} catch (_) {
  status.textContent = 'A visualização 3D não está disponível neste navegador. A foto de referência continua disponível abaixo.';
  host.hidden = true;
  document.querySelector('[data-export-model]').disabled = true;
}
