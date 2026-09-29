import * as THREE from "three";
import { STUDIO_LABEL_LOCALES_KEY } from "./user-data.js";

function validLocales(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8) return null;
  if (
    !value.every((locale) => typeof locale === "string" && locale.length > 0)
  )
    return null;
  if (new Set(value).size !== value.length) return null;
  return value as string[];
}

/**
 * Options for {@link createModelLabelLocalizer}.
 */
export type StudioLabelLocalizerOptions = {
  /**
   * Locale column order for materials that carry a color map but no embedded
   * `studio_label_locales` metadata. The option applies to every material that
   * has a map, so pass it only for atlases.
   */
  fallbackLocales?: readonly string[];
};

/**
 * Handle of the localized label atlases of one model.
 */
export type StudioLabelLocalizer = {
  setLocale: (locale: string) => void;
  dispose: () => void;
};

/**
 * Localizes embedded horizontal label atlases. Authored UVs cover the first
 * column of the atlas; the localizer shifts the texture offset of every
 * labelled material to the column of the selected locale. Geometry and
 * configurable material colors stay unchanged, and `dispose` restores the
 * source materials.
 */
export function createModelLabelLocalizer(
  model: THREE.Object3D,
  options?: StudioLabelLocalizerOptions,
): StudioLabelLocalizer {
  const fallbackLocales = validLocales(options?.fallbackLocales);
  const labels: {
    map: THREE.Texture;
    locales: readonly string[];
    baseOffset: number;
  }[] = [];
  const restorers: (() => void)[] = [];
  const copies = new Map<THREE.Material, THREE.MeshStandardMaterial>();

  const localize = (material: THREE.Material): THREE.Material => {
    if (!(material instanceof THREE.MeshStandardMaterial) || !material.map)
      return material;
    const locales =
      validLocales(material.userData[STUDIO_LABEL_LOCALES_KEY]) ??
      fallbackLocales;
    if (!locales) return material;
    const existing = copies.get(material);
    if (existing) return existing;
    const copy = material.clone();
    const map = material.map.clone();
    copy.map = map;
    copies.set(material, copy);
    labels.push({ map, locales, baseOffset: map.offset.x });
    return copy;
  };

  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const original = object.material;
    const replacement = Array.isArray(original)
      ? original.map(localize)
      : localize(original);
    if (
      original === replacement ||
      (Array.isArray(original) &&
        Array.isArray(replacement) &&
        original.every((material, index) => material === replacement[index]))
    )
      return;
    object.material = replacement;
    restorers.push(() => {
      object.material = original;
    });
  });

  return {
    setLocale(locale: string) {
      for (const label of labels) {
        const index = Math.max(0, label.locales.indexOf(locale));
        label.map.offset.x = label.baseOffset + index / label.locales.length;
        label.map.updateMatrix();
      }
    },
    dispose() {
      restorers.forEach((restore) => restore());
      for (const copy of copies.values()) {
        copy.map?.dispose();
        copy.dispose();
      }
      restorers.length = 0;
      labels.length = 0;
      copies.clear();
    },
  };
}
