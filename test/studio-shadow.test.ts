import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createStudioContactShadow } from "../src/studio-shadow.js";
import { studioRenderPresets } from "../src/render-settings.js";
import { studioLighting, styleStudioModel } from "../src/materials.js";

function fixture() {
  const model = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.8));
  body.userData.studio_semantic_role = "body";
  body.position.y = -0.42;
  const props = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 8));
  props.userData = {
    studio_illustrative_only: true,
    studio_semantic_role: "hardware",
  };
  model.add(body, props);
  return { model, body, props };
}

describe("studio contact shadow", () => {
  it("keeps the profile lighting values of the organizer and the stand", () => {
    const organizer = studioLighting("matte-organizer");
    const stand = studioLighting("matte-stand");
    expect(organizer.aoScale).toBe(2.2);
    expect(organizer.aoRadius).toBeLessThanOrEqual(studioLighting().aoRadius);
    expect(stand.rimIntensity).toBeGreaterThan(0);
    expect(stand.aoRadius).toBeGreaterThan(studioLighting().aoRadius);
    expect(studioLighting("smooth-relief").keyPosition).toEqual([-3, 2, 1]);
  });

  it("uses fine even grain on the rectangular body without replacing prop materials", () => {
    const { model, body, props } = fixture();
    const original = props.material;
    styleStudioModel(model, "#ffffff", "#ffffff", {}, "matte-organizer");
    expect(
      (body.material as THREE.Material).userData.studioFuzzyProfile,
    ).toBe("normal/classic/1mm/0.025mm");
    expect(
      Array.from(body.geometry.getAttribute("studioFuzzyMask").array).every(
        (value) => value === 1,
      ),
    ).toBe(true);
    expect(props.material).toBe(original);
  });

  it("uses only the body footprint and leaves camera and model bounds unchanged", () => {
    const { model } = fixture();
    const before = new THREE.Box3().setFromObject(model);
    const shadow = createStudioContactShadow(model)!;
    const bounds = new THREE.Box3().setFromObject(shadow.object);
    expect(bounds.min.y).toBeLessThan(-0.72);
    expect(bounds.min.y).toBeGreaterThan(-0.721);
    expect(bounds.getSize(new THREE.Vector3()).x).toBeLessThan(2.5);
    expect(new THREE.Box3().setFromObject(model).equals(before)).toBe(true);
    expect(shadow.object.parent).toBeNull();
    shadow.dispose();
  });

  it("uses a tiny soft texture, honors existing controls and releases owned GPU resources", () => {
    const { model, props } = fixture();
    const shadow = createStudioContactShadow(model)!;
    const mesh = shadow.object.children[0] as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >;
    const texture = mesh.material.map as THREE.DataTexture;
    expect(texture.image.width).toBe(128);
    expect(texture.image.height).toBe(128);
    expect(mesh.geometry.index!.count).toBe(6);
    expect(mesh.material.depthWrite).toBe(false);
    expect(mesh.material.color.r).toBe(mesh.material.color.g);
    expect(mesh.material.color.g).toBe(mesh.material.color.b);
    expect(mesh.material.allowOverride).toBe(false);
    const scene = new THREE.Scene();
    const beforeRender = () =>
      mesh.onBeforeRender(
        {} as THREE.WebGLRenderer,
        scene,
        new THREE.Camera(),
        mesh.geometry,
        mesh.material,
        new THREE.Group(),
      );
    scene.overrideMaterial = new THREE.MeshNormalMaterial();
    beforeRender();
    expect(mesh.material.colorWrite).toBe(false);
    scene.overrideMaterial = null;
    beforeRender();
    expect(mesh.material.colorWrite).toBe(true);
    shadow.update(studioRenderPresets.soft.settings);
    expect(mesh.material.opacity).toBeGreaterThan(0);
    expect(mesh.material.opacity).toBeLessThanOrEqual(0.25);
    const pixels = texture.image.data!;
    expect(pixels[3]).toBe(0);
    expect(pixels[(64 * 128 + 64) * 4 + 3]).toBe(255);
    shadow.update({ ...studioRenderPresets.soft.settings, occlusion: 0 });
    expect(mesh.material.opacity).toBe(0);
    props.visible = false;
    shadow.update(studioRenderPresets.soft.settings);
    expect(mesh.material.map).toBe(texture);
    const geometryDispose = vi.spyOn(mesh.geometry, "dispose");
    const materialDispose = vi.spyOn(mesh.material, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");
    shadow.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });

  it("grounds untagged models and follows visible variant geometry, not illustrative props", () => {
    const { model, body } = fixture();
    delete body.userData.studio_semantic_role;
    const hidden = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
    hidden.visible = false;
    model.add(hidden);
    const shadow = createStudioContactShadow(model)!;
    expect(shadow).not.toBeNull();
    const mesh = shadow.object.children[0] as THREE.Mesh;
    expect(mesh.position.y).toBeCloseTo(-0.72, 2);
    body.position.y -= 0.3;
    body.scale.x = 0.5;
    shadow.fit();
    expect(mesh.position.y).toBeCloseTo(-1.02, 2);
    expect(
      new THREE.Box3().setFromObject(shadow.object)
        .getSize(new THREE.Vector3()).x,
    ).toBeLessThan(1.5);
    shadow.dispose();
  });

  it("does not invent a floor for an empty model", () => {
    expect(createStudioContactShadow(new THREE.Group())).toBeNull();
  });

  it("uses the narrow base of a tapered model rather than its widest upper rim", () => {
    const model = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.1, 1.5, 24));
    model.userData.studio_semantic_role = "body";
    const shadow = createStudioContactShadow(model)!;
    expect(
      new THREE.Box3().setFromObject(shadow.object)
        .getSize(new THREE.Vector3()).x,
    ).toBeLessThan(0.4);
    shadow.dispose();
  });
});
