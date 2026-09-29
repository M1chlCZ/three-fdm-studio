import { describe, expect, it } from "vitest";
import {
  STUDIO_GLOW_MATERIAL_FIELDS,
  STUDIO_SEMANTIC_ROLES,
} from "../src/user-data.js";

describe("user data constants", () => {
  it("declares the semantic roles used by model exporters", () => {
    expect(Object.values(STUDIO_SEMANTIC_ROLES).sort()).toEqual([
      "body",
      "hardware",
      "ignore",
      "lid",
    ]);
  });

  it("declares the glow material fields", () => {
    expect(STUDIO_GLOW_MATERIAL_FIELDS).toEqual([
      "back_color",
      "middle_color",
      "front_color",
    ]);
  });
});
