import { describe, expect, it } from "vitest";
import {
  isStudioRenderSettings,
  studioRenderControls,
  studioRenderPresets,
} from "../src/render-settings.js";

describe("studio render settings", () => {
  it("accepts a complete settings value and the optional controls", () => {
    expect(isStudioRenderSettings(studioRenderPresets.matte.settings)).toBe(true);
    expect(isStudioRenderSettings(studioRenderPresets.soft.settings)).toBe(true);
    expect(isStudioRenderSettings(studioRenderPresets.satin.settings)).toBe(true);
  });

  it("rejects missing, out-of-range and non-numeric values", () => {
    expect(isStudioRenderSettings(null)).toBe(false);
    expect(isStudioRenderSettings("settings")).toBe(false);
    expect(
      isStudioRenderSettings({ ...studioRenderPresets.matte.settings, key: -1 }),
    ).toBe(false);
    expect(
      isStudioRenderSettings({
        ...studioRenderPresets.matte.settings,
        grain: Number.NaN,
      }),
    ).toBe(false);
    expect(
      isStudioRenderSettings({
        ...studioRenderPresets.matte.settings,
        exposure: "high",
      }),
    ).toBe(false);
  });

  it("publishes controls for every render key with an ordered range", () => {
    const keys = studioRenderControls.map((control) => control.key);
    expect(new Set(keys).size).toBe(studioRenderControls.length);
    for (const control of studioRenderControls) {
      expect(control.min).toBeLessThan(control.max);
      expect(control.label.length).toBeGreaterThan(0);
    }
    expect(keys).toContain("ao_radius");
  });
});
