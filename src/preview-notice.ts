import * as THREE from "three";
import { STUDIO_PREVIEW_NOTICE_KEY } from "./user-data.js";

/**
 * Reads the first localized plain-text notice that a model authors in the
 * `studio_preview_notice` material metadata. A notice is accepted only when it
 * is a string of at most 300 characters. The function returns an empty string
 * for a missing, malformed or unknown locale entry.
 */
export function modelPreviewNotice(
  model: THREE.Object3D,
  locale: string,
): string {
  let notice = "";
  model.traverse((object) => {
    if (notice || !(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      const translations: unknown = material.userData[STUDIO_PREVIEW_NOTICE_KEY];
      if (
        !translations ||
        typeof translations !== "object" ||
        Array.isArray(translations)
      )
        continue;
      const value: unknown = (translations as Record<string, unknown>)[locale];
      if (typeof value === "string" && value.trim() && value.length <= 300) {
        notice = value.trim();
        break;
      }
    }
  });
  return notice;
}
