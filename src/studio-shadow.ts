import * as THREE from "three";
import type { StudioRenderSettings } from "./render-settings.js";
import {
  STUDIO_ILLUSTRATIVE_ONLY_KEY,
  STUDIO_SEMANTIC_ROLE_KEY,
} from "./user-data.js";

function contactBounds(model: THREE.Object3D) {
  model.updateWorldMatrix(true, true);
  const inverse = model.matrixWorld.clone().invert();
  const parts: { mesh: THREE.Mesh; matrix: THREE.Matrix4; body: boolean }[] = [];
  model.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    let part: THREE.Object3D | null = object;
    let body = false;
    while (part) {
      if (part.userData[STUDIO_ILLUSTRATIVE_ONLY_KEY] === true) return;
      if (part.userData[STUDIO_SEMANTIC_ROLE_KEY] === "body") body = true;
      if (part === model) break;
      part = part.parent;
    }
    if (!object.geometry.getAttribute("position")) return;
    parts.push({
      mesh: object,
      matrix: new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld),
      body,
    });
  });
  const meshes = parts.some((part) => part.body)
    ? parts.filter((part) => part.body)
    : parts;
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const { mesh, matrix } of meshes) {
    for (let i = 0; i < mesh.geometry.getAttribute("position").count; i++) {
      bounds.expandByPoint(mesh.getVertexPosition(i, point).applyMatrix4(matrix));
    }
  }
  if (bounds.isEmpty()) return bounds;
  const floor = bounds.min.y;
  const band = Math.max((bounds.max.y - floor) * 0.03, 0.0001);
  const base = new THREE.Box3();
  for (const { mesh, matrix } of meshes) {
    for (let i = 0; i < mesh.geometry.getAttribute("position").count; i++) {
      mesh.getVertexPosition(i, point).applyMatrix4(matrix);
      if (point.y <= floor + band) base.expandByPoint(point);
    }
  }
  return base.max.x > base.min.x && base.max.z > base.min.z ? base : bounds;
}

/**
 * Handle of an approximate studio contact shadow.
 */
export type StudioContactShadow = {
  object: THREE.Group;
  update: (settings?: StudioRenderSettings | null) => void;
  fit: () => void;
  dispose: () => void;
};

/**
 * Creates an approximate contact shadow under a standing model. The shadow
 * uses two triangles and a 64 KiB texture instead of a shadow map or an
 * additional render pass. The shadow object stays outside the model, so
 * camera fitting, picking and material edits ignore it.
 *
 * Pass `rectangular` for models with a rectangular footprint, such as
 * organizers. The function returns `null` when the model has no usable
 * footprint.
 */
export function createStudioContactShadow(
  model: THREE.Object3D,
  rectangular = false,
): StudioContactShadow | null {
  const bounds = contactBounds(model);
  if (bounds.isEmpty()) return null;
  const size = bounds.getSize(new THREE.Vector3());
  if (size.x <= 0 || size.z <= 0) return null;
  const center = bounds.getCenter(new THREE.Vector3());
  let padding = Math.min(size.x, size.z) * 0.3;
  let width = size.x + padding * 2;
  let depth = size.z + padding * 2;
  const pixels = new Uint8Array(128 * 128 * 4);
  const texture = new THREE.DataTexture(pixels, 128, 128);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0x777777,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  material.allowOverride = false;
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.onBeforeRender = (_renderer, scene) => {
    material.colorWrite = scene.overrideMaterial === null;
  };
  mesh.onAfterRender = () => {
    material.colorWrite = true;
  };
  mesh.raycast = () => undefined;
  const object = new THREE.Group();
  object.name = "studio-contact-shadow";
  object.add(mesh);
  let lastSoftness = -1;
  let currentSettings: StudioRenderSettings | null | undefined;
  const update = (settings?: StudioRenderSettings | null) => {
    currentSettings = settings;
    material.opacity = Math.min(
      0.25,
      Math.sqrt(THREE.MathUtils.clamp(settings?.occlusion ?? 0.3, 0, 1)) * 0.4,
    );
    const softness = THREE.MathUtils.clamp(settings?.softness ?? 0.9, 0, 1);
    if (softness === lastSoftness) return;
    lastSoftness = softness;
    const blur = padding * (0.12 + softness * 0.18);
    const radius = Math.min(size.x, size.z) * 0.08;
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const px = ((x + 0.5) / 128 - 0.5) * width;
        const pz = ((y + 0.5) / 128 - 0.5) * depth;
        const dx = Math.abs(px) - (size.x / 2 - radius);
        const dz = Math.abs(pz) - (size.z / 2 - radius);
        const distance = Math.max(
          0,
          rectangular
            ? Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) +
                Math.min(Math.max(dx, dz), 0) -
                radius
            : (Math.hypot(px / (size.x / 2), pz / (size.z / 2)) - 1) *
                (Math.min(size.x, size.z) / 2),
        );
        const i = (y * 128 + x) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
        pixels[i + 3] = Math.round(
          255 * Math.exp(-0.5 * (distance / blur) ** 2),
        );
      }
    }
    texture.needsUpdate = true;
  };
  const fit = () => {
    bounds.copy(contactBounds(model));
    bounds.getSize(size);
    object.visible = !bounds.isEmpty() && size.x > 0 && size.z > 0;
    if (!object.visible) return;
    bounds.getCenter(center);
    padding = Math.min(size.x, size.z) * 0.3;
    const nextWidth = size.x + padding * 2;
    const nextDepth = size.z + padding * 2;
    if (nextWidth !== width || nextDepth !== depth) lastSoftness = -1;
    width = nextWidth;
    depth = nextDepth;
    mesh.scale.set(width, 1, depth);
    mesh.position.set(
      center.x,
      bounds.min.y - Math.min(size.x, size.z) * 0.0005,
      center.z,
    );
    update(currentSettings);
  };
  fit();
  return {
    object,
    update,
    fit,
    dispose() {
      object.removeFromParent();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
