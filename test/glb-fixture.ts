const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

function padToFourBytes(length: number): number {
  return (4 - (length % 4)) % 4;
}

/**
 * Builds a minimal, valid binary glTF file with one triangle. The fixture
 * carries the studio userData convention, so tests can exercise the full
 * parse and style pipeline without a product asset.
 */
export function createMinimalGlb(): ArrayBuffer {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const binaryChunk = new Uint8Array(
    positions.buffer,
    positions.byteOffset,
    positions.byteLength,
  );
  const json = JSON.stringify({
    asset: { version: "2.0", generator: "three-fdm-studio tests" },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      {
        mesh: 0,
        name: "body",
        extras: {
          studio_semantic_role: "body",
          studio_surface_finish: "fuzzy",
          studio_occurrence_id: "part-1",
        },
      },
      {
        name: "variant",
        extras: { studio_visible_variant_skus: ["A", "B"] },
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 0.5,
        },
        extras: {
          studio_preview_notice: {
            en: "The props are illustrative only and are not included.",
            de: "Die Requisiten dienen nur der Illustration.",
          },
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 0, 1],
      },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }],
  });
  const jsonBytes = new TextEncoder().encode(json);
  const jsonPadding = padToFourBytes(jsonBytes.length);
  const binaryPadding = padToFourBytes(binaryChunk.byteLength);
  const totalLength =
    12 + 8 + jsonBytes.length + jsonPadding + 8 + binaryChunk.byteLength + binaryPadding;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonBytes.length + jsonPadding, true);
  view.setUint32(16, JSON_CHUNK_TYPE, true);
  const bytes = new Uint8Array(buffer);
  bytes.set(jsonBytes, 20);
  bytes.fill(0x20, 20 + jsonBytes.length, 20 + jsonBytes.length + jsonPadding);
  const binaryOffset = 20 + jsonBytes.length + jsonPadding;
  view.setUint32(binaryOffset, binaryChunk.byteLength + binaryPadding, true);
  view.setUint32(binaryOffset + 4, BIN_CHUNK_TYPE, true);
  bytes.set(binaryChunk, binaryOffset + 8);
  return buffer;
}
