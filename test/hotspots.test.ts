import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { configureStudioCamera } from "../src/materials.js";
import { projectStudioHotspot } from "../src/hotspots.js";

function defaultCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  configureStudioCamera(camera, 1);
  camera.updateMatrixWorld();
  return camera;
}

describe("studio hotspot projection", () => {
  it("projects the camera target onto the canvas centre", () => {
    const projection = projectStudioHotspot(
      [0, -0.02, 0],
      defaultCamera(),
      new THREE.Matrix4(),
    );
    expect(projection.x).toBeCloseTo(0, 6);
    expect(projection.y).toBeCloseTo(0, 6);
    expect(projection.visible).toBe(true);
  });

  it("keeps a known anchor at its expected screen position", () => {
    const projection = projectStudioHotspot(
      [0.5, -0.02, 0],
      defaultCamera(),
      new THREE.Matrix4(),
    );
    expect(projection.x).toBeCloseTo(0.389524, 4);
    expect(projection.y).toBeCloseTo(-0.09975, 4);
    expect(projection.visible).toBe(true);
  });

  it("moves the screen position when the model rotation changes", () => {
    const camera = defaultCamera();
    const anchor: [number, number, number] = [0.5, -0.02, 0];
    const neutral = projectStudioHotspot(anchor, camera, new THREE.Matrix4());
    const turned = projectStudioHotspot(
      anchor,
      camera,
      new THREE.Matrix4().makeRotationY(Math.PI / 2),
    );
    const mirrored = projectStudioHotspot(
      anchor,
      camera,
      new THREE.Matrix4().makeRotationY(-Math.PI / 2),
    );
    expect(turned.x).toBeCloseTo(0.293641, 4);
    expect(turned.y).toBeCloseTo(0.132321, 4);
    expect(Math.abs(turned.x - neutral.x)).toBeGreaterThan(0.05);
    expect(mirrored.x).toBeCloseTo(-turned.x, 4);
    expect(mirrored.y).toBeCloseTo(-turned.y, 4);
  });

  it("hides anchors outside the canvas or behind the camera", () => {
    const camera = defaultCamera();
    const matrix = new THREE.Matrix4();
    expect(projectStudioHotspot([100, 0, 0], camera, matrix).visible).toBe(
      false,
    );
    expect(projectStudioHotspot([0, 100, 0], camera, matrix).visible).toBe(
      false,
    );
    const forward = new THREE.Vector3(0, -0.02, 0)
      .sub(camera.position)
      .normalize();
    const behind = camera.position.clone().addScaledVector(forward, -1);
    expect(
      projectStudioHotspot([behind.x, behind.y, behind.z], camera, matrix)
        .visible,
    ).toBe(false);
    expect(projectStudioHotspot([0, -0.02, 0], camera, matrix).visible).toBe(
      true,
    );
  });
});
