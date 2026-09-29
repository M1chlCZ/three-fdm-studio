// @vitest-environment happy-dom

import { act } from "react";
import { readFileSync } from "node:fs";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STUDIO_INTRO_ROTATION_MS,
  StudioViewer,
  glowDemoDarkness,
  introYawOffset,
} from "../src/StudioViewer.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let container: HTMLDivElement;
let root: Root;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("StudioViewer", () => {
  it("styles the glow disclaimer as quiet text rather than a button badge", () => {
    const css = readFileSync("styles.css", "utf8");
    const note = css.match(/\.tfs-glow-controls span\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(note).not.toMatch(/background|border-radius|padding/);
    expect(note).toMatch(/color:/);
  });

  it("fades into a bounded glow demonstration and returns to daylight", () => {
    expect(glowDemoDarkness(0)).toBe(0);
    expect(glowDemoDarkness(1000)).toBeGreaterThan(0);
    expect(glowDemoDarkness(1000)).toBeLessThan(1);
    expect(glowDemoDarkness(2000)).toBe(1);
    expect(glowDemoDarkness(3500)).toBe(1);
    expect(glowDemoDarkness(6000)).toBe(0);
    expect(glowDemoDarkness(100000)).toBe(0);
  });

  it("eases every model through the same entrance turn and respects reduced motion", () => {
    expect(STUDIO_INTRO_ROTATION_MS).toBe(720);
    expect(introYawOffset(0, false)).toBe(-120);
    expect(introYawOffset(STUDIO_INTRO_ROTATION_MS / 2, false)).toBeCloseTo(-15);
    expect(introYawOffset(STUDIO_INTRO_ROTATION_MS, false)).toBe(0);
    expect(introYawOffset(0, true)).toBe(0);
  });

  it("keeps body and lid colors live in the standing vector fallback", async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
    const fallback =
      '<svg viewBox="-256 -256 512 512"><path class="body band-2"/><path class="lid band-2"/></svg>';
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(fallback, {
            status: 200,
            headers: {
              "Content-Length": String(fallback.length),
              "Content-Type": "image/svg+xml",
            },
          }),
      ),
    );

    await act(async () => {
      root.render(
        <StudioViewer
          src="/models/sample.glb"
          fallbackSrc="/models/sample.svg"
          alt="Sample product preview"
          bodyColor="#c7683c"
          lidColor="#d7c6a5"
          loadingLabel="Loading 3D preview…"
          fallbackLabel="3D preview is unavailable"
          rotationLabel="Rotate product horizontally"
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const preview = container.querySelector<HTMLElement>("[role=group]");
    expect(preview?.getAttribute("aria-label")).toBe("Sample product preview");
    expect(preview?.dataset.renderMode).toBe("fallback");
    expect(preview?.style.getPropertyValue("--tfs-body-2")).toBe("#c7683c");
    expect(preview?.style.getPropertyValue("--tfs-lid-2")).toBe("#d7c6a5");
    expect(preview?.querySelector("svg .body")).not.toBeNull();
    expect(preview?.querySelector("svg .lid")).not.toBeNull();
    expect(preview?.querySelector("img")).toBeNull();
  });

  it("rotates only around the upright yaw axis with pointer and keyboard input", async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
    const onActivate = vi.fn();
    await act(async () => {
      root.render(
        <StudioViewer
          src="/models/sample.glb"
          alt="Sample product preview"
          bodyColor="#c7683c"
          lidColor="#d7c6a5"
          loadingLabel="Loading 3D preview…"
          fallbackLabel="3D preview is unavailable"
          rotationLabel="Rotate product horizontally"
          onActivate={onActivate}
        />,
      );
      await Promise.resolve();
    });

    const canvas = container.querySelector("canvas");
    expect(canvas?.getAttribute("role")).toBe("slider");
    expect(canvas?.getAttribute("tabindex")).toBe("0");
    expect(canvas?.getAttribute("aria-label")).toBe(
      "Rotate product horizontally",
    );
    expect(canvas?.getAttribute("aria-valuenow")).toBe("0");
    expect(canvas?.closest("[data-studio-viewer]")).not.toBeNull();

    const pointer = (
      type: string,
      pointerId: number,
      clientX: number,
      clientY: number,
    ) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        pointerId: { value: pointerId },
        clientX: { value: clientX },
        clientY: { value: clientY },
      });
      return event;
    };
    act(() => {
      canvas?.dispatchEvent(pointer("pointerdown", 7, 100, 20));
      canvas?.dispatchEvent(pointer("pointermove", 7, 100, 140));
    });
    expect(canvas?.getAttribute("aria-valuenow")).toBe("0");

    act(() => canvas?.dispatchEvent(pointer("pointermove", 7, 160, 140)));
    const draggedYaw = Number(canvas?.getAttribute("aria-valuenow"));
    expect(draggedYaw).not.toBe(0);

    act(() =>
      canvas?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      ),
    );
    expect(Number(canvas?.getAttribute("aria-valuenow"))).toBeLessThan(draggedYaw);
    act(() =>
      canvas?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
      ),
    );
    expect(canvas?.getAttribute("aria-valuenow")).toBe("0");

    act(() => {
      canvas?.dispatchEvent(pointer("pointerdown", 8, 100, 20));
      canvas?.dispatchEvent(pointer("pointerup", 8, 103, 20));
    });
    expect(onActivate).toHaveBeenCalledTimes(1);

    act(() => {
      canvas?.dispatchEvent(pointer("pointerdown", 9, 100, 20));
      canvas?.dispatchEvent(pointer("pointermove", 9, 112, 20));
      canvas?.dispatchEvent(pointer("pointerup", 9, 112, 20));
    });
    expect(onActivate).toHaveBeenCalledTimes(1);

    act(() => {
      canvas?.dispatchEvent(pointer("pointerdown", 10, 100, 20));
      canvas?.dispatchEvent(pointer("pointerup", 10, 140, 20));
    });
    expect(onActivate).toHaveBeenCalledTimes(1);
    act(() =>
      canvas?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(onActivate).toHaveBeenCalledTimes(2);
  });
});
