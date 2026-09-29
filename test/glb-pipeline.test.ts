import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { createMinimalGlb } from "./glb-fixture.js";
import {
  preparePresentation,
  styleStudioModel,
  updateModelVariant,
} from "../src/materials.js";
import { modelPreviewNotice } from "../src/preview-notice.js";
import { STUDIO_OCCURRENCE_ID_KEY } from "../src/user-data.js";

async function loadFixture(): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(createMinimalGlb(), "", resolve, reject);
  });
}

describe("GLB studio pipeline", () => {
  it("parses the studio userData convention from a generated GLB", async () => {
    const gltf = await loadFixture();
    const body = gltf.scene.getObjectByName("body");
    expect(body).toBeInstanceOf(THREE.Mesh);
    expect(body!.userData.studio_semantic_role).toBe("body");
    expect(body!.userData.studio_surface_finish).toBe("fuzzy");
    expect(body!.userData[STUDIO_OCCURRENCE_ID_KEY]).toBe("part-1");
    expect(
      gltf.scene.getObjectByName("variant")!.userData
        .studio_visible_variant_skus,
    ).toEqual(["A", "B"]);
  });

  it("styles the parsed model with the material engine", async () => {
    const gltf = await loadFixture();
    const body = gltf.scene.getObjectByName("body") as THREE.Mesh;
    styleStudioModel(gltf.scene, "#c7683c", "#d7c6a5");
    const material = body.material as THREE.MeshStandardMaterial;
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.color.getHexString()).toBe("c7683c");
    expect(material.userData.studioShader).toBe("studio-pbr-v1");
    expect(material.userData.studioFuzzyEnabled).toBe(true);
    expect(body.geometry.getAttribute("studioFuzzyMask")).toBeDefined();
  });

  it("fits the parsed model into a centered standing presentation", async () => {
    const gltf = await loadFixture();
    const presentation = preparePresentation(gltf.scene);
    const bounds = new THREE.Box3().setFromObject(presentation);
    expect(bounds.min.y).toBeCloseTo(-0.72, 5);
    expect(bounds.getSize(new THREE.Vector3()).y).toBeCloseTo(1.5, 5);
  });

  it("switches variants and reads preview notices from the parsed GLB", async () => {
    const gltf = await loadFixture();
    expect(modelPreviewNotice(gltf.scene, "en")).toBe(
      "The props are illustrative only and are not included.",
    );
    expect(modelPreviewNotice(gltf.scene, "de")).toBe(
      "Die Requisiten dienen nur der Illustration.",
    );
    const variant = gltf.scene.getObjectByName("variant")!;
    updateModelVariant(gltf.scene, "C");
    expect(variant.visible).toBe(false);
    updateModelVariant(gltf.scene, "A");
    expect(variant.visible).toBe(true);
  });
});
