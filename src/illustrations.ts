import * as THREE from "three";
import { STUDIO_ILLUSTRATIVE_ONLY_KEY } from "./user-data.js";

/**
 * Handle of the illustration-only props of one model.
 */
export type StudioIllustrationToggle = {
  count: number;
  setVisible: (visible: boolean) => void;
};

/**
 * Collects the objects that carry the `studio_illustrative_only` marker and
 * hides or restores them without changing the printed product.
 */
export function createModelIllustrationToggle(
  model: THREE.Object3D,
): StudioIllustrationToggle {
  const props: { object: THREE.Object3D; initiallyVisible: boolean }[] = [];
  model.traverse((object) => {
    if (object.userData[STUDIO_ILLUSTRATIVE_ONLY_KEY] === true) {
      props.push({ object, initiallyVisible: object.visible });
    }
  });
  return {
    count: props.length,
    setVisible(visible: boolean) {
      for (const prop of props)
        prop.object.visible = visible && prop.initiallyVisible;
    },
  };
}
