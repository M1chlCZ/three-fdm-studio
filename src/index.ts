export {
  DEFAULT_DRACO_DECODER_PATH,
  STUDIO_INTRO_ROTATION_MS,
  STUDIO_INTRO_YAW_DEGREES,
  StudioViewer,
  glowDemoDarkness,
  introYawOffset,
  previewRenderQuality,
} from "./StudioViewer.js";
export type { StudioViewerProps } from "./StudioViewer.js";
export {
  addFuzzyMaskAttribute,
  configureStudioCamera,
  createStudioMaterial,
  preparePresentation,
  studioLighting,
  styleStudioModel,
  updateMaterialColor,
  updateModelColors,
  updateModelConfiguration,
  updateModelFinishes,
  updateModelGlow,
  updateModelSurface,
  updateModelVariant,
} from "./materials.js";
export type {
  StudioLighting,
  StudioMaterial,
  StudioMaterialFinish,
  StudioMaterialUserData,
  StudioPresentationProfile,
  StudioSurfaceFinish,
} from "./materials.js";
export {
  studioRenderControls,
  studioRenderPresets,
  isStudioRenderSettings,
} from "./render-settings.js";
export type {
  StudioRenderSettingKey,
  StudioRenderSettings,
} from "./render-settings.js";
export { createStudioContactShadow } from "./studio-shadow.js";
export type { StudioContactShadow } from "./studio-shadow.js";
export { createModelLabelLocalizer } from "./label-localization.js";
export type {
  StudioLabelLocalizer,
  StudioLabelLocalizerOptions,
} from "./label-localization.js";
export { modelPreviewNotice } from "./preview-notice.js";
export { createModelIllustrationToggle } from "./illustrations.js";
export type { StudioIllustrationToggle } from "./illustrations.js";
export {
  configurationPreviewMaterialColors,
  parseConfigurationPreviewManifest,
} from "./manifest.js";
export type { StudioPreviewManifest } from "./manifest.js";
export {
  STUDIO_GLOW_MATERIAL_FIELDS,
  STUDIO_ILLUSTRATIVE_ONLY_KEY,
  STUDIO_LABEL_LOCALES_KEY,
  STUDIO_MATERIAL_FIELD_KEY,
  STUDIO_OCCURRENCE_ID_KEY,
  STUDIO_PREVIEW_NOTICE_KEY,
  STUDIO_SEMANTIC_ROLE_KEY,
  STUDIO_SEMANTIC_ROLES,
  STUDIO_SURFACE_FINISH_KEY,
  STUDIO_VISIBILITY_DEFAULT_KEY,
  STUDIO_VISIBLE_VARIANT_SKUS_KEY,
  STUDIO_VISIBLE_WHEN_FIELD_KEY,
  STUDIO_VISIBLE_WHEN_VALUE_KEY,
} from "./user-data.js";
export type {
  StudioGlowMaterialField,
  StudioSemanticRole,
} from "./user-data.js";
