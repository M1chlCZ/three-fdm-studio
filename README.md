# three-fdm-studio

A React component and material engine that renders GLB models of 3D-printed
goods with three.js. The studio includes a procedural FDM fuzzy-skin grain,
glitter flakes, surface-finish switching, semantic warehouse-color mapping,
studio lighting and contact shadows, label-atlas localization and a picking
callback.

The package ships ESM only. It has no runtime dependencies. React and three.js
are peer dependencies, so the application provides them.

## Requirements

- React 19 or later.
- three.js 0.185 or later.
- A browser with WebGL 2.

## Install

```sh
npm install three-fdm-studio react three
```

## Quick start

Import the component and the stylesheet:

```tsx
import { StudioViewer } from "three-fdm-studio";
import "three-fdm-studio/styles.css";

export function ProductPreview() {
  return (
    <StudioViewer
      src="/models/planter.glb"
      fallbackSrc="/models/planter.svg"
      alt="Planter preview"
      bodyColor="#c7683c"
      lidColor="#d7c6a5"
      viewLabels={{ front: "Front", back: "Back" }}
      onPick={(occurrenceKey) => console.log("picked", occurrenceKey)}
      onReady={() => console.log("model ready")}
    />
  );
}
```

The viewer renders an orthographic studio, eases the model through an intro
turn, and supports pointer drag, arrow keys, `Home` and `Enter`. When WebGL or
the model fails, the viewer loads the optional `fallbackSrc` SVG instead.

## The `studio_*` userData convention

Model exporters mark glTF nodes and materials with `userData` keys. The keys
use the `studio_` prefix. The package exports every key as a constant.

| Key | Location | Type | Meaning |
| --- | --- | --- | --- |
| `studio_semantic_role` | node or parent group | `"body" \| "lid" \| "hardware" \| "ignore"` | Selects the printed color slot. `ignore` hides the subtree. |
| `studio_material_field_key` | node or parent group | string | Maps the object to an entry of the `materialColors` or `materialFinishes` record. |
| `studio_surface_finish` | mesh | `"fuzzy" \| "smooth"` | Overrides the grain of one mesh. |
| `studio_visible_variant_skus` | node | string array | Shows the object only for the listed variant SKUs. |
| `studio_visible_when_field` | node | string | Configuration field that controls the object. |
| `studio_visible_when_value` | node | string | Configuration value that shows the object. |
| `studio_visibility_default` | node | string | Fallback configuration value. |
| `studio_occurrence_id` | mesh | string | Selectable occurrence that the `onPick` callback reports. |
| `studio_label_locales` | material | string array | Locale order of a label atlas. Two to eight unique tags. |
| `studio_preview_notice` | material | record | Localized plain-text notice. Maximum 300 characters. |
| `studio_illustrative_only` | node | boolean | Marks a prop that the illustration toggle can hide. |

The engine keeps authored hardware materials. A mesh under
`studio_semantic_role: "hardware"` stays unchanged unless it also declares a
`studio_material_field_key` with a matching color.

## Slots and presentation profiles

- `bodyColor` and `lidColor` set the two default printed slots.
- `materialColors` maps named slots to sRGB hex values. The slot names come
  from `studio_material_field_key`.
- `materialFinishes` switches a slot to `"glitter"` or `"painted"`.
- `configuration` selects authored parts through the
  `studio_visible_when_*` keys.
- `variantSKU` selects authored variants through
  `studio_visible_variant_skus`.

`presentationProfile` selects the studio look. The package provides five
profiles:

| Profile | Use |
| --- | --- |
| `standard` | Default printed product. |
| `matte-stand` | Small stands and holders with fine, even grain. |
| `matte-organizer` | Trays and organizers with stronger cavity occlusion. |
| `smooth-relief` | Smooth parts with shallow relief. |
| `smooth-cavity` | Smooth parts with deep cavities. |

## Label localization

Create one horizontal atlas for each label. The UV coordinates cover the first
column. Set `studio_label_locales` on the material to the column order:

```json
{ "studio_label_locales": ["en", "de", "fr"] }
```

Set the `locale` prop to a matching tag; the default is `en`. The viewer shifts the texture offset
to the matching column. Geometry and material colors stay unchanged.

If the model cannot carry metadata, pass `labelLocales`. The viewer applies
the order to every material that has a color map and no embedded metadata.

## Render settings

`renderSettings` accepts an optional `StudioRenderSettings` value. The package
exports `studioRenderControls` with the display label and range of every
control, `studioRenderPresets` with three starting points, and
`isStudioRenderSettings` to validate untrusted values.

```ts
import type { StudioRenderSettings } from "three-fdm-studio";

const settings: StudioRenderSettings = {
  roughness: 0.62,
  metalness: 0,
  grain: 0.25,
  exposure: 0.9,
  environment: 0.8,
  key: 2.2,
  fill: 2,
  occlusion: 0.45,
};
```

The optional controls are `color_response`, `softness` and `ao_radius`.

## Glow demonstration

Some model families carry a phosphorescent printed layer. Set `glowFieldKey`
to the material slot that emits light, for example `"middle_color"`. The
viewer then shows a control that fades the studio to darkness and back. Use
`glowLabels` to translate the control. The viewer creates the bloom pass on the first glow request and disables it afterwards
only while the demonstration runs.

## Asset paths

- `dracoDecoderPath` sets the Draco decoder location. The default is the
  Google CDN path `DEFAULT_DRACO_DECODER_PATH`. Host the decoder yourself for
  an offline or self-contained application.
- `environmentUrl` sets an equirectangular HDR environment. When the value is
  absent or fails to load, the viewer uses the three.js `RoomEnvironment`.

The defaults cover three.js (MIT), the Draco decoder (Apache-2.0, Google) and
the three.js `RoomEnvironment`. An HDR from the consumer can have a CC0
license. For example, a Poly Haven studio HDRI is CC0. Read the license of the
specific file.

## Styling

The component uses plain `tfs-` class names. Import
`three-fdm-studio/styles.css` once in the application. The root element
accepts `className` and `style`.

CSS custom properties:

| Property | Effect |
| --- | --- |
| `--tfs-frame` | Border and frame color. |
| `--tfs-ink` | Text and pressed-button color. |
| `--tfs-accent` | Focus outline color. |
| `--tfs-body-0` to `--tfs-body-2` | Body shades for fallback SVG artwork. |
| `--tfs-lid-0` to `--tfs-lid-2` | Lid shades for fallback SVG artwork. |

## Exported helpers

The package also exports the standalone building blocks:

- `STUDIO_SEMANTIC_ROLES`, `STUDIO_GLOW_MATERIAL_FIELDS` and the other
  `studio_*` userData keys.
- `STUDIO_INTRO_ROTATION_MS` and `STUDIO_INTRO_YAW_DEGREES`.
- `createStudioMaterial`, `addFuzzyMaskAttribute`, `updateMaterialColor`,
  `styleStudioModel`, `updateModelColors`, `updateModelSurface`,
  `updateModelGlow`, `updateModelFinishes`, `updateModelVariant`,
  `updateModelConfiguration`.
- `preparePresentation`, `configureStudioCamera`, `studioLighting`.
- `createStudioContactShadow`, `createModelLabelLocalizer`,
  `modelPreviewNotice`, `createModelIllustrationToggle`.
- `parseConfigurationPreviewManifest`,
  `configurationPreviewMaterialColors`. Manifest asset paths use the
  consumer's `/media/` and `/models/` prefixes.
- `glowDemoDarkness`, `introYawOffset`, `previewRenderQuality`.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

`npm run build` compiles `src/` to `dist/` with declarations. `npm test` runs
the Vitest suites, including a generated GLB fixture and a happy-dom render
test. The suite covers the CPU-side logic and the component fallback; the
WebGL pipeline itself is not rendered in tests and needs a browser or a
WebGL-capable runtime.

## License

MIT. See [LICENSE](./LICENSE).
