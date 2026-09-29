/**
 * `userData` key that assigns an object one of the {@link STUDIO_SEMANTIC_ROLES}
 * values. The key is authored on the glTF node or on a parent group.
 */
export const STUDIO_SEMANTIC_ROLE_KEY = "studio_semantic_role";

/**
 * `userData` key that maps an object to a caller-defined material slot. The
 * slot value selects an entry from the `materialColors` record.
 */
export const STUDIO_MATERIAL_FIELD_KEY = "studio_material_field_key";

/**
 * `userData` key that overrides the surface finish of one object. The supported
 * values are `"fuzzy"` and `"smooth"`.
 */
export const STUDIO_SURFACE_FINISH_KEY = "studio_surface_finish";

/**
 * `userData` key that lists the variant SKUs an object belongs to. The object
 * is hidden when the viewer selects another SKU.
 */
export const STUDIO_VISIBLE_VARIANT_SKUS_KEY = "studio_visible_variant_skus";

/**
 * `userData` key that names the configuration field an object depends on.
 * Use it together with {@link STUDIO_VISIBLE_WHEN_VALUE_KEY}.
 */
export const STUDIO_VISIBLE_WHEN_FIELD_KEY = "studio_visible_when_field";

/**
 * `userData` key that holds the configuration value that makes the object
 * visible.
 */
export const STUDIO_VISIBLE_WHEN_VALUE_KEY = "studio_visible_when_value";

/**
 * `userData` key that holds the fallback configuration value of an object
 * before the caller selects anything.
 */
export const STUDIO_VISIBILITY_DEFAULT_KEY = "studio_visibility_default";

/**
 * `userData` key that marks a mesh as a selectable occurrence. The viewer
 * reports the value through the `onPick` callback.
 */
export const STUDIO_OCCURRENCE_ID_KEY = "studio_occurrence_id";

/**
 * `userData` key for a material that carries a horizontal label atlas. The
 * value is the locale order of the atlas columns, from two to eight unique
 * locale tags.
 */
export const STUDIO_LABEL_LOCALES_KEY = "studio_label_locales";

/**
 * `userData` key for the localized plain-text notice of a material. The value
 * is a record from a locale tag to a notice of at most 300 characters.
 */
export const STUDIO_PREVIEW_NOTICE_KEY = "studio_preview_notice";

/**
 * `userData` key that marks an object as an illustration-only prop. The viewer
 * can hide it without changing the printed product.
 */
export const STUDIO_ILLUSTRATIVE_ONLY_KEY = "studio_illustrative_only";

/**
 * The semantic roles that a glTF node can declare in
 * {@link STUDIO_SEMANTIC_ROLE_KEY}.
 */
export const STUDIO_SEMANTIC_ROLES = {
  body: "body",
  lid: "lid",
  hardware: "hardware",
  ignore: "ignore",
} as const;

/**
 * One of the semantic roles declared by {@link STUDIO_SEMANTIC_ROLES}.
 */
export type StudioSemanticRole =
  (typeof STUDIO_SEMANTIC_ROLES)[keyof typeof STUDIO_SEMANTIC_ROLES];

/**
 * The material slots that the glow demonstration accepts as its emissive
 * layer.
 */
export const STUDIO_GLOW_MATERIAL_FIELDS = [
  "back_color",
  "middle_color",
  "front_color",
] as const;

/**
 * One of the material slots that supports the optional glow demonstration.
 */
export type StudioGlowMaterialField =
  (typeof STUDIO_GLOW_MATERIAL_FIELDS)[number];
