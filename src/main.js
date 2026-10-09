import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const EYE = 1.6;
const RADIUS = 0.24;
const STEP = 0.42;
const WALK = 2.5;
const RUN = 5.2;

const overlay = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const crosshair = document.getElementById("crosshair");
const hint = document.getElementById("hint");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.06, 120);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
document.body.prepend(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.4;
pmrem.dispose();

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.object);

const keys = {};
const raycaster = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);

let sceneData = null;
let colliders = [];
let ready = false;
let verticalVelocity = 0;

const exhibition = {
  drive: false,
  camera,
  controls,
  get ready() {
    return ready;
  },
  teleport(x, y, z) {
    camera.position.set(x, y, z);
    verticalVelocity = 0;
  },
  lookAt(x, y, z) {
    lookToward([x, y, z]);
  },
  goToCamera(name) {
    const cam = sceneData?.cameras?.find((item) => item.name === name);
    if (!cam) return false;
    camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
    lookToward(cam.lookAt);
    verticalVelocity = 0;
    return true;
  },
  position() {
    return camera.position.toArray();
  },
};
exhibition.renderer = renderer;
exhibition.scene = scene;
window.__exhibition = exhibition;

overlay.addEventListener("click", () => {
  if (ready) controls.lock();
});

controls.addEventListener("lock", () => {
  overlay.classList.add("hidden");
  crosshair.classList.add("visible");
  hint.classList.add("visible");
});

controls.addEventListener("unlock", () => {
  overlay.classList.remove("hidden");
  crosshair.classList.remove("visible");
  hint.classList.remove("visible");
  if (ready) statusEl.textContent = "Click to continue walking.";
});

document.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  if (event.code.startsWith("Arrow")) event.preventDefault();
});

document.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

window.addEventListener("blur", () => {
  for (const code of Object.keys(keys)) keys[code] = false;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function lookToward(target) {
  const dir = new THREE.Vector3(target[0], target[1], target[2]).sub(camera.position);
  if (dir.lengthSq() < 1e-8) return;
  dir.normalize();
  const pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
  const yaw = Math.atan2(-dir.x, -dir.z);
  camera.rotation.set(pitch, yaw, 0);
}

function addLights(data) {
  const world = data.world;
  const sky = new THREE.Color(world.color[0], world.color[1], world.color[2]);
  scene.background = sky;
  scene.add(new THREE.HemisphereLight(sky, new THREE.Color(0.32, 0.22, 0.14), 1.15));

  const sun = new THREE.DirectionalLight(0xfff6ea, 1.35);
  sun.position.set(18, 24, 10);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xd7e4f4, 0.42);
  fill.position.set(-10, 14, -8);
  scene.add(fill);
}

function isCollider(obj, data) {
  if (!obj.isMesh) return false;
  const collection = obj.userData?.elchk_collection || "";
  if ((data.skipCollisionCollections || []).includes(collection)) return false;
  const name = obj.name.toLowerCase();
  return !(data.skipCollisionNameIncludes || []).some((part) => name.includes(part));
}

function worldNormal(hit) {
  return hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
}

function isClimbable(hit, feetY) {
  const normal = worldNormal(hit);
  if (normal.y > 0.55) return true;
  const flat = new THREE.Vector3(normal.x, 0, normal.z);
  if (flat.lengthSq() < 1e-6) return false;
  flat.normalize();
  const probe = hit.point.clone().addScaledVector(flat, -0.12);
  probe.y = feetY + 1.15;
  raycaster.set(probe, down);
  raycaster.far = 1.4;
  const landed = raycaster.intersectObjects(colliders, false);
  for (const item of landed) {
    if (worldNormal(item).y <= 0.55) continue;
    const rise = item.point.y - feetY;
    return rise > -0.08 && rise <= STEP;
  }
  return false;
}

function movementBlocked(position, dx, dz) {
  const len = Math.hypot(dx, dz);
  if (len < 1e-8) return false;
  const dir = new THREE.Vector3(dx / len, 0, dz / len);
  const feetY = position.y - EYE;
  const heights = [position.y - 1.05, position.y - 0.4];
  for (const height of heights) {
    raycaster.set(new THREE.Vector3(position.x, height, position.z), dir);
    raycaster.far = len + RADIUS;
    const hits = raycaster.intersectObjects(colliders, false);
    if (!hits.length) continue;
    const hit = hits[0];
    if (hit.distance <= len + RADIUS * 0.85 && !isClimbable(hit, feetY)) return true;
  }
  return false;
}

function tryStep(dx, dz) {
  const pos = camera.position;
  if (!movementBlocked(pos, dx, dz)) {
    pos.x += dx;
    pos.z += dz;
    return;
  }
  if (dx !== 0 && !movementBlocked(pos, dx, 0)) pos.x += dx;
  if (dz !== 0 && !movementBlocked(pos, 0, dz)) pos.z += dz;
}

function updateVertical(dt) {
  const pos = camera.position;
  raycaster.set(new THREE.Vector3(pos.x, pos.y + 0.05, pos.z), down);
  raycaster.far = 8;
  const hits = raycaster.intersectObjects(colliders, false);
  let ground = null;
  for (const hit of hits) {
    if (hit.distance < 0.02) continue;
    if (worldNormal(hit).y > 0.45) {
      ground = hit.point.y;
      break;
    }
  }

  if (ground == null) {
    verticalVelocity -= 9.8 * dt;
    pos.y += verticalVelocity * dt;
    if (pos.y < -6 && sceneData) {
      const spawn = sceneData.spawn.position;
      pos.set(spawn[0], spawn[1], spawn[2]);
      verticalVelocity = 0;
    }
    return;
  }

  const target = ground + EYE;
  const drop = pos.y - target;
  if (drop <= STEP) {
    pos.y = target;
    verticalVelocity = 0;
  } else {
    verticalVelocity -= 9.8 * dt;
    pos.y += verticalVelocity * dt;
    if (pos.y < target) {
      pos.y = target;
      verticalVelocity = 0;
    }
  }
}

function movePlayer(dt) {
  if (!controls.isLocked && !exhibition.drive) return;
  const running = keys.ShiftLeft || keys.ShiftRight;
  let forward = 0;
  let strafe = 0;
  if (keys.KeyW || keys.ArrowUp) forward += 1;
  if (keys.KeyS || keys.ArrowDown) forward -= 1;
  if (keys.KeyD || keys.ArrowRight) strafe += 1;
  if (keys.KeyA || keys.ArrowLeft) strafe -= 1;

  if (forward !== 0 || strafe !== 0) {
    const length = Math.hypot(forward, strafe);
    forward /= length;
    strafe /= length;
    const speed = (running ? RUN : WALK) * dt;
    camera.updateMatrix();
    const before = camera.position.clone();
    if (forward) controls.moveForward(forward * speed);
    if (strafe) controls.moveRight(strafe * speed);
    const dx = camera.position.x - before.x;
    const dz = camera.position.z - before.z;
    camera.position.copy(before);
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
    for (let i = 0; i < steps; i += 1) tryStep(dx / steps, dz / steps);
    updateVertical(dt);
  } else if (verticalVelocity !== 0) {
    updateVertical(dt);
  }
}

function glazingFamily(name) {
  return name
    .toLowerCase()
    .replace(/[\s./]+/g, "_")
    .replace(/\d+$/g, "")
    .replace(/_?(glass|mullion|rail|handle|lintel|lettering).*$/i, "")
    .replace(/_+$/g, "");
}

function seatGlazingOnFloor(root) {
  const families = new Map();
  const box = new THREE.Box3();
  root.traverse((obj) => {
    if (!obj.isMesh || obj.userData.elchk_collection !== "02 Glazing and doors") return;
    box.setFromObject(obj);
    const height = box.max.y - box.min.y;
    const family = glazingFamily(obj.name);
    const group = families.get(family) || { meshes: [], drop: null };
    group.meshes.push(obj);
    if (height > 1.5 && box.min.y > 0.005 && box.min.y < 0.3) {
      group.drop = group.drop == null ? box.min.y : Math.min(group.drop, box.min.y);
    }
    families.set(family, group);
  });

  for (const group of families.values()) {
    if (group.drop == null) continue;
    for (const mesh of group.meshes) {
      const world = new THREE.Vector3();
      mesh.getWorldPosition(world);
      world.y -= group.drop;
      if (mesh.parent) mesh.parent.worldToLocal(world);
      mesh.position.copy(world);
    }
  }
  root.updateMatrixWorld(true);
}

function simplifyMaterials(root) {
  const seen = new Set();
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of materials) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      if (mat.transmission > 0) {
        mat.transmission = 0;
        mat.thickness = 0;
        mat.transparent = true;
        mat.opacity = 0.42;
        mat.depthWrite = false;
        mat.metalness = 0;
      }
      mat.envMapIntensity = Math.min(mat.envMapIntensity ?? 1, 0.3);
    }
  });
}

function isWalkBlocker(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const dims = [size.x, size.y, size.z].sort((a, b) => b - a);
  return dims[0] > 0.4 && dims[1] > 0.15;
}

function reinforceEmissive(root, data) {
  const byName = new Map((data.emissive || []).map((item) => [item.material, item]));
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of materials) {
      if (!mat) continue;
      const spec = byName.get(mat.name);
      if (spec && mat.emissiveIntensity < spec.strength * 0.5) {
        mat.emissive.setRGB(spec.color[0], spec.color[1], spec.color[2]);
        mat.emissiveIntensity = spec.strength;
      }
    }
  });
}

async function loadExhibition() {
  const loader = new GLTFLoader();
  const [data, gltf] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}models/scene.json`).then((response) => {
      if (!response.ok) throw new Error(`scene.json ${response.status}`);
      return response.json();
    }),
    new Promise((resolve, reject) => {
      loader.load(
        `${import.meta.env.BASE_URL}models/exhibition.glb`,
        resolve,
        (event) => {
          if (event.total) {
            statusEl.textContent = `Loading the gallery… ${Math.round((100 * event.loaded) / event.total)}%`;
          }
        },
        reject
      );
    }),
  ]);

  sceneData = data;
  addLights(data);
  scene.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  seatGlazingOnFloor(gltf.scene);
  simplifyMaterials(gltf.scene);
  reinforceEmissive(gltf.scene, data);
  gltf.scene.traverse((obj) => {
    obj.matrixAutoUpdate = false;
  });
  gltf.scene.updateMatrixWorld(true);
  colliders = [];
  gltf.scene.traverse((obj) => {
    if (isCollider(obj, data) && isWalkBlocker(obj)) colliders.push(obj);
  });

  const spawn = data.spawn;
  camera.position.set(spawn.position[0], spawn.position[1], spawn.position[2]);
  lookToward(spawn.lookAt);
  const ahead = new THREE.Vector3();
  camera.getWorldDirection(ahead);
  ahead.y = 0;
  if (ahead.lengthSq() > 1e-6) {
    ahead.normalize();
    // Camera 02 sits in the south glazing. Step into the room so the first view is open.
    camera.position.addScaledVector(ahead, 1.55);
  }
  updateVertical(0.016);
  ready = true;
  statusEl.textContent = "Click to enter the gallery.";
  console.info(
    `Exhibition ready: ${colliders.length} colliders, ${data.lights.length} area lights, spawn ${spawn.name}`
  );
}

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (document.hidden) return;
  if (ready) movePlayer(dt);
  renderer.render(scene, camera);
});

loadExhibition().catch((error) => {
  console.error(error);
  statusEl.textContent = "The gallery model could not be loaded.";
});
