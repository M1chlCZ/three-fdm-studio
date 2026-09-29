/**
 * Render settings that drive the studio exposure, the lights, the ambient
 * occlusion and the printed material. The package defines the type locally so
 * that it stays independent of any generated API schema.
 */
export type StudioRenderSettings = {
  roughness: number;
  metalness: number;
  grain: number;
  exposure: number;
  environment: number;
  key: number;
  fill: number;
  occlusion: number;
  color_response?: number;
  softness?: number;
  ao_radius?: number;
};

/**
 * A numeric key of {@link StudioRenderSettings}.
 */
export type StudioRenderSettingKey = keyof StudioRenderSettings;

/**
 * The editable render controls with their display labels and valid ranges.
 */
export const studioRenderControls: {
  key: StudioRenderSettingKey;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: "roughness", label: "Roughness · matte", min: 0, max: 1 },
  { key: "metalness", label: "Metal gloss", min: 0, max: 1 },
  { key: "grain", label: "Print grain strength", min: 0, max: 1 },
  { key: "exposure", label: "Exposure", min: 0.1, max: 2 },
  { key: "environment", label: "Environment light", min: 0, max: 3 },
  { key: "key", label: "Key light", min: 0, max: 6 },
  { key: "fill", label: "Soft fill light", min: 0, max: 6 },
  { key: "occlusion", label: "Cavity shadows", min: 0, max: 1 },
  { key: "color_response", label: "Light-color protection", min: 0, max: 1 },
  { key: "softness", label: "Lighting softness", min: 0, max: 1 },
  { key: "ao_radius", label: "Cavity shadow reach", min: 0, max: 0.2 },
];

/**
 * Checks that a value contains every required range of
 * {@link studioRenderControls}. The optional controls `color_response`,
 * `softness` and `ao_radius` may be absent.
 */
export function isStudioRenderSettings(
  value: unknown,
): value is StudioRenderSettings {
  if (typeof value !== "object" || value === null) return false;
  return studioRenderControls.every(({ key, min, max }) => {
    const number = (value as Record<string, unknown>)[key];
    if (
      number === undefined &&
      ["color_response", "softness", "ao_radius"].includes(key)
    )
      return true;
    return (
      typeof number === "number" &&
      Number.isFinite(number) &&
      number >= min &&
      number <= max
    );
  });
}

/**
 * Starting points for the render controls. Each model stores its own editable
 * values, so the presets are never applied automatically.
 */
export const studioRenderPresets: Record<
  string,
  { label: string; settings: StudioRenderSettings }
> = {
  soft: {
    label: "Soft studio · all shades",
    settings: {
      roughness: 0.68,
      metalness: 0,
      grain: 0.15,
      exposure: 0.9,
      environment: 0.8,
      key: 2.2,
      fill: 2,
      occlusion: 0.3,
      color_response: 0.6,
      softness: 0.9,
      ao_radius: 0.05,
    },
  },
  matte: {
    label: "Matte print · studio",
    settings: {
      roughness: 0.62,
      metalness: 0,
      grain: 0.25,
      exposure: 0.9,
      environment: 0.8,
      key: 2.2,
      fill: 2,
      occlusion: 0.45,
    },
  },
  satin: {
    label: "Smooth plastic",
    settings: {
      roughness: 0.38,
      metalness: 0,
      grain: 0,
      exposure: 0.85,
      environment: 0.8,
      key: 2,
      fill: 1.5,
      occlusion: 0.5,
    },
  },
};
