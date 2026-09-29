import { describe, expect, it } from "vitest";
import {
  configurationPreviewMaterialColors,
  parseConfigurationPreviewManifest,
} from "../src/manifest.js";

const validManifest = {
  version: 1,
  kind: "three_js",
  output: {
    width: 640,
    height: 640,
    device_pixel_ratio: 1,
    camera: "product-v1",
    background: "#FFFFFF",
  },
  assets: [
    {
      id: "8a1f4f60-6c9e-4b7e-9a0c-4f2d1f6e5a3b",
      role: "model",
      path: "/models/example.glb",
      content_hash: "a".repeat(64),
      z_order: 0,
    },
  ],
  colors: [{ slot: "body_color", hex: "#C7683C" }],
  presentation: { rotation_x: 0, rotation_y: 0, rotation_z: 0 },
};

describe("configuration preview manifest", () => {
  it("accepts a valid manifest and converts the color entries", () => {
    const manifest = parseConfigurationPreviewManifest(validManifest);
    expect(manifest.assets).toHaveLength(1);
    expect(configurationPreviewMaterialColors(manifest)).toEqual({
      body_color: "#C7683C",
    });
  });

  it.each([
    null,
    {},
    { ...validManifest, version: 2 },
    { ...validManifest, kind: "webgl" },
    { ...validManifest, assets: [] },
    {
      ...validManifest,
      assets: [{ ...validManifest.assets[0], path: "/private/example.glb" }],
    },
    {
      ...validManifest,
      assets: [{ ...validManifest.assets[0], path: "/models/../secret.glb" }],
    },
    { ...validManifest, colors: [{ slot: "body_color", hex: "#ffffff" }] },
    { ...validManifest, presentation: { rotation_x: 0, rotation_y: 0, rotation_z: 361 } },
  ])("rejects an invalid manifest %j", (value) => {
    expect(() => parseConfigurationPreviewManifest(value)).toThrow();
  });
});
