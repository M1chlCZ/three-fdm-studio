import * as THREE from "three";

/**
 * One interactive annotation of the studio model. The `position` uses the
 * studio presentation frame: Y is up, the model stands on the floor plane at
 * `y = -0.72`, its horizontal centre sits on the vertical axis and its longest
 * side measures 1.5 world units. The viewer yaw rotates this frame together
 * with the model.
 */
export type StudioHotspot = {
  /** Stable identifier that the click callback reports. The value must be
   * unique within the `hotspots` array. */
  id: string;
  /** Marker text and accessible name. */
  label: string;
  /** Anchor point in presentation coordinates. */
  position: [number, number, number];
  /** Optional tooltip text. The viewer sets it as the marker `title`. */
  description?: string;
};

/**
 * Screen projection of one hotspot anchor in normalized device coordinates.
 */
export type StudioHotspotProjection = {
  /** Horizontal position from `-1` (left edge) to `1` (right edge). */
  x: number;
  /** Vertical position from `-1` (bottom edge) to `1` (top edge). */
  y: number;
  /** Whether the anchor lies inside the canvas and the camera depth range. */
  visible: boolean;
};

/**
 * Projects one hotspot anchor through a camera. Pass the world matrix of the
 * studio presentation so the anchor follows the model rotation. The projection
 * is visible when the projected point lies inside the canvas bounds (`-1` to
 * `1` on both axes) and inside the near and far depth range of the camera.
 * Points behind the camera fail the depth test. The function does not test
 * occlusion by model geometry.
 */
export function projectStudioHotspot(
  position: readonly [number, number, number],
  camera: THREE.Camera,
  matrixWorld: THREE.Matrix4,
): StudioHotspotProjection {
  const point = new THREE.Vector3(position[0], position[1], position[2])
    .applyMatrix4(matrixWorld)
    .project(camera);
  return {
    x: point.x,
    y: point.y,
    visible:
      point.x >= -1 &&
      point.x <= 1 &&
      point.y >= -1 &&
      point.y <= 1 &&
      point.z >= -1 &&
      point.z <= 1,
  };
}
