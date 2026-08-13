// ─────────────────────────────────────────────────────
// SCENE
// ─────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
const clock = new THREE.Clock();

let cameraPanStarted = false;

// Trigger pan animation after 2.3 seconds
setTimeout(() => {
  cameraPanStarted = true;
}, 2300);

const cubes = [];
const mouse = new THREE.Vector2(0, 0); // NDC mouse coordinates (-1 to +1)

// ─────────────────────────────────────────────────────
// DEVICE + CONTAINER
// ─────────────────────────────────────────────────────
const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const _sceneEl = document.getElementById('scene-container');

// ─────────────────────────────────────────────────────
// SCROLL ANIMATION
// ─────────────────────────────────────────────────────
const scrollAnim = {
  progress: 0,
  FROM:     { fov: 25, targetY: 18, radius: 80 },
  TO:       { fov: 20, targetY: 14.5, radius: 20 },
  PAN_DOWN: 10,
};

const lerp      = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

window.addEventListener('scroll', () => {
  scrollAnim.progress = Math.min(4, window.scrollY / window.innerHeight);
}, { passive: true });

// ─────────────────────────────────────────────────────
// INTERACTION STATE
// ─────────────────────────────────────────────────────
let mouseOnCanvas      = false;
let armature           = null;
let headBone           = null; // ← MUST BE HERE (Global Scope)
let isDragging         = false;
let dragStartX         = 0;
let armatureTargetRotZ = 0;

// LookAt Math Helpers (Reused to avoid garbage collection memory leaks)
const raycaster = new THREE.Raycaster();
const trackingPlane = new THREE.Plane();
const targetPosition = new THREE.Vector3();
const dummyHead = new THREE.Object3D();
const targetHeadQuaternion = new THREE.Quaternion();
const targetHeadEuler = new THREE.Euler(0, 0, 0, 'YXZ');

// ─────────────────────────────────────────────────────
// GYROSCOPE STATE
// ─────────────────────────────────────────────────────
let gyroEnabled         = false;
let gyroVerticalEnabled = false;
let gyroTargetTheta     = Math.PI * 1.14;
let gyroTargetPhi       = Math.PI / 1.5;

// ─────────────────────────────────────────────────────
// ANIMATION STATE
// ─────────────────────────────────────────────────────
let mixer         = null;
let idleAction    = null;
let hiAction      = null;
let pendingSwitch = false;

// ─────────────────────────────────────────────────────
// CAMERA
// ─────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(25, 1, 0.01, 1000);

// ─────────────────────────────────────────────────────
// RENDERER
// ─────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('scene'),
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding      = THREE.LinearEncoding;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;

// ─────────────────────────────────────────────────────
// POST PROCESSING
// ─────────────────────────────────────────────────────
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));

const bloom = new THREE.UnrealBloomPass(
  new THREE.Vector2(100, 100),
  0, 0.8, 0.1
);
composer.addPass(bloom);

const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
composer.addPass(fxaaPass);

// ─────────────────────────────────────────────────────
// RESIZE OBSERVER
// ─────────────────────────────────────────────────────
let _lastW = 0, _lastH = 0;

function applySize(w, h) {
  if (!w || !h) return;
  const pr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  composer.setSize(w, h);
  fxaaPass.material.uniforms['resolution'].value.set(1 / (w * pr), 1 / (h * pr));
  setResponsiveCamera();
}

const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const w = Math.floor(entry.contentRect.width);
    const h = Math.floor(entry.contentRect.height);
    if (w === _lastW && Math.abs(h - _lastH) < 150) return;
    _lastW = w; _lastH = h;
    applySize(w, h);
  }
});

if (_sceneEl) {
  resizeObserver.observe(_sceneEl);
} else {
  window.addEventListener('resize', () => applySize(window.innerWidth, window.innerHeight));
  applySize(window.innerWidth, window.innerHeight);
}

// ─────────────────────────────────────────────────────
// CAMERA CONTROLLER
// ─────────────────────────────────────────────────────
const cam = {
  target: new THREE.Vector3(0, 16, 0),
  radius: 80,
  theta:  Math.PI,
  phi:    Math.PI / 1.6,
  _r: 60, _t: Math.PI, _p: Math.PI / 30,
  FLOOR_Y: 0.5,
  shake: new THREE.Vector3(),
  vx: 0, vy: 0, tx: 0, ty: 0,
  SHAKE_STRENGTH: 0.003,
  SHAKE_DAMPING:  0.98,
  SMOOTH:         0.04,
};

function setResponsiveCamera() {
  const portrait = window.innerWidth < window.innerHeight;

  if (portrait) {
    camera.fov   = 60;
    cam.target.y = 30;
    cam.radius   = 60;
    cam.phi      = Math.PI;
    gyroTargetPhi = Math.PI;
  } else {
    camera.fov   = scrollAnim.FROM.fov;
    cam.target.y = scrollAnim.FROM.targetY;
    cam.radius   = scrollAnim.FROM.radius;
    cam.phi      = Math.PI / 1.6;
    gyroTargetPhi = Math.PI / 1.6;
  }

  camera.updateProjectionMatrix();
}

// ─────────────────────────────────────────────────────
// GYROSCOPE
// ─────────────────────────────────────────────────────
function handleGyro(e) {
  if (e.gamma !== null) {
    gyroTargetTheta = Math.PI + (e.gamma / 90) * 0.35;
  }
  if (gyroVerticalEnabled && e.beta !== null) {
    const deviation = e.beta - 90;
    const clamped   = Math.max(-45, Math.min(45, deviation)) / 45;
    const basePhi   = window.innerWidth < window.innerHeight ? Math.PI : Math.PI / 1.6;
    gyroTargetPhi   = basePhi + clamped * 0.3;
  }
}

function enableGyro() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(r => {
        if (r === 'granted') {
          window.addEventListener('deviceorientation', handleGyro);
          gyroEnabled = true;
        }
      }).catch(console.error);
  } else if ('DeviceOrientationEvent' in window) {
    window.addEventListener('deviceorientation', handleGyro);
    gyroEnabled = true;
  }
}

enableGyro();
renderer.domElement.addEventListener('touchstart', () => {
  if (!gyroEnabled) enableGyro();
}, { passive: true });

// ─────────────────────────────────────────────────────
// MOUSE EVENTS
// ─────────────────────────────────────────────────────
window.addEventListener('mousemove', (e) => {
  if (isMobile) return;

  if (isDragging && armature) {
    armatureTargetRotZ = (e.clientX - dragStartX) * 0.008;
  }

  // Update normalized mouse coordinates (-1 to +1) for 3D raycasting
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (mouseOnCanvas) {
    cam.vx  = e.clientX - cam.tx;
    cam.vy  = e.clientY - cam.ty;
    cam.tx  = e.clientX;
    cam.ty  = e.clientY;
  }
});

renderer.domElement.addEventListener('mouseenter', (e) => {
  mouseOnCanvas = true; cam.tx = e.clientX; cam.ty = e.clientY;
});
renderer.domElement.addEventListener('mouseleave', () => { mouseOnCanvas = false; });

renderer.domElement.addEventListener('mousedown', (e) => {
  isDragging = true; dragStartX = e.clientX;
});
window.addEventListener('mouseup', () => {
  isDragging = false; armatureTargetRotZ = 0;
});

renderer.domElement.addEventListener('click', () => {
  if (!hiAction || !idleAction || pendingSwitch) return;
  pendingSwitch = true;
});

// ─────────────────────────────────────────────────────
// CAMERA UPDATE
// ─────────────────────────────────────────────────────
function updateCamera() {
  if (!(window.innerWidth < window.innerHeight)) {
    const zoomT = easeInOut(Math.min(1, scrollAnim.progress));
    camera.fov = lerp(scrollAnim.FROM.fov,    scrollAnim.TO.fov,    zoomT);
    cam.radius = lerp(scrollAnim.FROM.radius, scrollAnim.TO.radius, zoomT);

    const revealT = Math.max(0, Math.min(1, (scrollAnim.progress - 1) / 3.3));
    const baseTarget = lerp(scrollAnim.FROM.targetY, scrollAnim.TO.targetY, zoomT);
    cam.target.y    = baseTarget - (easeInOut(revealT) * scrollAnim.PAN_DOWN);

    camera.updateProjectionMatrix();
  }

  const cosMax = (cam.FLOOR_Y - cam.target.y) / Math.max(cam.radius, 0.001);
  const phiMax = Math.acos(Math.max(-0.999, Math.min(0.999, cosMax)));
  cam.phi = Math.min(cam.phi, phiMax - 0.02);
  cam.phi = Math.max(0.08, cam.phi);
  cam._p  = Math.min(cam._p,  phiMax - 0.02);
  cam._p  = Math.max(0.08, cam._p);

  if (gyroEnabled && window.innerWidth < window.innerHeight) {
    cam.theta = gyroTargetTheta;
    if (gyroVerticalEnabled) {
      const safePhi = Math.min(Math.max(0.08, gyroTargetPhi), phiMax - 0.02);
      cam.phi = safePhi;
      cam._p  = safePhi;
    }
  }

  if (cameraPanStarted) {
    cam._r += (cam.radius - cam._r) * cam.SMOOTH;
    cam._t += (cam.theta  - cam._t) * cam.SMOOTH;
    cam._p += (cam.phi    - cam._p) * cam.SMOOTH;
  }

  const sp = Math.sin(cam._p), cp = Math.cos(cam._p);
  const st = Math.sin(cam._t), ct = Math.cos(cam._t);

  camera.position.set(
    cam.target.x + cam._r * sp * st,
    cam.target.y + cam._r * cp,
    cam.target.z + cam._r * sp * ct
  );

  cam.shake.x += cam.vx * cam.SHAKE_STRENGTH;
  cam.shake.y -= cam.vy * cam.SHAKE_STRENGTH;
  cam.shake.multiplyScalar(cam.SHAKE_DAMPING);
  cam.vx *= 0.80;
  cam.vy *= 0.80;

  camera.position.set(
    camera.position.x + cam.shake.x,
    camera.position.y + cam.shake.y,
    camera.position.z
  );

  camera.lookAt(cam.target);
  camera.position.y = Math.max(cam.FLOOR_Y, camera.position.y);
}

window.getCam = function () {
  const r = cam._r.toFixed(3), t = cam._t.toFixed(3), p = cam._p.toFixed(3);
  console.log(`\n📷 Paste into cam:\n──────────────────────────\ncam.radius = ${r};\ncam.theta  = ${t};\ncam.phi    = ${p};\ncam.target.set(${cam.target.x.toFixed(3)}, ${cam.target.y.toFixed(3)}, ${cam.target.z.toFixed(3)});\n──────────────────────────`);
};

// ─────────────────────────────────────────────────────
// MODEL LOADER
// ─────────────────────────────────────────────────────
const loader = new THREE.GLTFLoader();

loader.load(
  '../assets/models/Web_Hero_Concept.glb',
  (gltf) => {
    const model = gltf.scene;

    model.traverse((child) => {
      if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
    });

    scene.add(model);
    if (window.startDotgrid) window.startDotgrid();
    
    setResponsiveCamera();

    // 1. Get Main Armature
    armature = gltf.scene.getObjectByName('Armature002');
    
// Find Head Bone (Specifically mixamorigHead)
    headBone = null; // Reset
    
    model.traverse((child) => {
      // EXACT match for mixamorigHead (ignoring HeadTop_End)
      if (child.name === 'mixamorigHead') {
        headBone = child;
      }
    });

    if (!headBone) {
      console.warn('⚠️ mixamorigHead not matched! Searching for fallback...');
      model.traverse((child) => {
        if (child.name.includes('Head') && !child.name.includes('End')) {
          headBone = child;
        }
      });
    }

  
    // Cubes
    gltf.scene.traverse((child) => {
      if (child.isMesh && child.name.startsWith('Cube')) {
        child.userData.speed     = 0.02 + Math.random() * 0.08;
        child.userData.targetRot = 0;
        cubes.push(child);
      }
    });

    function randomizeCubes() {
      cubes.forEach(c => { c.userData.targetRot = (Math.random() - 0.5) * Math.PI * 4; });
    }
    randomizeCubes();
    setInterval(randomizeCubes, 5000);

    // Animations Setup
    if (gltf.animations.length) {

      // 🛑 CRITICAL FIX: Delete keyframe tracks belonging to Head Bone 
      // so AnimationMixer doesn't override dynamic cursor movement
      gltf.animations.forEach((clip) => {
        clip.tracks = clip.tracks.filter(
          (track) => !track.name.toLowerCase().includes('head')
        );
      });

      mixer = new THREE.AnimationMixer(model);

      const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Happy_Idle');
      const hiClip   = THREE.AnimationClip.findByName(gltf.animations, 'Hi_Action');

      if (idleClip) {
        idleAction = mixer.clipAction(idleClip);
        idleAction.loop = THREE.LoopRepeat;
        idleAction.play();
      }

      if (hiClip) {
        hiAction = mixer.clipAction(hiClip);
        hiAction.loop = THREE.LoopOnce;
        hiAction.clampWhenFinished = true;
      }

      mixer.addEventListener('loop', (e) => {
        if (e.action !== idleAction || !pendingSwitch || !hiAction) return;
        pendingSwitch = false;
        idleAction.fadeOut(0.2);
        hiAction.reset().fadeIn(0.2).play();
      });

      mixer.addEventListener('finished', (e) => {
        if (e.action !== hiAction || !idleAction) return;
        hiAction.fadeOut(0.2);
        idleAction.reset().fadeIn(0.2).play();
      });

    } else console.warn('No animations found');
  },
  (xhr) => { if (xhr.total > 0); },
  (err) => console.error('Load error:', err)
);

// ─────────────────────────────────────────────────────
// HEAD TRACKING FUNCTION (SMOOTH FULL-SCREEN NO-SNAP)
// ─────────────────────────────────────────────────────
function updateHeadTracking() {
  if (!headBone || isMobile) return;

  // 1. Define Maximum Rotation Angles in Radians
  const maxPitchUp   = THREE.MathUtils.degToRad(-35);   // Max angle looking UP
  const maxPitchDown = THREE.MathUtils.degToRad(25);  // Max angle looking DOWN
  const maxYawLeft   = THREE.MathUtils.degToRad(-75);   // Max angle looking LEFT
  const maxYawRight  = THREE.MathUtils.degToRad(75);  // Max angle looking RIGHT

  // 2. Map Normalized Mouse (-1 to +1) directly to target angles
  // mouse.y is +1 (top of screen) to -1 (bottom of screen)
  let targetPitchX = 0;
  if (mouse.y > 0) {
    targetPitchX = mouse.y * maxPitchUp;   // Move cursor up -> look up
  } else {
    targetPitchX = mouse.y * Math.abs(maxPitchDown); // Move cursor down -> look down
  }

  // mouse.x is -1 (left of screen) to +1 (right of screen)
  let targetYawY = mouse.x * maxYawLeft;   // Move cursor right/left -> look right/left

  // ── DIRECTION FLIP TUNING (If up/down or left/right is reversed) ──
  // targetPitchX = -targetPitchX; // Uncomment if UP/DOWN feels inverted
  // targetYawY   = -targetYawY;   // Uncomment if LEFT/RIGHT feels inverted

  // 3. Set Euler angles matching local bone layout (X: Pitch, Y: Yaw, Z: Roll)
  targetHeadEuler.set(targetPitchX, targetYawY, 0, 'XYZ');

  // 4. Convert Euler to Quaternion and smoothly interpolate bone
  targetHeadQuaternion.setFromEuler(targetHeadEuler);
  headBone.quaternion.slerp(targetHeadQuaternion, 0.08); // 0.08 = smoothness speed
}

// ─────────────────────────────────────────────────────
// RENDER LOOP
// ─────────────────────────────────────────────────────
function render() {
  requestAnimationFrame(render);

  const delta = clock.getDelta();

  // Step 1: Update idle/action animation mixer first
  if (mixer) mixer.update(delta);

  // Step 2: Apply head bone tracking second
  updateHeadTracking();

  updateCamera();

  if (armature) {
    armature.rotation.z += (armatureTargetRotZ - armature.rotation.z) * 0.02;
  }

  cubes.forEach((cube) => {
    const speed = cube.userData.speed;
    if (isMobile) {
      cube.rotation.z += (cube.userData.targetRot - cube.rotation.z) * speed;
    } else {
      cube.rotation.x += (mouse.x * Math.PI - cube.rotation.x) * speed;
      cube.rotation.y += (mouse.x * Math.PI - cube.rotation.y) * speed;
      cube.rotation.z += (mouse.x * Math.PI - cube.rotation.z) * speed;
    }
  });

  composer.render();
}

render();

// ─────────────────────────────────────────────────────
// SCROLL FADE CONFIG
// ─────────────────────────────────────────────────────
const FADES = [
  { selector: '.comment-split', inStart: 0,   inEnd: 0,   outStart: 0.5, outEnd: 0.5 },
  { selector: '.hero-intro',    inStart: 0.5, inEnd: 0.5, outStart: 2.0,  outEnd: 2.0 },
  { selector: '.hero-intro2',   inStart: 2.0, inEnd: 2.0, outStart: 3.5,  outEnd: 3.5 },
  { selector: '.hero-intro3',   inStart: 3.5, inEnd: 3.5, outStart: 6.0,  outEnd: 6.0 },
];

function calcOpacity(scrollY, vh, { inStart, inEnd, outStart, outEnd }) {
  const is = vh * inStart, ie = vh * inEnd;
  const os = vh * outStart, oe = vh * outEnd;

  if (scrollY < is)  return 0;
  if (scrollY >= oe) return 0;
  if (scrollY >= os) return 1 - Math.min(1, (scrollY - os) / (oe - os || 1));
  if (scrollY >= ie) return 1;
  return Math.min(1, (scrollY - is) / (ie - is || 1));
}

function updateAllFades() {
  const scrollY = window.scrollY;
  const vh      = window.innerHeight;

  FADES.forEach((item) => {
    const opacity = calcOpacity(scrollY, vh, item);
    document.querySelectorAll(item.selector).forEach(el => {
      el.style.opacity = opacity;
    });
  });
}

window.addEventListener('scroll', updateAllFades, { passive: true });
updateAllFades();

let hiTriggered = false;

window.addEventListener('scroll', () => {
  if (hiTriggered) return;
  if (window.scrollY < window.innerHeight * 0.5) return;

  if (hiAction && !hiAction.isRunning()) {
    pendingSwitch = true;
    hiTriggered = true;
  }
}, { passive: true });