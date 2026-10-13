// @vitest-environment happy-dom

import { act, createRef } from "react";
import { readFileSync } from "node:fs";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STUDIO_INTRO_ROTATION_MS,
  StudioViewer,
  glowDemoDarkness,
  introYawOffset,
  type StudioViewerHandle,
  type StudioViewerProps,
} from "../src/StudioViewer.js";

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class FakePMREMGenerator {
    fromScene() {
      return { texture: new actual.Texture(), dispose: () => undefined };
    }
    fromEquirectangular() {
      return { texture: new actual.Texture(), dispose: () => undefined };
    }
    dispose() {}
  }
  class FakeWebGLRenderer {
    domElement: HTMLCanvasElement;
    outputColorSpace: string;
    toneMapping: number;
    toneMappingExposure = 1;
    private pixelRatio = 1;
    private width = 0;
    private height = 0;
    private clearColor: InstanceType<typeof actual.Color>;
    private clearAlpha = 0;
    constructor({ canvas }: { canvas: HTMLCanvasElement }) {
      if (!canvas.getContext("webgl2") && !canvas.getContext("webgl")) {
        throw new Error("Error creating WebGL context.");
      }
      this.domElement = canvas;
      this.outputColorSpace = actual.SRGBColorSpace;
      this.toneMapping = actual.NeutralToneMapping;
      this.clearColor = new actual.Color(0x000000);
    }
    setPixelRatio(value: number) {
      this.pixelRatio = value;
    }
    getPixelRatio() {
      return this.pixelRatio;
    }
    setSize(width: number, height: number, _updateStyle?: boolean) {
      this.width = width;
      this.height = height;
      this.domElement.width = Math.floor(width * this.pixelRatio);
      this.domElement.height = Math.floor(height * this.pixelRatio);
    }
    getSize(target: InstanceType<typeof actual.Vector2>) {
      return target.set(this.width, this.height);
    }
    setClearColor(color: InstanceType<typeof actual.Color>, alpha: number) {
      this.clearColor.copy(color);
      this.clearAlpha = alpha;
    }
    getClearColor(target: InstanceType<typeof actual.Color>) {
      return target.copy(this.clearColor);
    }
    getClearAlpha() {
      return this.clearAlpha;
    }
    dispose() {}
  }
  return {
    ...actual,
    PMREMGenerator: FakePMREMGenerator,
    WebGLRenderer: FakeWebGLRenderer,
  };
});

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", async () => {
  const THREE = await import("three");
  class FakeGLTFLoader {
    setDRACOLoader() {}
    load(
      _url: string,
      onLoad: (gltf: { scene: InstanceType<typeof THREE.Group> }) => void,
    ) {
      const scene = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1, 0.6),
        new THREE.MeshStandardMaterial(),
      );
      mesh.userData.studio_semantic_role = "body";
      scene.add(mesh);
      onLoad({ scene });
    }
  }
  return { GLTFLoader: FakeGLTFLoader };
});

vi.mock("three/examples/jsm/postprocessing/EffectComposer.js", () => ({
  EffectComposer: class {
    private pixelRatio = 1;
    addPass() {}
    insertPass() {}
    setSize() {}
    setPixelRatio(value: number) {
      this.pixelRatio = value;
    }
    getPixelRatio() {
      return this.pixelRatio;
    }
    render() {}
    dispose() {}
  },
}));

vi.mock("three/examples/jsm/postprocessing/GTAOPass.js", () => ({
  GTAOPass: class {
    blendIntensity = 0;
    updateGtaoMaterial() {}
    updatePdMaterial() {}
    dispose() {}
  },
}));

vi.mock("three/examples/jsm/postprocessing/RenderPass.js", () => ({
  RenderPass: class {},
}));

vi.mock("three/examples/jsm/postprocessing/OutputPass.js", () => ({
  OutputPass: class {
    dispose() {}
  },
}));

vi.mock("three/examples/jsm/postprocessing/FXAAPass.js", () => ({
  FXAAPass: class {
    dispose() {}
  },
}));

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
  vi.restoreAllMocks();
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

describe("StudioViewer thumbnail capture", () => {
  const capturedSizes: {
    width: number;
    height: number;
    type?: string;
    quality?: number;
  }[] = [];

  beforeEach(() => {
    capturedSizes.length = 0;
  });

  async function renderViewerWithHandle() {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => ({}),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (
        this: HTMLCanvasElement,
        callback: BlobCallback,
        type?: string,
        quality?: number,
      ) {
        capturedSizes.push({
          width: this.width,
          height: this.height,
          type,
          quality,
        });
        callback(new Blob(["thumbnail"], { type: type ?? "image/png" }));
      },
    );
    const ref = createRef<StudioViewerHandle>();
    await act(async () => {
      root.render(
        <StudioViewer
          ref={ref}
          src="/models/sample.glb"
          alt="Sample product preview"
          bodyColor="#c7683c"
          lidColor="#d7c6a5"
        />,
      );
    });
    return ref;
  }

  it("captures a thumbnail blob at the requested size and restores the view", async () => {
    const ref = await renderViewerWithHandle();
    const canvas = container.querySelector("canvas");
    expect(ref.current).not.toBeNull();
    const previous = { width: canvas!.width, height: canvas!.height };
    let blob: Blob | null = null;
    await act(async () => {
      blob = await ref.current!.captureThumbnail({
        width: 1200,
        height: 630,
        mimeType: "image/jpeg",
        quality: 0.8,
      });
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(capturedSizes).toEqual([
      { width: 1200, height: 630, type: "image/jpeg", quality: 0.8 },
    ]);
    expect(canvas!.width).toBe(previous.width);
    expect(canvas!.height).toBe(previous.height);
  });

  it("rejects a quality value outside the zero to one range", async () => {
    const ref = await renderViewerWithHandle();
    await expect(
      ref.current!.captureThumbnail({ quality: 1.5 }),
    ).rejects.toThrow(/quality/);
    await expect(
      ref.current!.captureThumbnail({ quality: -0.5 }),
    ).rejects.toThrow(/quality/);
  });

  it("rejects while the viewer shows the SVG fallback", async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
    const ref = createRef<StudioViewerHandle>();
    await act(async () => {
      root.render(
        <StudioViewer
          ref={ref}
          src="/models/sample.glb"
          alt="Sample product preview"
          bodyColor="#c7683c"
          lidColor="#d7c6a5"
        />,
      );
    });
    expect(
      container
        .querySelector("[data-studio-viewer]")
        ?.getAttribute("data-render-mode"),
    ).toBe("fallback");
    await expect(ref.current!.captureThumbnail()).rejects.toThrow(/fallback/i);
  });
});

describe("StudioViewer hotspots", () => {
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

  async function renderViewer(
    hotspots: StudioViewerProps["hotspots"],
    handlers: Pick<StudioViewerProps, "onHotspotClick" | "onPick"> = {},
  ) {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => ({}),
    });
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
    }));
    await act(async () => {
      root.render(
        <StudioViewer
          src="/models/sample.glb"
          alt="Sample product preview"
          bodyColor="#c7683c"
          lidColor="#d7c6a5"
          hotspots={hotspots}
          {...handlers}
        />,
      );
      await Promise.resolve();
    });
  }

  it("renders one marker per hotspot and none without the prop", async () => {
    await renderViewer(undefined);
    expect(container.querySelectorAll(".studio-hotspot")).toHaveLength(0);

    await renderViewer([
      {
        id: "hinge",
        label: "Lid hinge",
        description: "Printed hinge",
        position: [0, 0.03, 0],
      },
      { id: "foot", label: "Foot", position: [0, 0.03, 0] },
    ]);
    const markers = [
      ...container.querySelectorAll<HTMLButtonElement>(".studio-hotspot"),
    ];
    expect(markers).toHaveLength(2);
    expect(markers[0].type).toBe("button");
    expect(markers[0].dataset.hotspotId).toBe("hinge");
    expect(markers[0].textContent).toBe("Lid hinge");
    expect(markers[0].title).toBe("Printed hinge");
    expect(markers[1].getAttribute("title")).toBeNull();
    expect(markers[0].hidden).toBe(false);
    expect(Number.parseFloat(markers[0].style.left)).toBeCloseTo(50, 2);
    expect(markers[0].style.top).toMatch(/^-?\d+(\.\d+)?%$/);
    expect(markers[0].style.left).toMatch(/^-?\d+(\.\d+)?%$/);
  });

  it("reports a marker click with its id and never calls the canvas pick", async () => {
    const onHotspotClick = vi.fn();
    const onPick = vi.fn();
    await renderViewer(
      [{ id: "hinge", label: "Lid hinge", position: [0, 0.03, 0] }],
      { onHotspotClick, onPick },
    );
    const marker = container.querySelector<HTMLButtonElement>(
      "[data-hotspot-id=hinge]",
    );
    expect(marker).not.toBeNull();
    act(() => {
      marker!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onHotspotClick).toHaveBeenCalledTimes(1);
    expect(onHotspotClick).toHaveBeenCalledWith("hinge");
    expect(onPick).not.toHaveBeenCalled();
  });

  it("activates a focused marker with Enter and Space", async () => {
    const onHotspotClick = vi.fn();
    await renderViewer(
      [{ id: "hinge", label: "Lid hinge", position: [0, 0.03, 0] }],
      { onHotspotClick },
    );
    const marker = container.querySelector<HTMLButtonElement>(
      "[data-hotspot-id=hinge]",
    )!;
    marker.focus();
    expect(document.activeElement).toBe(marker);
    act(() => {
      marker.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    act(() => {
      marker.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });
    expect(onHotspotClick).toHaveBeenCalledTimes(2);
    expect(onHotspotClick).toHaveBeenNthCalledWith(1, "hinge");
    expect(onHotspotClick).toHaveBeenNthCalledWith(2, "hinge");
  });

  it("rotates the model when a drag starts on a marker and skips the activation", async () => {
    const onHotspotClick = vi.fn();
    await renderViewer(
      [{ id: "hinge", label: "Lid hinge", position: [0, 0.03, 0] }],
      { onHotspotClick },
    );
    const canvas = container.querySelector("canvas");
    const marker = container.querySelector<HTMLButtonElement>(
      "[data-hotspot-id=hinge]",
    )!;
    expect(canvas?.getAttribute("aria-valuenow")).toBe("0");
    act(() => {
      marker.dispatchEvent(pointer("pointerdown", 11, 100, 40));
      marker.dispatchEvent(pointer("pointermove", 11, 160, 40));
      marker.dispatchEvent(pointer("pointerup", 11, 160, 40));
    });
    expect(Number(canvas?.getAttribute("aria-valuenow"))).not.toBe(0);
    act(() => {
      marker.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onHotspotClick).not.toHaveBeenCalled();
  });

  it("re-projects the markers when the model rotates", async () => {
    await renderViewer([
      { id: "side", label: "Side", position: [0.4, 0.03, 0] },
    ]);
    const canvas = container.querySelector("canvas");
    const marker = container.querySelector<HTMLButtonElement>(
      "[data-hotspot-id=side]",
    )!;
    const before = marker.style.left;
    act(() => {
      canvas?.dispatchEvent(pointer("pointerdown", 12, 100, 40));
      canvas?.dispatchEvent(pointer("pointermove", 12, 160, 40));
      canvas?.dispatchEvent(pointer("pointerup", 12, 160, 40));
    });
    expect(marker.style.left).not.toBe(before);
  });

  it("hides markers whose anchor leaves the canvas", async () => {
    await renderViewer([
      { id: "near", label: "Near", position: [0, 0.03, 0] },
      { id: "far", label: "Far", position: [100, 0, 0] },
    ]);
    const near = container.querySelector<HTMLButtonElement>(
      "[data-hotspot-id=near]",
    )!;
    const far = container.querySelector<HTMLButtonElement>(
      "[data-hotspot-id=far]",
    )!;
    expect(near.hidden).toBe(false);
    expect(far.hidden).toBe(true);
  });
});
