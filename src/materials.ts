import * as THREE from "three";
import type { StudioRenderSettings } from "./render-settings.js";
import {
  STUDIO_GLOW_MATERIAL_FIELDS,
  STUDIO_MATERIAL_FIELD_KEY,
  STUDIO_OCCURRENCE_ID_KEY,
  STUDIO_SEMANTIC_ROLE_KEY,
  STUDIO_SURFACE_FINISH_KEY,
  STUDIO_VISIBILITY_DEFAULT_KEY,
  STUDIO_VISIBLE_VARIANT_SKUS_KEY,
  STUDIO_VISIBLE_WHEN_FIELD_KEY,
  STUDIO_VISIBLE_WHEN_VALUE_KEY,
  type StudioGlowMaterialField,
} from "./user-data.js";

const shaderName = "studio-pbr-v1";
const fuzzyPointDistance = 0.001;
const fuzzyThickness = 0.00008;
const fuzzyNormalStrength = 0.58;
const fuzzyAngularBinCount = 72;
const fuzzyReliefFadeStart = 0.00012;
const fuzzyReliefFadeEnd = 0.00028;
const presentationHeight = 1.5;
const presentationFloor = -0.72;
const presentationName = "studio-presentation";
const sourceGroupName = "studio-source-z-to-y";
const hardwareSurfaceFields = [
  "hardware_finish",
  "clip_finish",
  "rope_color",
];

/**
 * Presentation profiles select the studio lighting and the material behavior
 * of one product family.
 */
export type StudioPresentationProfile =
  | "standard"
  | "matte-stand"
  | "matte-organizer"
  | "smooth-relief"
  | "smooth-cavity";

/**
 * Surface finish that a glTF node can request in `studio_surface_finish`.
 */
export type StudioSurfaceFinish = "fuzzy" | "smooth";

/**
 * Optional printed finish that a caller can select for a material slot.
 */
export type StudioMaterialFinish = "glitter" | "painted";

/**
 * Extra `userData` fields that the material engine stores on a studio
 * material.
 */
export type StudioMaterialUserData = {
  studioColor?: string;
  studioShader?: string;
  studioFuzzyEnabled?: boolean;
  studioFuzzyProfile?: string;
  studioPresentationProfile?: StudioPresentationProfile;
  studioSurfaceDefaults?: { roughness: number; metalness: number };
  studioClaspFinishDefaults?: { roughness: number; metalness: number };
  studioGrain?: number;
  studioColorResponse?: number;
  studioGrainUniform?: { value: number };
  studioGlitterUniform?: { value: number };
  studioDynamicHardware?: boolean;
};

/**
 * A physically based material managed by the material engine.
 */
export type StudioMaterial = THREE.MeshStandardMaterial & {
  userData: StudioMaterialUserData;
};

/**
 * The lighting values that one presentation profile selects.
 */
export type StudioLighting = {
  environment: number;
  fallbackEnvironment: number;
  keyIntensity: number;
  keyPosition: [number, number, number];
  rimIntensity: number;
  aoRadius: number;
  aoIntensity: number;
  aoScale: number;
};

/**
 * Returns the studio lighting values of a presentation profile.
 */
export function studioLighting(
  profile: StudioPresentationProfile = "standard",
): StudioLighting {
  if (profile === "smooth-relief" || profile === "smooth-cavity") {
    return {
      environment: 0.75,
      fallbackEnvironment: 0.35,
      keyIntensity: 2.4,
      keyPosition: [-3, 2, 1],
      rimIntensity: 0.45,
      aoRadius: 0.045,
      aoIntensity: 0.6,
      aoScale: 1,
    };
  }
  const stand = profile === "matte-stand";
  return {
    environment: stand ? 0.38 : 0.65,
    fallbackEnvironment: stand ? 0.18 : 0.3,
    keyIntensity: stand ? 2.8 : 2.4,
    keyPosition: stand ? [-3, 3, 1] : [-3, 4, 5],
    rimIntensity: stand ? 0.55 : 0,
    aoRadius: stand ? 0.12 : 0.07,
    aoIntensity: stand ? 0.8 : 0.95,
    aoScale: stand ? 1 : profile === "matte-organizer" ? 2.2 : 1.6,
  };
}

/**
 * Creates a studio material for one printed color. A fuzzy material injects
 * the procedural FDM grain into the standard three.js PBR shader.
 */
export function createStudioMaterial(
  hex: string,
  fuzzyEnabled = true,
  profile: StudioPresentationProfile = "standard",
): StudioMaterial {
  const fineMatte = profile === "matte-stand";
  const material = new THREE.MeshStandardMaterial({
    color: hex,
    metalness: 0,
    roughness: fineMatte ? 0.76 : fuzzyEnabled ? 0.82 : 0.48,
  }) as StudioMaterial;
  material.userData.studioPresentationProfile = profile;
  updateMaterialColor(material, hex);
  material.userData.studioShader = shaderName;
  material.userData.studioFuzzyEnabled = fuzzyEnabled;
  material.userData.studioFuzzyProfile = fineMatte
    ? "normal/classic/1mm/0.025mm"
    : "normal/classic/1mm/0.08mm";
  material.customProgramCacheKey = () =>
    `${shaderName}:${profile}:${fuzzyEnabled ? "fuzzy" : "smooth"}`;
  if (!fuzzyEnabled) return material;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFuzzyPointDistance = { value: fuzzyPointDistance };
    shader.uniforms.uFuzzyThickness = {
      value: fineMatte ? 0.000025 : fuzzyThickness,
    };
    material.userData.studioGrainUniform = {
      value:
        (material.userData.studioGrain ?? 1) *
        (fineMatte ? 0.3 : fuzzyNormalStrength),
    };
    shader.uniforms.uFuzzyNormalStrength = material.userData.studioGrainUniform;
    const varyings = `
      varying vec3 vStudioLocalPosition;
      varying float vStudioFuzzyMask;
      varying float vStudioWorldThickness;
    `;
    shader.vertexShader =
      `
      attribute float studioFuzzyMask;
      uniform float uFuzzyThickness;
      ${varyings}
    ` +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
      #include <begin_vertex>
      vStudioLocalPosition = position;
      vStudioFuzzyMask = studioFuzzyMask;
      vStudioWorldThickness = uFuzzyThickness * length(modelMatrix[0].xyz);
    `,
      );
    shader.fragmentShader =
      `
      uniform float uFuzzyPointDistance;
      uniform float uFuzzyNormalStrength;
      ${varyings}

      float classicHash(vec3 point) {
        return fract(sin(dot(point, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      float classicNoise(vec3 point) {
        vec3 cell = floor(point);
        vec3 fraction = fract(point);
        fraction = fraction * fraction * (3.0 - 2.0 * fraction);
        float n000 = classicHash(cell);
        float n100 = classicHash(cell + vec3(1.0, 0.0, 0.0));
        float n010 = classicHash(cell + vec3(0.0, 1.0, 0.0));
        float n110 = classicHash(cell + vec3(1.0, 1.0, 0.0));
        float n001 = classicHash(cell + vec3(0.0, 0.0, 1.0));
        float n101 = classicHash(cell + vec3(1.0, 0.0, 1.0));
        float n011 = classicHash(cell + vec3(0.0, 1.0, 1.0));
        float n111 = classicHash(cell + vec3(1.0, 1.0, 1.0));
        float n00 = mix(n000, n100, fraction.x);
        float n10 = mix(n010, n110, fraction.x);
        float n01 = mix(n001, n101, fraction.x);
        float n11 = mix(n011, n111, fraction.x);
        return mix(mix(n00, n10, fraction.y), mix(n01, n11, fraction.y), fraction.z);
      }

      float fuzzySurfaceNoise(vec3 point) {
        float primary = classicNoise(point);
        float detail = classicNoise(point * 2.9 + vec3(13.7, 5.3, 19.1));
        float micro = classicNoise(point * 6.7 + vec3(3.1, 23.9, 11.3));
        return primary * 0.28 + detail * 0.48 + micro * 0.24;
      }

    ` +
      shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `
        #include <normal_fragment_maps>
        float fuzzyMask = clamp(vStudioFuzzyMask, 0.0, 1.0);
        vec3 fuzzyPoint = vStudioLocalPosition / uFuzzyPointDistance;
        float fuzzyNoise = fuzzySurfaceNoise(fuzzyPoint);
        vec3 apparentPosition = -vViewPosition +
          normal * ((fuzzyNoise - 0.5) * 2.0 * vStudioWorldThickness * fuzzyMask);
        vec3 apparentNormal = normalize(cross(dFdx(apparentPosition), dFdy(apparentPosition)));
        if (dot(apparentNormal, normal) < 0.0) apparentNormal = -apparentNormal;
        normal = normalize(mix(normal, apparentNormal, fuzzyMask * uFuzzyNormalStrength));
    `,
      );
  };
  return material;
}

/**
 * Adds the `studioFuzzyMask` vertex attribute to a geometry. The mask keeps
 * recessed relief and inward-facing walls smooth while the exposed shell
 * receives the printed grain.
 */
export function addFuzzyMaskAttribute(
  geometry: THREE.BufferGeometry,
  protectRaisedRelief = false,
): void {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  if (!position) return;

  const mask = new Float32Array(position.count);
  mask.fill(1);
  if (!normal || position.count !== normal.count) {
    geometry.setAttribute("studioFuzzyMask", new THREE.BufferAttribute(mask, 1));
    return;
  }

  geometry.computeBoundingBox();
  const center =
    geometry.boundingBox?.getCenter(new THREE.Vector3()) ??
    new THREE.Vector3();
  const capMaskAt = (index: number): number => {
    const nz = normal.getZ(index);
    const plane =
      nz >= 0 ? geometry.boundingBox!.max.z : geometry.boundingBox!.min.z;
    const distance = Math.abs(position.getZ(index) - plane);
    return (
      THREE.MathUtils.smoothstep(Math.abs(nz), 0.55, 0.9) *
      (1 - THREE.MathUtils.smoothstep(distance, fuzzyReliefFadeStart, fuzzyReliefFadeEnd))
    );
  };
  for (let index = 0; index < position.count; index += 1) {
    const radialX = position.getX(index) - center.x;
    const radialY = position.getY(index) - center.y;
    const radialLength = Math.hypot(radialX, radialY);
    const radialNormalLength = Math.hypot(
      normal.getX(index),
      normal.getY(index),
    );
    if (radialLength === 0 || radialNormalLength === 0) {
      mask[index] = capMaskAt(index);
      continue;
    }
    const outwardFacing =
      (normal.getX(index) * radialX + normal.getY(index) * radialY) /
      (radialNormalLength * radialLength);
    const wallNormal = THREE.MathUtils.smoothstep(radialNormalLength, 0.55, 0.9);
    const outwardMask = THREE.MathUtils.smoothstep(outwardFacing, 0.45, 0.9);
    mask[index] = Math.max(capMaskAt(index), wallNormal * outwardMask);
  }
  if (!protectRaisedRelief) {
    geometry.setAttribute("studioFuzzyMask", new THREE.BufferAttribute(mask, 1));
    return;
  }

  const baseRadii = new Float64Array(fuzzyAngularBinCount);
  baseRadii.fill(Number.POSITIVE_INFINITY);
  const binFor = (radialX: number, radialY: number): number => {
    const angle = Math.atan2(radialY, radialX) + Math.PI;
    return Math.min(
      fuzzyAngularBinCount - 1,
      Math.floor((angle / (Math.PI * 2)) * fuzzyAngularBinCount),
    );
  };
  for (let index = 0; index < position.count; index += 1) {
    const radialX = position.getX(index) - center.x;
    const radialY = position.getY(index) - center.y;
    const radialLength = Math.hypot(radialX, radialY);
    if (radialLength === 0) continue;
    const radialNormalLength = Math.hypot(
      normal.getX(index),
      normal.getY(index),
    );
    if (radialNormalLength < 0.85) continue;
    const outwardFacing =
      (normal.getX(index) * radialX + normal.getY(index) * radialY) /
      (radialNormalLength * radialLength);
    if (outwardFacing < 0.9) continue;
    const bin = binFor(radialX, radialY);
    baseRadii[bin] = Math.min(
      baseRadii[bin] ?? Number.POSITIVE_INFINITY,
      radialLength,
    );
  }
  const hasBaseRadius = baseRadii.some((radius) => Number.isFinite(radius));
  if (!hasBaseRadius) {
    geometry.setAttribute("studioFuzzyMask", new THREE.BufferAttribute(mask, 1));
    return;
  }

  const filledRadii = Float64Array.from(baseRadii, (radius, bin) => {
    if (Number.isFinite(radius)) return radius;
    for (let offset = 1; offset <= fuzzyAngularBinCount / 2; offset += 1) {
      const left =
        baseRadii[(bin - offset + fuzzyAngularBinCount) % fuzzyAngularBinCount];
      const right = baseRadii[(bin + offset) % fuzzyAngularBinCount];
      if (Number.isFinite(left) && Number.isFinite(right)) return (left + right) / 2;
      if (Number.isFinite(left)) return left;
      if (Number.isFinite(right)) return right;
    }
    return 0;
  });
  const localBaseRadii = Float64Array.from(filledRadii, (radius, bin) => {
    let localBaseRadius = radius;
    for (let offset = -2; offset <= 2; offset += 1) {
      const neighbor =
        filledRadii[(bin + offset + fuzzyAngularBinCount) % fuzzyAngularBinCount];
      if (Number.isFinite(neighbor))
        localBaseRadius = Math.min(localBaseRadius, neighbor);
    }
    return localBaseRadius;
  });
  for (let index = 0; index < position.count; index += 1) {
    const radialX = position.getX(index) - center.x;
    const radialY = position.getY(index) - center.y;
    const radialLength = Math.hypot(radialX, radialY);
    if (radialLength === 0) continue;
    const baseRadius = localBaseRadii[binFor(radialX, radialY)] ?? radialLength;
    const reliefMask =
      1 -
      THREE.MathUtils.smoothstep(
        radialLength - baseRadius,
        fuzzyReliefFadeStart,
        fuzzyReliefFadeEnd,
      );
    mask[index] = Math.max(capMaskAt(index), mask[index] * reliefMask);
  }
  geometry.setAttribute("studioFuzzyMask", new THREE.BufferAttribute(mask, 1));
}

/**
 * Applies a warehouse sRGB swatch to a studio material. The function protects
 * neutral white and compresses pastel albedo without changing the hue.
 */
export function updateMaterialColor(
  material: StudioMaterial,
  hex: string,
): void {
  material.userData.studioColor = hex;
  material.color.set(hex);
  if (
    material.userData.studioPresentationProfile === "smooth-cavity" &&
    material.color.getHex() === 0
  ) {
    material.color.setRGB(0.025, 0.025, 0.025);
  }
  const luminance =
    material.color.r * 0.2126 +
    material.color.g * 0.7152 +
    material.color.b * 0.0722;
  const chroma =
    Math.max(material.color.r, material.color.g, material.color.b) -
    Math.min(material.color.r, material.color.g, material.color.b);
  const neutralWhite =
    THREE.MathUtils.smoothstep(luminance, 0.75, 0.95) *
    (1 - THREE.MathUtils.smoothstep(chroma, 0.04, 0.16));
  const response =
    (material.userData.studioColorResponse ?? 0) * (1 - neutralWhite);
  material.color.multiplyScalar(1 / (1 + response * luminance));
}

/**
 * Replaces the materials of a loaded model with studio materials. The function
 * reads the semantic roles and material slots from `userData`, keeps authored
 * hardware materials and applies the current render settings.
 */
export function styleStudioModel(
  model: THREE.Object3D,
  bodyColor: string,
  lidColor: string,
  materialColors: Readonly<Record<string, string>> = {},
  profile: StudioPresentationProfile = "standard",
  settings?: StudioRenderSettings | null,
): void {
  const meshes: THREE.Mesh[] = [];
  model.traverse((object) => {
    if (object.userData[STUDIO_SEMANTIC_ROLE_KEY] === "ignore")
      object.visible = false;
    if (object instanceof THREE.Mesh) meshes.push(object);
  });

  for (const mesh of meshes) {
    if (!mesh.visible) continue;
    let authoredPart: THREE.Object3D = mesh;
    while (
      !authoredPart.userData[STUDIO_SEMANTIC_ROLE_KEY] &&
      !authoredPart.userData[STUDIO_MATERIAL_FIELD_KEY] &&
      authoredPart !== model &&
      authoredPart.parent
    ) {
      authoredPart = authoredPart.parent;
    }
    if (
      authoredPart.userData[STUDIO_SEMANTIC_ROLE_KEY] === "hardware" &&
      !authoredPart.userData[STUDIO_MATERIAL_FIELD_KEY]
    )
      continue;
    const mappedField = authoredPart.userData[STUDIO_MATERIAL_FIELD_KEY];
    const semanticRole = authoredPart.userData[STUDIO_SEMANTIC_ROLE_KEY];
    if (semanticRole === "hardware" && !mappedField) continue;
    if (
      semanticRole === "hardware" &&
      typeof mappedField === "string" &&
      !materialColors[mappedField]
    )
      continue;
    const isLid =
      semanticRole === "lid" || (semanticRole !== "body" && mesh.name === "lid");
    const finish = mesh.userData[STUDIO_SURFACE_FINISH_KEY] as
      | StudioSurfaceFinish
      | undefined;
    const isBody =
      semanticRole === "body" || (semanticRole !== "lid" && mesh.name === "body");
    const fineMatte =
      (profile === "matte-stand" || profile === "matte-organizer") &&
      (isBody || isLid);
    const fuzzyEnabled =
      fineMatte ||
      finish === "fuzzy" ||
      (finish !== "smooth" && (isBody || isLid));
    const componentColor =
      typeof mappedField === "string" && materialColors[mappedField]
        ? materialColors[mappedField]
        : isLid
          ? lidColor
          : bodyColor;
    if (fineMatte) {
      const count = mesh.geometry.getAttribute("position").count;
      mesh.geometry.setAttribute(
        "studioFuzzyMask",
        new THREE.BufferAttribute(new Float32Array(count).fill(1), 1),
      );
    } else {
      addFuzzyMaskAttribute(mesh.geometry, fuzzyEnabled && isBody);
    }
    const material = createStudioMaterial(
      componentColor,
      fuzzyEnabled,
      fineMatte
        ? "matte-stand"
        : profile === "smooth-cavity"
          ? profile
          : "standard",
    );
    if (
      (semanticRole === "hardware" ||
        mappedField === "hardware_finish" ||
        mappedField === "clip_finish" ||
        mappedField === "rope_color") &&
      mesh.material instanceof THREE.MeshStandardMaterial
    ) {
      material.metalness = mesh.material.metalness;
      material.roughness = mesh.material.roughness;
    }
    mesh.material = material;
  }
  updateModelSurface(model, settings);
}

/**
 * Updates the body, lid, slot and occurrence-highlight colors of a styled
 * model without reloading it.
 */
export function updateModelColors(
  model: THREE.Object3D,
  bodyColor: string,
  lidColor: string,
  materialColors: Readonly<Record<string, string>> = {},
  highlightOccurrenceKey?: string | null,
): void {
  model.traverse((object) => {
    if (object.userData[STUDIO_SEMANTIC_ROLE_KEY] === "ignore")
      object.visible = false;
    if (
      !(object instanceof THREE.Mesh) ||
      !(object.material instanceof THREE.MeshStandardMaterial)
    )
      return;
    let authoredPart: THREE.Object3D = object;
    while (
      !authoredPart.userData[STUDIO_SEMANTIC_ROLE_KEY] &&
      !authoredPart.userData[STUDIO_MATERIAL_FIELD_KEY] &&
      authoredPart !== model &&
      authoredPart.parent
    )
      authoredPart = authoredPart.parent;
    const mappedField = authoredPart.userData[STUDIO_MATERIAL_FIELD_KEY];
    const semanticRole = authoredPart.userData[STUDIO_SEMANTIC_ROLE_KEY];
    const mappedColor =
      typeof mappedField === "string" ? materialColors[mappedField] : undefined;
    if (semanticRole === "hardware") {
      if (!mappedColor) return;
      if (
        !object.material.userData.studioShader &&
        !object.material.userData.studioDynamicHardware
      ) {
        object.material = object.material.clone();
        object.material.userData.studioDynamicHardware = true;
      }
    } else if (!object.material.userData.studioShader) return;
    const isLid =
      semanticRole === "lid" || (semanticRole !== "body" && object.name === "lid");
    const nextColor = mappedColor ?? (isLid ? lidColor : bodyColor);
    if (object.material.userData.studioShader)
      updateMaterialColor(object.material as StudioMaterial, nextColor);
    else object.material.color.set(nextColor);
    if (
      highlightOccurrenceKey &&
      object.userData[STUDIO_OCCURRENCE_ID_KEY] === highlightOccurrenceKey
    ) {
      object.material.color.lerp(new THREE.Color("#c7683c"), 0.46);
    }
  });
}

/**
 * Applies render settings to the printed materials of a styled model. Authored
 * hardware and cord materials stay untouched.
 */
export function updateModelSurface(
  model: THREE.Object3D,
  settings?: StudioRenderSettings | null,
): void {
  model.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) ||
      !(object.material instanceof THREE.MeshStandardMaterial)
    )
      return;
    const material = object.material as StudioMaterial;
    if (
      !material.userData.studioShader ||
      object.userData[STUDIO_SEMANTIC_ROLE_KEY] === "hardware" ||
      hardwareSurfaceFields.includes(object.userData[STUDIO_MATERIAL_FIELD_KEY])
    )
      return;
    const defaults = (material.userData.studioSurfaceDefaults ??= {
      roughness: material.roughness,
      metalness: material.metalness,
    });
    material.roughness = settings?.roughness ?? defaults.roughness;
    material.metalness = settings?.metalness ?? defaults.metalness;
    material.userData.studioColorResponse = settings?.color_response ?? 0;
    if (material.userData.studioColor)
      updateMaterialColor(material, material.userData.studioColor);
    material.userData.studioGrain = settings?.grain ?? 1;
    if (material.userData.studioGrainUniform)
      material.userData.studioGrainUniform.value =
        material.userData.studioGrain *
        (material.userData.studioPresentationProfile === "matte-stand"
          ? 0.3
          : fuzzyNormalStrength);
  });
}

/**
 * Drives the optional phosphorescence demonstration. Only the selected
 * material slot emits light; every other slot resets to black.
 */
export function updateModelGlow(
  model: THREE.Object3D,
  field: string | undefined,
  darkness: number,
): void {
  model.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) ||
      !(object.material instanceof THREE.MeshStandardMaterial)
    )
      return;
    const mapped = object.userData[STUDIO_MATERIAL_FIELD_KEY];
    if (
      !STUDIO_GLOW_MATERIAL_FIELDS.includes(mapped as StudioGlowMaterialField)
    )
      return;
    const emits = mapped === field;
    object.material.emissive.set(emits ? "#7DFF80" : "#000000");
    object.material.emissiveIntensity = emits
      ? 0.03 + 1.4 * THREE.MathUtils.clamp(darkness, 0, 1)
      : 0;
  });
}

/**
 * Shows only the objects that belong to the selected variant SKU. A missing
 * SKU shows the complete assembly.
 */
export function updateModelVariant(
  model: THREE.Object3D,
  variantSKU?: string,
): void {
  model.traverse((object) => {
    if (object.userData[STUDIO_SEMANTIC_ROLE_KEY] === "ignore") {
      object.visible = false;
      return;
    }
    const variants: unknown = object.userData[STUDIO_VISIBLE_VARIANT_SKUS_KEY];
    if (
      Array.isArray(variants) &&
      variants.length > 0 &&
      variants.every((sku) => typeof sku === "string" && sku.length > 0)
    ) {
      object.visible = !variantSKU || variants.includes(variantSKU);
    }
  });
}

/**
 * Switches one material slot between its printed surface and the optional
 * glitter flakes. The flakes stay fixed to the print; only a shader uniform
 * changes.
 */
export function updateModelFinishes(
  model: THREE.Object3D,
  finishes: Readonly<Record<string, StudioMaterialFinish>>,
): void {
  model.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) ||
      !(object.material instanceof THREE.MeshStandardMaterial)
    )
      return;
    const material = object.material as StudioMaterial;
    const role = object.userData[STUDIO_SEMANTIC_ROLE_KEY];
    const mappedField = object.userData[STUDIO_MATERIAL_FIELD_KEY];
    if (["classic_clasp_color", "hardware_finish"].includes(mappedField)) {
      const painted = finishes[mappedField] === "painted";
      if (!painted && !material.userData.studioClaspFinishDefaults) return;
      if (!material.userData.studioClaspFinishDefaults) {
        object.material = material.clone();
        object.material.userData.studioClaspFinishDefaults = {
          metalness: material.metalness,
          roughness: material.roughness,
        };
      }
      const target = object.material as StudioMaterial;
      const original = target.userData.studioClaspFinishDefaults!;
      target.metalness = painted ? 0 : original.metalness;
      target.roughness = painted ? 0.28 : original.roughness;
      return;
    }
    if (
      !material.userData.studioShader ||
      role === "hardware" ||
      hardwareSurfaceFields.includes(mappedField)
    )
      return;
    const field =
      mappedField ||
      (role === "lid" || object.name === "lid" ? "lid_color" : "body_color");
    const enabled = finishes[field] === "glitter";
    if (material.userData.studioGlitterUniform) {
      material.userData.studioGlitterUniform.value = enabled ? 1 : 0;
      return;
    }
    if (!enabled) return;
    const uniform = (material.userData.studioGlitterUniform = { value: 1 });
    const compileBase = material.onBeforeCompile.bind(material);
    const baseKey = material.customProgramCacheKey();
    material.customProgramCacheKey = () => `${baseKey}:glitter-v1`;
    material.onBeforeCompile = (shader, renderer) => {
      compileBase(shader, renderer);
      shader.uniforms.uStudioGlitter = uniform;
      shader.vertexShader =
        "varying vec3 vStudioFlakePosition;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvStudioFlakePosition = position;",
        );
      shader.fragmentShader =
        `
        uniform float uStudioGlitter;
        varying vec3 vStudioFlakePosition;
        float studioFlakeHash(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }
      ` +
        shader.fragmentShader
          .replace(
            "#include <roughnessmap_fragment>",
            `
        #include <roughnessmap_fragment>
        vec3 flakePoint = vStudioFlakePosition / 0.00065;
        vec3 flakeCell = floor(flakePoint);
        float flakeSeed = studioFlakeHash(flakeCell);
        float flakeDistance = length(fract(flakePoint) - vec3(0.5));
        float flakeAA = max(fwidth(flakeDistance), 0.025);
        float studioFlakeMask = uStudioGlitter * step(0.84, flakeSeed)
          * (1.0 - smoothstep(0.25 - flakeAA, 0.25 + flakeAA, flakeDistance));
        roughnessFactor = mix(roughnessFactor, 0.19, studioFlakeMask);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.65, 0.78, 0.82), studioFlakeMask * 0.5);
      `,
          )
          .replace(
            "#include <opaque_fragment>",
            `
        float flakeGlint = pow(max(dot(normal, normalize(normalize(vViewPosition)
          + normalize(vec3(-0.5, 0.8, 0.7)))), 0.0), 28.0);
        outgoingLight += studioFlakeMask * (0.25 + flakeGlint * 2.0)
          * (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular);
        #include <opaque_fragment>
      `,
          );
    };
    material.needsUpdate = true;
  });
}

/**
 * Shows only the authored parts that match the caller configuration and refits
 * the presentation. The configuration uses catalog values, never translated
 * labels.
 */
export function updateModelConfiguration(
  model: THREE.Object3D,
  configuration: Readonly<Record<string, string | number>>,
): void {
  let changed = false;
  model.traverse((object) => {
    const field = object.userData[STUDIO_VISIBLE_WHEN_FIELD_KEY];
    const value = object.userData[STUDIO_VISIBLE_WHEN_VALUE_KEY];
    if (typeof field !== "string" || typeof value !== "string") return;
    const selected =
      configuration[field] ?? object.userData[STUDIO_VISIBILITY_DEFAULT_KEY];
    const visible =
      object.userData[STUDIO_SEMANTIC_ROLE_KEY] !== "ignore" &&
      selected === value;
    changed ||= object.visible !== visible;
    object.visible = visible;
  });
  if (changed && model.name === presentationName) fitPresentation(model);
}

function fitPresentation(presentation: THREE.Object3D): void {
  const source = presentation.children.find(
    (child) => child.name === sourceGroupName,
  );
  if (!source) return;
  source.scale.setScalar(1);
  source.position.set(0, 0, 0);
  presentation.updateWorldMatrix(true, true);
  const inverse = presentation.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  source.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    bounds.union(
      object.geometry.boundingBox
        .clone()
        .applyMatrix4(
          new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld),
        ),
    );
  });
  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  const scale = longest > 0 ? presentationHeight / longest : 1;
  const center = bounds.getCenter(new THREE.Vector3());
  source.scale.setScalar(scale);
  source.position.set(
    -center.x * scale,
    presentationFloor - bounds.min.y * scale,
    -center.z * scale,
  );
  presentation.updateWorldMatrix(true, true);
}

/**
 * Wraps a loaded glTF scene in a presentation group. The group converts STEP
 * Z-up sources to Y-up, applies the saved source rotation, centers the model
 * and scales it to the studio height.
 */
export function preparePresentation(
  model: THREE.Object3D,
  sourceRotationXDegrees = 0,
  sourceRotationYDegrees = 0,
  sourceRotationZDegrees = 0,
): THREE.Group {
  const sourceToYUp = new THREE.Group();
  sourceToYUp.name = sourceGroupName;
  sourceToYUp.rotation.set(
    -Math.PI / 2 + THREE.MathUtils.degToRad(sourceRotationXDegrees),
    THREE.MathUtils.degToRad(sourceRotationYDegrees),
    THREE.MathUtils.degToRad(sourceRotationZDegrees),
  );
  sourceToYUp.add(model);

  const presentation = new THREE.Group();
  presentation.name = presentationName;
  presentation.add(sourceToYUp);
  presentation.updateMatrixWorld(true);

  fitPresentation(presentation);
  return presentation;
}

/**
 * Frames the presentation in the orthographic studio camera. The `centerY`
 * value follows the model bounds so tall and short models stay centered.
 */
export function configureStudioCamera(
  camera: THREE.OrthographicCamera,
  aspect: number,
  centerY = -0.02,
): void {
  const viewHeight = 2.05;
  const viewWidth = viewHeight * Math.max(aspect, 0.5);
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.near = 0.01;
  camera.far = 20;
  camera.position.set(2.45, centerY + 1.47, 3.25);
  camera.lookAt(0, centerY, 0);
  camera.updateProjectionMatrix();
}
