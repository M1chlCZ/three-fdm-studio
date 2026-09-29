import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  addFuzzyMaskAttribute,
  configureStudioCamera,
  createStudioMaterial,
  preparePresentation,
  studioLighting,
  styleStudioModel,
  updateMaterialColor,
  updateModelColors,
  updateModelConfiguration,
  updateModelFinishes,
  updateModelGlow,
  updateModelSurface,
  updateModelVariant,
} from "../src/materials.js";

describe("studio materials", () => {
  it("switches classic clasps between lacquer and their original metal finish without touching beads", () => {
    const model = new THREE.Group();
    const clasp = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ metalness: 0.85, roughness: 0.22 }),
    );
    clasp.userData = {
      studio_semantic_role: "hardware",
      studio_material_field_key: "classic_clasp_color",
    };
    const beads = new THREE.Mesh(
      new THREE.SphereGeometry(),
      new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.4 }),
    );
    beads.userData.studio_semantic_role = "hardware";
    model.add(clasp, beads);
    updateModelFinishes(model, { classic_clasp_color: "painted" });
    expect((clasp.material as THREE.MeshStandardMaterial).metalness).toBe(0);
    expect((clasp.material as THREE.MeshStandardMaterial).roughness).toBe(0.28);
    expect((beads.material as THREE.MeshStandardMaterial).roughness).toBe(0.4);
    updateModelFinishes(model, {});
    expect((clasp.material as THREE.MeshStandardMaterial).metalness).toBe(0.85);
    expect((clasp.material as THREE.MeshStandardMaterial).roughness).toBe(0.22);
  });

  it("colors a newly selected clasp without reloading and never uses body color for hidden hardware", () => {
    const model = new THREE.Group();
    const heart = new THREE.Group();
    heart.userData = {
      studio_semantic_role: "hardware",
      studio_material_field_key: "heart_clasp_color",
    };
    const clasp = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({
        color: "#62B8DA",
        metalness: 0.12,
        roughness: 0.23,
      }),
    );
    const beadMaterial = new THREE.MeshStandardMaterial({ color: "#EEAACC" });
    const beads = new THREE.Mesh(new THREE.SphereGeometry(), beadMaterial);
    beads.userData.studio_semantic_role = "hardware";
    heart.add(clasp);
    model.add(heart, beads);
    styleStudioModel(model, "#ffffff", "#ffffff", {
      cloud_clasp_color: "#ffffff",
    });
    updateModelColors(model, "#000000", "#000000", {
      heart_clasp_color: "#ECC4FF",
    });
    expect((clasp.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(
      "ecc4ff",
    );
    expect((clasp.material as THREE.MeshStandardMaterial).metalness).toBe(0.12);
    expect((clasp.material as THREE.MeshStandardMaterial).roughness).toBe(0.23);
    updateModelColors(model, "#ff0000", "#ff0000", {
      cloud_clasp_color: "#ffffff",
    });
    expect((clasp.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(
      "ecc4ff",
    );
    expect(beads.material).toBe(beadMaterial);
  });

  it("colors a selectable coated clasp independently without changing its finish or beads", () => {
    const model = new THREE.Group();
    const clasp = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({
        color: "#62B8DA",
        metalness: 0.12,
        roughness: 0.23,
      }),
    );
    clasp.userData = {
      studio_semantic_role: "hardware",
      studio_material_field_key: "cloud_clasp_color",
    };
    const beadMaterial = new THREE.MeshStandardMaterial({ color: "#EEAACC" });
    const beads = new THREE.Mesh(new THREE.SphereGeometry(), beadMaterial);
    beads.userData = { studio_semantic_role: "hardware" };
    model.add(clasp, beads);
    styleStudioModel(model, "#FFFFFF", "#FFFFFF", {
      cloud_clasp_color: "#E74356",
    });
    expect((clasp.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(
      "e74356",
    );
    expect((clasp.material as THREE.MeshStandardMaterial).metalness).toBe(0.12);
    expect((clasp.material as THREE.MeshStandardMaterial).roughness).toBe(0.23);
    expect(beads.material).toBe(beadMaterial);
    styleStudioModel(model, "#000000", "#000000", {
      cloud_clasp_color: "#E74356",
    });
    expect((clasp.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(
      "e74356",
    );
    expect(beads.material).toBe(beadMaterial);
  });

  it("keeps authored hardware color when its optional color field is not selected", () => {
    const model = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: "#62B8DA",
      metalness: 0.12,
      roughness: 0.23,
    });
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(), material);
    clasp.userData = {
      studio_semantic_role: "hardware",
      studio_material_field_key: "cloud_clasp_color",
    };
    model.add(clasp);
    styleStudioModel(model, "#000000", "#000000");
    expect(clasp.material).toBe(material);
  });

  it("switches accessory groups from configuration and preserves legacy defaults", () => {
    const model = new THREE.Group();
    const cord = new THREE.Group();
    const beads = new THREE.Group();
    cord.userData = {
      studio_visible_when_field: "attachment_type",
      studio_visible_when_value: "CORD",
      studio_visibility_default: "CORD",
    };
    beads.userData = {
      ...cord.userData,
      studio_visible_when_value: "BEADS",
    };
    const unchanged = new THREE.Mesh();
    unchanged.visible = false;
    model.add(cord, beads, unchanged);
    updateModelConfiguration(model, {});
    expect([cord.visible, beads.visible, unchanged.visible]).toEqual([
      true,
      false,
      false,
    ]);
    updateModelConfiguration(model, { attachment_type: "BEADS" });
    expect([cord.visible, beads.visible, unchanged.visible]).toEqual([
      false,
      true,
      false,
    ]);
    updateModelConfiguration(model, { attachment_type: "CORD" });
    expect([cord.visible, beads.visible]).toEqual([true, false]);
  });

  it("frames only the selected accessory, including after a selection changes", () => {
    const model = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const beads = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 8));
    beads.position.z = 4;
    beads.userData = {
      studio_visible_when_field: "attachment_type",
      studio_visible_when_value: "BEADS",
      studio_visibility_default: "CORD",
    };
    model.add(body, beads);
    updateModelConfiguration(model, {});
    const presentation = preparePresentation(model);
    const initialScale = body.getWorldScale(new THREE.Vector3()).x;
    updateModelConfiguration(presentation, { attachment_type: "BEADS" });
    expect(body.getWorldScale(new THREE.Vector3()).x).toBeLessThan(
      initialScale / 4,
    );
    presentation.rotation.y = 1.2;
    updateModelConfiguration(presentation, { attachment_type: "CORD" });
    expect(body.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(initialScale);
    expect(presentation.rotation.y).toBe(1.2);
  });

  it("emits only from the selected middle band and resets when glow is removed", () => {
    const model = new THREE.Group();
    const bands = ["back_color", "middle_color", "front_color"].map((field) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial(),
      );
      mesh.userData.studio_material_field_key = field;
      model.add(mesh);
      return mesh;
    });
    styleStudioModel(model, "#FFFFFF", "#FFFFFF");
    const geometry = bands.map((mesh) => mesh.geometry);
    updateModelGlow(model, "middle_color", 1);
    const materials = bands.map(
      (mesh) => mesh.material as THREE.MeshStandardMaterial,
    );
    expect(materials[0].emissiveIntensity).toBe(0);
    expect(materials[1].emissiveIntensity).toBeGreaterThan(1);
    expect(materials[1].emissive.g).toBeGreaterThan(materials[1].emissive.r);
    expect(materials[2].emissiveIntensity).toBe(0);
    updateModelGlow(model, undefined, 0);
    for (const [index, mesh] of bands.entries()) {
      expect(
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity,
      ).toBe(0);
      expect(mesh.geometry).toBe(geometry[index]);
    }
  });

  it("switches glitter on printed parts without changing steel, geometry or base swatches", () => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.12));
    body.userData = {
      studio_semantic_role: "body",
      studio_material_field_key: "body_color",
    };
    const steel = new THREE.MeshStandardMaterial({
      metalness: 1,
      roughness: 0.23,
    });
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(), steel);
    bowl.userData = { studio_semantic_role: "hardware" };
    const model = new THREE.Group();
    model.add(body, bowl);
    styleStudioModel(model, "#187E98", "#ffffff", {}, "matte-stand");
    const material = body.material as ReturnType<typeof createStudioMaterial>;
    const matteKey = material.customProgramCacheKey();
    updateModelFinishes(model, { body_color: "glitter" });
    const shader = {
      uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(
      shader as Parameters<typeof material.onBeforeCompile>[0],
      {} as THREE.WebGLRenderer,
    );
    expect(shader.uniforms.uStudioGlitter.value).toBe(1);
    expect(shader.fragmentShader).toContain("studioFlakeMask");
    expect(material.customProgramCacheKey()).not.toBe(matteKey);
    expect(material.color.getHexString()).toBe("187e98");
    expect(material.emissive.getHex()).toBe(0);
    expect(bowl.material).toBe(steel);
    updateModelFinishes(model, {});
    expect(shader.uniforms.uStudioGlitter.value).toBe(0);
    expect(material.roughness).toBe(0.76);
    expect(steel.roughness).toBe(0.23);
  });

  it("compresses pastel swatches more than dark ones without cumulative tint or hardware changes", () => {
    const body = new THREE.Mesh(new THREE.BoxGeometry());
    body.userData.studio_semantic_role = "body";
    const steel = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ color: "white", metalness: 1 }),
    );
    steel.userData.studio_semantic_role = "hardware";
    const model = new THREE.Group();
    model.add(body, steel);
    const settings = {
      roughness: 0.6,
      metalness: 0,
      grain: 0,
      exposure: 0.9,
      environment: 0.8,
      key: 2,
      fill: 2,
      occlusion: 0.4,
      color_response: 0.6,
    };
    styleStudioModel(model, "#ffbbaa", "#ffffff", {}, "standard", settings);
    const material = body.material as ReturnType<typeof createStudioMaterial>;
    const white = material.color.r;
    expect(white).toBeLessThan(0.8);
    updateModelSurface(model, settings);
    expect(material.color.r).toBe(white);
    updateMaterialColor(material, "#666666");
    const originalDark = new THREE.Color("#666666").r;
    expect(material.color.r / originalDark).toBeGreaterThan(white);
    updateMaterialColor(material, "#ffbbaa");
    expect(material.color.r).toBe(white);
    expect((steel.material as THREE.MeshStandardMaterial).color.r).toBe(1);
    updateModelSurface(model, null);
    expect(material.color.r).toBe(1);
  });

  it.each(["#ffffff", "#fafaf5"])(
    "preserves the neutral white point of %s with highlight protection",
    (hex) => {
      const material = createStudioMaterial(hex);
      material.userData.studioColorResponse = 0.6;
      updateMaterialColor(material, hex);
      const original = new THREE.Color(hex);
      expect(material.color.r / original.r).toBeGreaterThan(0.98);
      expect(material.color.g / original.g).toBeGreaterThan(0.98);
      expect(material.color.b / original.b).toBeGreaterThan(0.98);
      updateMaterialColor(material, "#888888");
      updateMaterialColor(material, hex);
      expect(material.color.r / original.r).toBeGreaterThan(0.98);
    },
  );

  it("applies model surface settings to printed parts without recoloring fixed steel", () => {
    const model = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial(),
    );
    body.userData.studio_semantic_role = "body";
    const steel = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.23 });
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(), steel);
    bowl.userData.studio_semantic_role = "hardware";
    model.add(body, bowl);
    styleStudioModel(model, "#b4d7c1", "#ffffff", {}, "standard", {
      roughness: 0.55,
      metalness: 0,
      grain: 0.2,
      exposure: 0.9,
      environment: 0.8,
      key: 2,
      fill: 1,
      occlusion: 0.4,
    });
    expect((body.material as THREE.MeshStandardMaterial).roughness).toBe(0.55);
    expect(
      (body.material as THREE.MeshStandardMaterial).color.getHexString(),
    ).toBe("b4d7c1");
    expect(bowl.material).toBe(steel);
    expect(steel.roughness).toBe(0.23);
  });

  it("keeps black cavity polymer reflective on initial load and after color changes", () => {
    const model = new THREE.Mesh(new THREE.BoxGeometry());
    model.userData = {
      studio_semantic_role: "body",
      studio_surface_finish: "smooth",
    };
    styleStudioModel(model, "#000000", "#000000", {}, "smooth-cavity");
    const material = model.material as ReturnType<typeof createStudioMaterial>;
    const black = material.color.clone();
    expect(black.r).toBeGreaterThan(0);
    expect(black.r).toBeLessThan(0.03);
    expect(material.emissive.getHex()).toBe(0);
    expect(material.userData.studioColor).toBe("#000000");
    updateMaterialColor(material, "#A4DBE8");
    expect(material.color.getHexString()).toBe("a4dbe8");
    updateMaterialColor(material, "#000000");
    expect(material.color.equals(black)).toBe(true);
    expect(createStudioMaterial("#000000").color.getHex()).toBe(0);
  });

  it("lights smooth relief without lifting the material color or adding fuzzy skin", () => {
    const profile = "smooth-relief" as const;
    const lighting = studioLighting(profile);
    expect(lighting.keyPosition).toEqual([-3, 2, 1]);
    expect(lighting.aoIntensity).toBeLessThan(studioLighting().aoIntensity);
    const model = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.08));
    model.userData = {
      studio_semantic_role: "body",
      studio_surface_finish: "smooth",
    };
    styleStudioModel(model, "#101820", "#101820", {}, profile);
    const material = model.material as ReturnType<typeof createStudioMaterial>;
    expect(material.color.getHexString()).toBe("101820");
    expect(material.userData.studioFuzzyEnabled).toBe(false);
    expect(material.roughness).toBe(0.48);
  });

  it("reveals printed relief with contact occlusion and preserves the matte stand lighting", () => {
    const standard = studioLighting();
    const stand = studioLighting("matte-stand");
    expect(standard).toEqual({
      environment: 0.65,
      fallbackEnvironment: 0.3,
      keyIntensity: 2.4,
      keyPosition: [-3, 4, 5],
      rimIntensity: 0,
      aoRadius: 0.07,
      aoIntensity: 0.95,
      aoScale: 1.6,
    });
    expect(stand).toEqual({
      environment: 0.38,
      fallbackEnvironment: 0.18,
      keyIntensity: 2.8,
      keyPosition: [-3, 3, 1],
      rimIntensity: 0.55,
      aoRadius: 0.12,
      aoIntensity: 0.8,
      aoScale: 1,
    });
  });

  it.each(["smooth", "fuzzy"])(
    "gives %s stand polymer subtle uniform grain without touching steel or geometry",
    (finish) => {
      const model = new THREE.Group();
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.05, 0.12),
        new THREE.MeshStandardMaterial(),
      );
      top.userData = {
        studio_semantic_role: "lid",
        studio_material_field_key: "top_color",
        studio_surface_finish: finish,
      };
      const bottom = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.05, 0.12),
        new THREE.MeshStandardMaterial(),
      );
      bottom.userData = {
        studio_semantic_role: "body",
        studio_material_field_key: "bottom_color",
        studio_surface_finish: finish,
      };
      const steel = new THREE.MeshStandardMaterial({
        metalness: 1,
        roughness: 0.23,
      });
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(), steel);
      bowl.userData.studio_semantic_role = "hardware";
      model.add(top, bottom, bowl);
      const positions = Array.from(top.geometry.getAttribute("position").array);
      styleStudioModel(
        model,
        "#ffffff",
        "#ffffff",
        { top_color: "#ae835b", bottom_color: "#7d6556" },
        "matte-stand",
      );
      expect(bowl.material).toBe(steel);
      const topMaterial = top.material as ReturnType<typeof createStudioMaterial>;
      const bottomMaterial = bottom.material as ReturnType<
        typeof createStudioMaterial
      >;
      expect(topMaterial.color.getHexString()).toBe("ae835b");
      expect(bottomMaterial.color.getHexString()).toBe("7d6556");
      expect(topMaterial.roughness).toBe(0.76);
      expect(topMaterial.metalness).toBe(0);
      expect(topMaterial.userData.studioFuzzyEnabled).toBe(true);
      expect(
        new Set(top.geometry.getAttribute("studioFuzzyMask").array),
      ).toEqual(new Set([1]));
      expect(Array.from(top.geometry.getAttribute("position").array)).toEqual(
        positions,
      );
      const shader = {
        uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),
        vertexShader: THREE.ShaderLib.standard.vertexShader,
        fragmentShader: THREE.ShaderLib.standard.fragmentShader,
      };
      topMaterial.onBeforeCompile(
        shader as Parameters<typeof topMaterial.onBeforeCompile>[0],
        {} as THREE.WebGLRenderer,
      );
      expect(shader.uniforms.uFuzzyThickness.value).toBe(0.000025);
      expect(shader.uniforms.uFuzzyNormalStrength.value).toBe(0.3);
      expect(topMaterial.customProgramCacheKey()).not.toBe(
        createStudioMaterial("#ae835b").customProgramCacheKey(),
      );
    },
  );

  it("preserves the authored steel on hardware without a configurable color", () => {
    const steel = new THREE.MeshStandardMaterial({
      color: "#bcc0c4",
      metalness: 1,
      roughness: 0.23,
    });
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(), steel);
    bowl.userData.studio_semantic_role = "hardware";
    styleStudioModel(bowl, "#ae835b", "#7d6556");
    expect(bowl.material).toBe(steel);
  });

  it("preserves both colors of a multi-primitive flower under its authored hardware group", () => {
    const flower = new THREE.Group();
    flower.userData.studio_semantic_role = "hardware";
    const petals = new THREE.Mesh(
      new THREE.SphereGeometry(),
      new THREE.MeshStandardMaterial({ color: "#ed87b3" }),
    );
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(),
      new THREE.MeshStandardMaterial({ color: "#f4d263" }),
    );
    flower.add(petals, center);
    const original = [petals.material, center.material];
    styleStudioModel(flower, "#ffffff", "#ffffff");
    expect(petals.material).toBe(original[0]);
    expect(center.material).toBe(original[1]);
    styleStudioModel(flower, "#88ccaa", "#88ccaa");
    expect(petals.material).toBe(original[0]);
    expect(center.material).toBe(original[1]);
  });

  it("allows explicit child colors inside hardware and does not inherit outside the model", () => {
    const hardware = new THREE.Group();
    hardware.userData.studio_semantic_role = "hardware";
    const mapped = new THREE.Mesh(
      new THREE.SphereGeometry(),
      new THREE.MeshStandardMaterial(),
    );
    mapped.userData.studio_material_field_key = "rope_color";
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(),
      new THREE.MeshStandardMaterial(),
    );
    body.userData.studio_semantic_role = "body";
    hardware.add(mapped, body);
    styleStudioModel(hardware, "#88ccaa", "#ffffff", {
      rope_color: "#ed87b3",
    });
    expect(
      (mapped.material as THREE.MeshStandardMaterial).color.getHexString(),
    ).toBe("ed87b3");
    expect(
      (body.material as THREE.MeshStandardMaterial).color.getHexString(),
    ).toBe("88ccaa");

    const model = new THREE.Group();
    const untagged = new THREE.Mesh(
      new THREE.SphereGeometry(),
      new THREE.MeshStandardMaterial(),
    );
    model.add(untagged);
    hardware.add(model);
    styleStudioModel(model, "#88ccaa", "#ffffff");
    expect(
      (untagged.material as THREE.MeshStandardMaterial).color.getHexString(),
    ).toBe("88ccaa");
  });

  it("switches optional parts without changing the model pose or other parts", () => {
    const model = new THREE.Group();
    const bowl = new THREE.Mesh();
    bowl.userData.studio_visible_variant_skus = ["WITH-BOWL"];
    const body = new THREE.Mesh();
    const ignored = new THREE.Mesh();
    ignored.userData.studio_semantic_role = "ignore";
    ignored.userData.studio_visible_variant_skus = ["WITH-BOWL"];
    model.add(body, bowl, ignored);
    model.rotation.y = 0.75;
    updateModelVariant(model, "WITHOUT-BOWL");
    expect(bowl.visible).toBe(false);
    expect(body.visible).toBe(true);
    updateModelVariant(model, "WITH-BOWL");
    expect(bowl.visible).toBe(true);
    expect(ignored.visible).toBe(false);
    expect(model.rotation.y).toBe(0.75);
    updateModelVariant(model, "WITHOUT-BOWL");
    updateModelVariant(model);
    expect(bowl.visible).toBe(true);
    expect(ignored.visible).toBe(false);
  });

  it.each([
    { filter: undefined },
    { filter: [] },
    { filter: "WITH-BOWL" },
    { filter: [1] },
  ])("ignores absent or malformed variant filters: $filter", ({ filter }) => {
    const mesh = new THREE.Mesh();
    mesh.userData.studio_visible_variant_skus = filter;
    updateModelVariant(mesh, "WITHOUT-BOWL");
    expect(mesh.visible).toBe(true);
  });

  it.each([
    [242, 122, 55.1, 180],
    [40, 40, 80, 0],
  ])("centers a %s x %s x %s model in the preview camera", (x, y, z, rotation) => {
    const model = new THREE.Mesh(new THREE.BoxGeometry(x, y, z));
    const presentation = preparePresentation(model, rotation);
    const center = new THREE.Box3()
      .setFromObject(presentation)
      .getCenter(new THREE.Vector3());
    const camera = new THREE.OrthographicCamera();
    configureStudioCamera(camera, 1, center.y);
    camera.updateMatrixWorld(true);
    const screenCenter = center.clone().project(camera);
    expect(screenCenter.x).toBeCloseTo(0, 5);
    expect(screenCenter.y).toBeCloseTo(0, 5);
  });

  it("uses physical matte polymer shading and preserves live warehouse colors", () => {
    const material = createStudioMaterial("#c7683c");

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.userData.studioShader).toBe("studio-pbr-v1");
    expect(material.color.getHexString()).toBe("c7683c");
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBeGreaterThanOrEqual(0.7);
    expect(material.roughness).toBeLessThan(1);
    expect(material.emissive.getHexString()).toBe("000000");
    expect(material.toneMapped).toBe(true);

    updateMaterialColor(material, "#23352b");
    expect(material.color.getHexString()).toBe("23352b");
    expect(material.userData.studioColor).toBe("#23352b");
  });

  it("gives smooth parts a softer satin finish than the fuzzy printed body", () => {
    const fuzzy = createStudioMaterial("#c7683c", true);
    const smooth = createStudioMaterial("#c7683c", false);

    expect(smooth.roughness).toBeGreaterThanOrEqual(0.4);
    expect(smooth.roughness).toBeLessThan(fuzzy.roughness);
    expect(smooth.metalness).toBe(0);
    expect(smooth.userData.studioFuzzyEnabled).toBe(false);
  });

  it.each([
    ["hardware_finish", "hardware", 0.88, 0.22, "#d4a24c"],
    ["clip_finish", "hardware", 0.94, 0.18, "#c0c5c9"],
    ["rope_color", "other", 0, 0.76, "#665247"],
  ] as const)(
    "preserves authored %s surface response with live warehouse color",
    (field, role, metalness, roughness, color) => {
      const sourceMaterial = new THREE.MeshStandardMaterial({
        color: "#ffffff",
        metalness,
        roughness,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial);
      mesh.userData.studio_material_field_key = field;
      mesh.userData.studio_semantic_role = role;
      mesh.userData.studio_surface_finish = "smooth";

      styleStudioModel(mesh, "#c7683c", "#d7c6a5", { [field]: color });

      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.metalness).toBe(metalness);
      expect(material.roughness).toBe(roughness);
      expect(material.color.getHexString()).toBe(color.slice(1));
      expect(material.userData.studioFuzzyEnabled).toBe(false);
      updateMaterialColor(material as ReturnType<typeof createStudioMaterial>, "#23352b");
      expect(material.color.getHexString()).toBe("23352b");
      expect(material.metalness).toBe(metalness);
      expect(material.roughness).toBe(roughness);
      expect(sourceMaterial.color.getHexString()).toBe("ffffff");
    },
  );

  it("does not add outline geometry around physical product meshes", () => {
    const model = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const body = new THREE.Mesh(geometry);
    body.name = "body";
    const positions = Array.from(geometry.getAttribute("position").array);
    model.add(body);

    styleStudioModel(model, "#c7683c", "#d7c6a5");

    expect(body.children).toHaveLength(0);
    expect(body.geometry).toBe(geometry);
    expect(Array.from(geometry.getAttribute("position").array)).toEqual(
      positions,
    );
    expect(body.material).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it("keeps the standard lighting pipeline when adding normal-only fuzzy grain", () => {
    const material = createStudioMaterial("#c7683c");
    const shader = {
      uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };

    material.onBeforeCompile(
      shader as Parameters<typeof material.onBeforeCompile>[0],
      {} as THREE.WebGLRenderer,
    );

    expect(shader.vertexShader).toContain("vStudioFuzzyMask");
    expect(shader.fragmentShader).toContain("vStudioFuzzyMask");
    expect(shader.fragmentShader).toContain(
      "#include <lights_physical_fragment>",
    );
    expect(shader.fragmentShader).toContain("#include <tonemapping_fragment>");
    expect(shader.fragmentShader).toContain("#include <colorspace_fragment>");
    expect(shader.fragmentShader).not.toContain("studioLight");
    expect(shader.fragmentShader).not.toContain("cavityShade");
    expect(shader.fragmentShader).not.toContain("uStudioPaper");
    expect(material.customProgramCacheKey()).not.toBe(
      createStudioMaterial("#c7683c", false).customProgramCacheKey(),
    );
  });

  it("keeps raised cylindrical relief smooth while texturing the base wall", () => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI) / 4;
      positions.push(Math.cos(angle) * 0.02, Math.sin(angle) * 0.02, index * 0.001);
      normals.push(Math.cos(angle), Math.sin(angle), 0);
    }
    positions.push(0.0205, 0, 0.004);
    normals.push(1, 0, 0);
    const capIndex = positions.length / 3;
    positions.push(0.01, 0, 0.012);
    normals.push(0, 0, 1);
    const innerWallIndex = positions.length / 3;
    positions.push(0.015, 0, 0.006);
    normals.push(-1, 0, 0);
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));

    addFuzzyMaskAttribute(geometry, true);

    const mask = geometry.getAttribute("studioFuzzyMask");
    expect(mask.getX(0)).toBeCloseTo(1);
    expect(mask.getX(8)).toBeCloseTo(0);
    expect(mask.getX(capIndex)).toBeCloseTo(1);
    expect(mask.getX(innerWallIndex)).toBeCloseTo(0);
  });

  it("textures exposed cap faces without covering inward or recessed surfaces", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -0.01, -0.01, 0, 0.01, 0.01, 0.01, 0, 0, 0.01, 0, 0, 0, 0, 0, 0.009,
          0, 0, 0.001, 0.005, 0, 0.01, 0.005, 0, 0,
        ],
        3,
      ),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(
        [
          0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0,
          0, 1,
        ],
        3,
      ),
    );

    addFuzzyMaskAttribute(geometry, true);

    const mask = geometry.getAttribute("studioFuzzyMask");
    for (const index of [0, 1, 2, 3]) expect(mask.getX(index)).toBeCloseTo(1);
    for (const index of [4, 5, 6, 7]) expect(mask.getX(index)).toBeCloseTo(0);
  });

  it("keeps grain on a stepped lid's outer band instead of treating it as raised decoration", () => {
    const positions: number[] = [];
    const normals: number[] = [];
    const bandIndexes: number[] = [];
    for (let segment = 0; segment < 24; segment += 1) {
      const angle = (segment * Math.PI * 2) / 24;
      for (const [radius, heights] of [
        [0.0165, [0.033, 0.038]],
        [0.02125, [0.038, 0.048]],
      ] as const) {
        for (const z of heights) {
          if (radius === 0.02125) bandIndexes.push(positions.length / 3);
          positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
          normals.push(Math.cos(angle), Math.sin(angle), 0);
        }
      }
    }
    const capIndex = positions.length / 3;
    positions.push(0, 0, 0.049);
    normals.push(0, 0, 1);
    const innerWallIndex = positions.length / 3;
    positions.push(0.015, 0, 0.04);
    normals.push(-1, 0, 0);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    const lid = new THREE.Mesh(geometry);
    lid.userData = {
      studio_semantic_role: "lid",
      studio_surface_finish: "fuzzy",
    };

    styleStudioModel(lid, "#98e4f2", "#ffc885");

    const mask = geometry.getAttribute("studioFuzzyMask");
    for (const index of bandIndexes) expect(mask.getX(index)).toBeGreaterThan(0.95);
    expect(mask.getX(capIndex)).toBeCloseTo(1);
    expect(mask.getX(innerWallIndex)).toBeCloseTo(0);
    const material = lid.material as ReturnType<typeof createStudioMaterial>;
    expect(material.userData.studioFuzzyEnabled).toBe(true);
    expect(material.color.getHexString()).toBe("ffc885");
    expect(Array.from(geometry.getAttribute("position").array)).toEqual(
      Array.from(new Float32Array(positions)),
    );
  });

  it("wraps fuzzy skin around an asymmetric high-poly cylinder while keeping relief smooth", () => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const wallIndexes: number[] = [];
    const segmentCount = 24;

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const angle = (segment * Math.PI * 2) / segmentCount;
      for (const height of [0, 0.03]) {
        wallIndexes.push(positions.length / 3);
        positions.push(Math.cos(angle) * 0.02, Math.sin(angle) * 0.02, height);
        normals.push(Math.cos(angle), Math.sin(angle), 0);
      }
    }

    const reliefIndexes: number[] = [];
    for (let duplicate = 0; duplicate < 96; duplicate += 1) {
      const angle = ((duplicate % 5) - 2) * (Math.PI / 180);
      reliefIndexes.push(positions.length / 3);
      positions.push(
        Math.cos(angle) * 0.0205,
        Math.sin(angle) * 0.0205,
        0.008 + (duplicate % 12) * 0.001,
      );
      normals.push(Math.cos(angle), Math.sin(angle), 0);
    }
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));

    addFuzzyMaskAttribute(geometry, true);

    const mask = geometry.getAttribute("studioFuzzyMask");
    for (const index of wallIndexes) expect(mask.getX(index)).toBeGreaterThan(0.95);
    for (const index of reliefIndexes) expect(mask.getX(index)).toBeLessThan(0.05);
  });

  it("uses fine multi-scale classic noise without changing the physical profile limits", () => {
    const material = createStudioMaterial("#c7683c");
    const shader = {
      uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(
      shader as Parameters<typeof material.onBeforeCompile>[0],
      {} as THREE.WebGLRenderer,
    );
    const noiseSamples = shader.fragmentShader.match(/classicNoise\(/g) ?? [];

    expect(noiseSamples.length).toBeGreaterThanOrEqual(4);
    expect(shader.uniforms.uFuzzyPointDistance.value).toBe(0.001);
    expect(shader.uniforms.uFuzzyThickness.value).toBe(0.00008);
  });

  it("honors an explicitly smooth assembly part", () => {
    const model = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 16));
    body.userData.studio_semantic_role = "body";
    body.userData.studio_surface_finish = "smooth";
    model.add(body);

    styleStudioModel(model, "#c7683c", "#d7c6a5");

    const material = body.material as ReturnType<typeof createStudioMaterial>;
    expect(material.userData.studioFuzzyEnabled).toBe(false);
    expect(material.roughness).toBe(0.48);
  });

  it("turns the Z-up model into a centered standing presentation", () => {
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08)));

    const presentation = preparePresentation(model);
    const bounds = new THREE.Box3().setFromObject(presentation);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());

    expect(size.y).toBeCloseTo(1.5, 5);
    expect(size.y).toBeGreaterThan(size.x * 1.8);
    expect(size.y).toBeGreaterThan(size.z * 1.8);
    expect(center.x).toBeCloseTo(0, 5);
    expect(center.z).toBeCloseTo(0, 5);
    expect(bounds.min.y).toBeCloseTo(-0.72, 5);
  });

  it("corrects a Y-up source with a 90 degree source rotation before centering", () => {
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.02)));

    const presentation = preparePresentation(model, 90);
    const bounds = new THREE.Box3().setFromObject(presentation);
    const size = bounds.getSize(new THREE.Vector3());

    expect(size.y).toBeCloseTo(1.5, 5);
    expect(size.y).toBeGreaterThan(size.x * 1.8);
    expect(size.y).toBeGreaterThan(size.z * 3.5);
    expect(bounds.min.y).toBeCloseTo(-0.72, 5);
  });

  it("applies saved XYZ presentation orientation before upright yaw", () => {
    const model = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 3),
      new THREE.MeshBasicMaterial(),
    );
    const presentation = preparePresentation(model, 90, -45, 1);
    const source = presentation.getObjectByName("studio-source-z-to-y");
    expect(source?.rotation.x).toBeCloseTo(0);
    expect(source?.rotation.y).toBeCloseTo(THREE.MathUtils.degToRad(-45));
    expect(source?.rotation.z).toBeCloseTo(THREE.MathUtils.degToRad(1));
    const bounds = new THREE.Box3().setFromObject(presentation);
    expect(bounds.min.y).toBeCloseTo(-0.72, 5);
  });

  it("gives body and lid separate physical materials without outline shells", () => {
    const model = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1));
    body.name = "body";
    lid.name = "lid";
    model.add(body, lid);

    styleStudioModel(model, "#c7683c", "#d7c6a5");

    expect(body.children).toHaveLength(0);
    expect(lid.children).toHaveLength(0);
    expect(body.material).not.toBe(lid.material);
    expect(
      (body.material as THREE.MeshStandardMaterial).color.getHexString(),
    ).toBe("c7683c");
    expect((lid.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(
      "d7c6a5",
    );
  });

  it("uses the mapped material field before falling back to body and lid names", () => {
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.name = "custom-display-name";
    mesh.userData.studio_material_field_key = "lid_color";
    model.add(mesh);

    styleStudioModel(model, "#c7683c", "#d7c6a5", { lid_color: "#123456" });

    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.color.getHexString()).toBe("123456");
  });

  it("uses semantic roles for custom names and removes ignored geometry", () => {
    const model = new THREE.Group();
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const ignored = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    lid.name = "Threaded lid";
    lid.userData.studio_semantic_role = "lid";
    ignored.name = "Helper geometry";
    ignored.userData.studio_semantic_role = "ignore";
    model.add(lid, ignored);

    styleStudioModel(model, "#c7683c", "#d7c6a5");

    const lidMaterial = lid.material as THREE.MeshStandardMaterial;
    expect(lidMaterial.color.getHexString()).toBe("d7c6a5");
    expect(lid.children).toHaveLength(0);
    expect(ignored.visible).toBe(false);
    expect(ignored.children).toHaveLength(0);
  });
});
