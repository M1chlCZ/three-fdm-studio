import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { modelPreviewNotice } from "../src/preview-notice.js";

describe("model preview notices", () => {
  it("reads localized, opt-in material metadata for both preview sizes", () => {
    const material = new THREE.MeshStandardMaterial();
    material.userData.studio_preview_notice = {
      en: "The props are illustrative only and are not included.",
      de: "Die Requisiten dienen nur der Illustration.",
    };
    const model = new THREE.Group();
    model.add(
      new THREE.Mesh(new THREE.BoxGeometry(), [
        new THREE.MeshStandardMaterial(),
        material,
      ]),
    );
    expect(modelPreviewNotice(model, "en")).toBe(
      material.userData.studio_preview_notice.en,
    );
    expect(modelPreviewNotice(model, "de")).toBe(
      material.userData.studio_preview_notice.de,
    );
    expect(modelPreviewNotice(model, "unknown")).toBe("");
  });

  it.each([
    undefined,
    null,
    true,
    "wrong",
    { en: 42 },
    { en: " " },
    { en: "x".repeat(301) },
  ])("ignores missing or malformed notices %j", (metadata) => {
    const material = new THREE.MeshStandardMaterial();
    material.userData.studio_preview_notice = metadata;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    expect(modelPreviewNotice(mesh, "en")).toBe("");
  });
});
