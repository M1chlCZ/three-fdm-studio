import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";
import { studioLighting } from "../src/materials.js";
import { previewRenderQuality } from "../src/StudioViewer.js";

const componentSource = readFileSync(
  new URL("../src/StudioViewer.tsx", import.meta.url),
  "utf8",
);
const stylesSource = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf8",
);

describe("studio viewer pipeline", () => {
  it("uses restrained environment fill and a directional key to reveal depth", () => {
    expect(studioLighting().environment).toBeLessThanOrEqual(0.7);
    expect(componentSource).toContain("scene.environmentIntensity");
    expect(componentSource).toContain("new THREE.DirectionalLight");
    expect(componentSource).toContain("scene.add(keyLight)");
  });

  it("wires the presentation profile into lighting and materials without adding a postprocessing pass", () => {
    expect(componentSource).toContain("studioLighting(presentationProfile)");
    expect(componentSource).toContain("styleStudioModel(");
    expect(componentSource).toContain("presentationProfile,");
    expect(componentSource).toContain(
      "updateModelFinishes(model, materialFinishesRef.current)",
    );
    expect(componentSource).toContain(
      "radius: renderSettingsRef.current?.ao_radius || lighting.aoRadius",
    );
    expect(componentSource).toContain(
      "ambientOcclusion.blendIntensity = lighting.aoIntensity",
    );
  });

  it("initializes and attaches the studio softbox", () => {
    expect(componentSource).toContain("RectAreaLightUniformsLib.init()");
    expect(componentSource).toContain("new THREE.RectAreaLight");
    expect(componentSource).toContain("scene.add(softbox)");
  });

  it("uses a caller-supplied HDR studio with a room environment fallback", () => {
    expect(componentSource).toContain("new HDRLoader()");
    expect(componentSource).toContain("environmentUrl");
    expect(componentSource).toContain("RoomEnvironment");
    const exposure = Number(
      componentSource.match(/renderer\.toneMappingExposure = ([\d.]+);/)?.[1],
    );
    expect(exposure).toBeGreaterThanOrEqual(0.5);
    expect(exposure).toBeLessThan(0.85);
    expect(componentSource).toContain("!lightingReady");
    expect(componentSource.match(/showReadyPreview\(\);/g)).toHaveLength(2);
  });

  it("uses a muted paper backdrop without a bright technical grid", () => {
    expect(stylesSource).not.toContain("repeating-linear-gradient");
    expect(stylesSource).not.toContain("rgba(255, 255, 255, 0.9)");
  });

  it("applies one lightweight FXAA pass after display conversion and disposes it", () => {
    expect(componentSource).toContain("new FXAAPass()");
    const passes = [...componentSource.matchAll(/composer\.addPass\(([^;]+)\);/g)].map(
      (match) => match[1],
    );
    expect(passes).toEqual([
      "new RenderPass(scene, camera)",
      "ambientOcclusion",
      "outputPass",
      "antialiasPass",
    ]);
    expect(componentSource).toContain("antialiasPass?.dispose()");
  });

  it("tracks the composer's physical pixel dimensions when resized or expanded", () => {
    const pass = new FXAAPass();
    try {
      pass.setSize(600, 400);
      expect(pass.uniforms.resolution.value.toArray()).toEqual([1 / 600, 1 / 400]);
      pass.setSize(1400, 1050);
      expect(pass.uniforms.resolution.value.toArray()).toEqual([
        1 / 1400,
        1 / 1050,
      ]);
    } finally {
      pass.dispose();
    }
  });

  it("caps the pixel ratio and reserves ambient occlusion samples for expansion", () => {
    expect(previewRenderQuality(false, 3)).toEqual({
      pixelRatio: 1.25,
      aoSamples: 12,
    });
    expect(previewRenderQuality(true, 3)).toEqual({
      pixelRatio: 1.75,
      aoSamples: 24,
    });
    expect(previewRenderQuality(false, 1)).toEqual({
      pixelRatio: 1,
      aoSamples: 12,
    });
  });
});
