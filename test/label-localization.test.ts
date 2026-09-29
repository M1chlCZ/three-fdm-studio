import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createModelLabelLocalizer } from "../src/label-localization.js";

function fixture(locales: unknown = ["en", "cs"]) {
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  material.userData.studio_label_locales = locales;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const model = new THREE.Group();
  model.add(mesh);
  return { model, mesh, material, texture };
}

describe("localized packaging label atlases", () => {
  it("selects the locale columns without changing geometry, colors or UV scale", () => {
    const { model, mesh, material } = fixture();
    const geometry = mesh.geometry;
    const labels = createModelLabelLocalizer(model);
    labels.setLocale("cs");
    expect(mesh.material.map?.offset.x).toBe(0.5);
    expect(mesh.material.map?.repeat.x).toBe(1);
    expect(mesh.material.color.equals(material.color)).toBe(true);
    expect(mesh.geometry).toBe(geometry);
    labels.setLocale("en");
    expect(mesh.material.map?.offset.x).toBe(0);
    labels.setLocale("cs");
    expect(mesh.material.map?.offset.x).toBe(0.5);
    labels.setLocale("unknown");
    expect(mesh.material.map?.offset.x).toBe(0);
    labels.dispose();
  });

  it("does not mutate shared source materials or textures and restores them on cleanup", () => {
    const { model, mesh, material, texture } = fixture();
    const labels = createModelLabelLocalizer(model);
    const localizedMaterial = mesh.material as THREE.MeshStandardMaterial;
    const localizedMap = localizedMaterial.map!;
    let disposed = 0;
    localizedMap.addEventListener("dispose", () => disposed++);
    labels.setLocale("cs");
    expect(mesh.material).not.toBe(material);
    expect(localizedMap).not.toBe(texture);
    expect(texture.offset.x).toBe(0);
    labels.dispose();
    expect(mesh.material).toBe(material);
    expect(disposed).toBe(1);
  });

  it.each([undefined, [], ["en"], ["en", 3], ["en", "en"]])(
    "ignores missing or malformed locale metadata: %j",
    (metadata) => {
      const { model, mesh, material } = fixture(metadata);
      if (metadata === undefined)
        delete material.userData.studio_label_locales;
      const labels = createModelLabelLocalizer(model);
      labels.setLocale("cs");
      expect(mesh.material).toBe(material);
      labels.dispose();
    },
  );

  it("supports material arrays while leaving unlabelled materials untouched", () => {
    const { material } = fixture();
    const plain = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [plain, material]);
    const model = new THREE.Group();
    model.add(mesh);
    const labels = createModelLabelLocalizer(model);
    labels.setLocale("cs");
    expect((mesh.material as THREE.Material[])[0]).toBe(plain);
    expect(
      (mesh.material as THREE.MeshStandardMaterial[])[1].map?.offset.x,
    ).toBe(0.5);
    labels.dispose();
    expect(mesh.material).toEqual([plain, material]);
  });

  it("applies caller-supplied fallback locales to materials without metadata", () => {
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const model = new THREE.Group();
    model.add(mesh);
    const labels = createModelLabelLocalizer(model, {
      fallbackLocales: ["en", "de"],
    });
    labels.setLocale("de");
    expect(
      (mesh.material as THREE.MeshStandardMaterial).map?.offset.x,
    ).toBe(0.5);
    labels.setLocale("en");
    expect(
      (mesh.material as THREE.MeshStandardMaterial).map?.offset.x,
    ).toBe(0);
    labels.dispose();
    expect(mesh.material).toBe(material);
  });

  it("ignores malformed fallback locales", () => {
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const model = new THREE.Group();
    model.add(mesh);
    const labels = createModelLabelLocalizer(model, {
      fallbackLocales: ["en"],
    });
    labels.setLocale("en");
    expect(mesh.material).toBe(material);
    labels.dispose();
  });
});
