import type { StudioRenderSettings } from "./render-settings.js";

/**
 * Validated description of one server-rendered configuration preview.
 */
export type StudioPreviewManifest = {
  version: 1;
  kind: "three_js";
  output: {
    width: 640;
    height: 640;
    device_pixel_ratio: 1;
    camera: "product-v1";
    background: string;
  };
  assets: Array<{
    id: string;
    role: string;
    path: string;
    content_hash: string;
    z_order: number;
  }>;
  colors: Array<{ slot: string; hex: string }>;
  presentation: {
    rotation_x: number;
    rotation_y: number;
    rotation_z: number;
    render_settings?: StudioRenderSettings;
  };
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const tokenPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const hashPattern = /^[0-9a-f]{64}$/;
const colorPattern = /^#[0-9A-F]{6}$/;

/**
 * Parses and validates a configuration preview manifest. The parser rejects
 * every field that does not match the expected value, every asset path outside
 * `/media/` or `/models/`, and every malformed asset, color or rotation. It
 * throws an `Error` when the value is invalid.
 */
export function parseConfigurationPreviewManifest(
  value: unknown,
): StudioPreviewManifest {
  if (!value || typeof value !== "object")
    throw new Error("invalid preview manifest");
  const manifest = value as Partial<StudioPreviewManifest>;
  if (
    manifest.version !== 1 ||
    manifest.kind !== "three_js" ||
    !manifest.output ||
    manifest.output.width !== 640 ||
    manifest.output.height !== 640 ||
    manifest.output.device_pixel_ratio !== 1 ||
    manifest.output.camera !== "product-v1" ||
    !colorPattern.test(manifest.output.background ?? "") ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length === 0 ||
    !Array.isArray(manifest.colors) ||
    !manifest.presentation
  ) {
    throw new Error("invalid preview manifest");
  }
  for (const asset of manifest.assets) {
    if (
      !uuidPattern.test(asset.id) ||
      !tokenPattern.test(asset.role) ||
      !(asset.path.startsWith("/media/") || asset.path.startsWith("/models/")) ||
      asset.path.includes("..") ||
      asset.path.includes("\\") ||
      asset.path.includes("?") ||
      !hashPattern.test(asset.content_hash) ||
      !Number.isInteger(asset.z_order)
    ) {
      throw new Error("invalid preview asset");
    }
  }
  for (const color of manifest.colors) {
    if (!tokenPattern.test(color.slot) || !colorPattern.test(color.hex)) {
      throw new Error("invalid preview color");
    }
  }
  for (const rotation of [
    manifest.presentation.rotation_x,
    manifest.presentation.rotation_y,
    manifest.presentation.rotation_z,
  ]) {
    if (!Number.isInteger(rotation) || rotation < -360 || rotation > 360) {
      throw new Error("invalid preview rotation");
    }
  }
  return manifest as StudioPreviewManifest;
}

/**
 * Converts the manifest color entries into the `materialColors` record that
 * {@link styleStudioModel} expects.
 */
export function configurationPreviewMaterialColors(
  manifest: StudioPreviewManifest,
): Record<string, string> {
  return Object.fromEntries(
    manifest.colors.map((color) => [color.slot, color.hex]),
  );
}
