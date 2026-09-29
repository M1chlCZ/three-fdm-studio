"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {
  configureStudioCamera,
  preparePresentation,
  studioLighting,
  styleStudioModel,
  updateModelColors,
  updateModelConfiguration,
  updateModelFinishes,
  updateModelGlow,
  updateModelSurface,
  updateModelVariant,
  type StudioMaterialFinish,
  type StudioPresentationProfile,
} from "./materials.js";
import type { StudioRenderSettings } from "./render-settings.js";
import { createModelLabelLocalizer } from "./label-localization.js";
import { modelPreviewNotice } from "./preview-notice.js";
import { createModelIllustrationToggle } from "./illustrations.js";
import { createStudioContactShadow } from "./studio-shadow.js";
import { STUDIO_OCCURRENCE_ID_KEY } from "./user-data.js";

type Status = "loading" | "ready" | "fallback";

/**
 * Duration of the intro yaw animation in milliseconds.
 */
export const STUDIO_INTRO_ROTATION_MS = 720;

/**
 * Start yaw of the intro animation in degrees.
 */
export const STUDIO_INTRO_YAW_DEGREES = -120;

/**
 * Draco decoder path that the viewer uses when the caller sets no path.
 */
export const DEFAULT_DRACO_DECODER_PATH =
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

/**
 * Darkness curve of the glow demonstration. The value rises to 1 between 2 and
 * 4 seconds and falls back to 0 at 6 seconds.
 */
export function glowDemoDarkness(elapsedMs: number): number {
  const linear =
    elapsedMs < 2000
      ? elapsedMs / 2000
      : elapsedMs < 4000
        ? 1
        : 1 - (elapsedMs - 4000) / 2000;
  const t = Math.max(0, Math.min(1, linear));
  return t * t * (3 - 2 * t);
}

/**
 * Yaw offset of the intro rotation at a given elapsed time. The function
 * returns `0` for reduced motion or after the animation ends.
 */
export function introYawOffset(
  elapsedMs: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion || elapsedMs >= STUDIO_INTRO_ROTATION_MS) return 0;
  const progress = THREE.MathUtils.clamp(
    elapsedMs / STUDIO_INTRO_ROTATION_MS,
    0,
    1,
  );
  return STUDIO_INTRO_YAW_DEGREES * (1 - progress) ** 3;
}

/**
 * Render quality of the viewer. The function caps the pixel ratio and reserves
 * more ambient occlusion samples for the expanded presentation.
 */
export function previewRenderQuality(
  expanded: boolean,
  devicePixelRatio: number,
): { pixelRatio: number; aoSamples: number } {
  return {
    pixelRatio: Math.min(Math.max(devicePixelRatio, 1), expanded ? 1.75 : 1.25),
    aoSamples: expanded ? 24 : 12,
  };
}

/**
 * Props of {@link StudioViewer}.
 */
export type StudioViewerProps = {
  /** URL of the GLB model to render. */
  src: string;
  /** Locale tag used for label atlases and preview notices. */
  locale?: string;
  /** URL of an SVG file that replaces the canvas when WebGL is unavailable. */
  fallbackSrc?: string;
  /** Accessible name of the viewer. */
  alt: string;
  /** Printed color of the body slot. */
  bodyColor: string;
  /** Printed color of the lid slot. */
  lidColor: string;
  /** Colors of named material slots, keyed by `studio_material_field_key`. */
  materialColors?: Readonly<Record<string, string>>;
  /** Printed finishes of named material slots. */
  materialFinishes?: Readonly<Record<string, StudioMaterialFinish>>;
  /** Caller configuration that selects authored parts. */
  configuration?: Readonly<Record<string, string | number>>;
  /** Variant SKU that selects authored variants. */
  variantSKU?: string;
  /** Studio lighting and material profile. */
  presentationProfile?: StudioPresentationProfile;
  /** Correction of the source rotation around the X axis, in degrees. */
  sourceRotationXDegrees?: number;
  /** Correction of the source rotation around the Y axis, in degrees. */
  sourceRotationYDegrees?: number;
  /** Correction of the source rotation around the Z axis, in degrees. */
  sourceRotationZDegrees?: number;
  /** Render settings for lights, exposure, occlusion and material. */
  renderSettings?: StudioRenderSettings | null;
  /** Decoder path of the Draco loader. */
  dracoDecoderPath?: string;
  /** Equirectangular HDR environment. The viewer uses the room environment
   * when the value is absent or fails to load. */
  environmentUrl?: string;
  /** Locale column order for label atlases without embedded metadata. */
  labelLocales?: readonly string[];
  /** Loading text. */
  loadingLabel?: string;
  /** Text shown when the model cannot be rendered. */
  fallbackLabel?: string;
  /** Accessible name of the rotation slider. */
  rotationLabel?: string;
  /** Custom loading indicator. */
  loadingContent?: ReactNode;
  /** Custom error content. It replaces the `fallbackLabel` text. */
  errorContent?: ReactNode;
  /** Labels of the front and back view buttons. The buttons are hidden when
   * the value is absent. */
  viewLabels?: { front: string; back: string };
  /** Labels of the illustration prop toggle. */
  illustrationLabels?: { show: string; hide: string; title?: string };
  /** Material slot of the glow demonstration. The demonstration stays off
   * when the value is absent. */
  glowFieldKey?: string;
  /** Labels of the glow demonstration. */
  glowLabels?: { tryDark: string; daylight: string; simulation: string };
  /** Reserves more pixels and ambient occlusion samples. */
  expanded?: boolean;
  /** Called when the viewer is clicked or activated with Enter. */
  onActivate?: () => void;
  /** Occurrence key that receives the selection highlight. */
  highlightOccurrenceKey?: string;
  /** Called with the `studio_occurrence_id` value of the picked mesh. */
  onPick?: (occurrenceKey: string) => void;
  /** Called when the model becomes visible. */
  onReady?: () => void;
  /** Extra class name of the root element. */
  className?: string;
  /** Extra inline style of the root element. */
  style?: CSSProperties;
};

const defaultLoadingLabel = "Loading 3D preview…";
const defaultFallbackLabel = "3D preview is unavailable";
const defaultRotationLabel = "Rotate product horizontally";
const defaultGlowLabels = {
  tryDark: "Try in the dark",
  daylight: "Back to daylight",
  simulation: "Phosphorescence simulation",
};
const defaultIllustrationLabels = {
  show: "Show props",
  hide: "Hide props",
  title: "Show or hide the illustrative props. They are not included.",
};

function DefaultLoadingIndicator({ label }: { label: string }) {
  return (
    <div className="tfs-loading-indicator" role="status">
      <span className="tfs-spinner" aria-hidden="true" />
      <span className="tfs-loading-label">{label}</span>
    </div>
  );
}

/**
 * React viewer for GLB models of 3D-printed products. The component renders a
 * WebGL studio with procedural FDM grain, glitter, semantic slot colors,
 * studio lighting, shadows, label localization and pointer picking. Consumers
 * import the styles from `three-fdm-studio/styles.css`.
 */
export function StudioViewer({
  src,
  locale = "en",
  fallbackSrc,
  alt,
  bodyColor,
  lidColor,
  materialColors = {},
  materialFinishes = {},
  configuration = {},
  variantSKU,
  presentationProfile = "standard",
  sourceRotationXDegrees = 0,
  sourceRotationYDegrees = 0,
  sourceRotationZDegrees = 0,
  renderSettings,
  dracoDecoderPath = DEFAULT_DRACO_DECODER_PATH,
  environmentUrl,
  labelLocales,
  loadingLabel = defaultLoadingLabel,
  fallbackLabel = defaultFallbackLabel,
  rotationLabel = defaultRotationLabel,
  loadingContent,
  errorContent,
  viewLabels,
  illustrationLabels = defaultIllustrationLabels,
  glowFieldKey,
  glowLabels = defaultGlowLabels,
  expanded = false,
  onActivate,
  highlightOccurrenceKey,
  onPick,
  onReady,
  className,
  style,
}: StudioViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const contactShadowRef = useRef<ReturnType<
    typeof createStudioContactShadow
  >>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const bodyColorRef = useRef(bodyColor);
  const lidColorRef = useRef(lidColor);
  const materialColorsRef = useRef(materialColors);
  const configurationRef = useRef(configuration);
  const materialFinishesRef = useRef(materialFinishes);
  const variantSKURef = useRef(variantSKU);
  const renderSettingsRef = useRef(renderSettings);
  const localeRef = useRef(locale);
  const labelLocalesRef = useRef(labelLocales);
  const labelLocalizerRef = useRef<ReturnType<
    typeof createModelLabelLocalizer
  > | null>(null);
  const illustrationToggleRef = useRef<ReturnType<
    typeof createModelIllustrationToggle
  > | null>(null);
  const illustrationsHiddenRef = useRef(false);
  const applyRenderSettingsRef = useRef<() => void>(() => undefined);
  const renderRef = useRef<() => void>(() => undefined);
  const frameRef = useRef<number | null>(null);
  const introFrameRef = useRef<number | null>(null);
  const glowFrameRef = useRef<number | null>(null);
  const glowFieldRef = useRef(glowFieldKey);
  const darknessRef = useRef(0);
  const glowPlayedRef = useRef(false);
  const [glowPlaying, setGlowPlaying] = useState(false);
  const qualityRef = useRef<(large: boolean) => void>(() => undefined);
  const expandedRef = useRef(expanded);
  const yawRef = useRef(0);
  const pointerRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    startYaw: number;
    dragged: boolean;
  } | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [previewNoticeState, setPreviewNoticeState] = useState<{
    src: string;
    locale: string;
    text: string;
  } | null>(null);
  const [illustrationSource, setIllustrationSource] = useState<string | null>(
    null,
  );
  const [illustrationsHidden, setIllustrationsHidden] = useState(false);
  const [yawDegrees, setYawDegrees] = useState(0);
  const [fallbackContent, setFallbackContent] = useState<{
    src: string;
    markup: string;
  } | null>(null);

  const scheduleDraw = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      renderRef.current();
    });
  }, []);

  const cancelIntroRotation = useCallback(() => {
    if (introFrameRef.current === null) return;
    window.cancelAnimationFrame(introFrameRef.current);
    introFrameRef.current = null;
  }, []);

  const stopGlowDemo = useCallback(() => {
    if (glowFrameRef.current !== null)
      window.cancelAnimationFrame(glowFrameRef.current);
    glowFrameRef.current = null;
    darknessRef.current = 0;
    applyRenderSettingsRef.current();
    scheduleDraw();
    setGlowPlaying(false);
  }, [scheduleDraw]);

  const startGlowDemo = useCallback(() => {
    stopGlowDemo();
    if (!glowFieldRef.current) return;
    setGlowPlaying(true);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      darknessRef.current = 1;
      applyRenderSettingsRef.current();
      scheduleDraw();
      return;
    }
    const started = performance.now();
    const animate = (now: number) => {
      darknessRef.current = glowDemoDarkness(now - started);
      applyRenderSettingsRef.current();
      renderRef.current();
      if (now - started < 6000)
        glowFrameRef.current = window.requestAnimationFrame(animate);
      else {
        glowFrameRef.current = null;
        setGlowPlaying(false);
      }
    };
    glowFrameRef.current = window.requestAnimationFrame(animate);
  }, [stopGlowDemo, scheduleDraw]);

  useEffect(() => {
    glowFieldRef.current = glowFieldKey;
    const frame = window.requestAnimationFrame(() => {
      if (!glowFieldKey) {
        glowPlayedRef.current = false;
        stopGlowDemo();
      } else if (status !== "ready") {
        stopGlowDemo();
      } else if (!glowPlayedRef.current) {
        glowPlayedRef.current = true;
        if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
          startGlowDemo();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [glowFieldKey, status, startGlowDemo, stopGlowDemo]);

  useEffect(() => {
    renderSettingsRef.current = renderSettings;
    applyRenderSettingsRef.current();
    scheduleDraw();
  }, [renderSettings, scheduleDraw]);

  useEffect(() => {
    labelLocalesRef.current = labelLocales;
  }, [labelLocales]);

  useEffect(() => {
    localeRef.current = locale;
    labelLocalizerRef.current?.setLocale(locale);
    if (status === "ready" && modelRef.current) {
      setPreviewNoticeState({
        src,
        locale,
        text: modelPreviewNotice(modelRef.current, locale),
      });
    }
    scheduleDraw();
  }, [locale, scheduleDraw, src, status]);

  const applyYaw = (degrees: number) => {
    const normalized = ((((degrees + 180) % 360) + 360) % 360) - 180;
    yawRef.current = normalized;
    if (modelRef.current)
      modelRef.current.rotation.y = THREE.MathUtils.degToRad(normalized);
    setYawDegrees(Math.round(normalized));
    scheduleDraw();
  };

  useEffect(() => {
    variantSKURef.current = variantSKU;
    if (modelRef.current) updateModelVariant(modelRef.current, variantSKU);
    contactShadowRef.current?.fit();
    scheduleDraw();
  }, [variantSKU, status, scheduleDraw]);

  useEffect(() => {
    configurationRef.current = configuration;
    if (modelRef.current)
      updateModelConfiguration(modelRef.current, configuration);
    contactShadowRef.current?.fit();
    scheduleDraw();
  }, [configuration, status, scheduleDraw]);

  useEffect(() => {
    bodyColorRef.current = bodyColor;
    lidColorRef.current = lidColor;
    materialColorsRef.current = materialColors;
    if (modelRef.current)
      updateModelColors(
        modelRef.current,
        bodyColor,
        lidColor,
        materialColors,
        highlightOccurrenceKey,
      );
    scheduleDraw();
  }, [
    bodyColor,
    lidColor,
    materialColors,
    highlightOccurrenceKey,
    status,
    scheduleDraw,
  ]);

  useEffect(() => {
    materialFinishesRef.current = materialFinishes;
    if (modelRef.current)
      updateModelFinishes(modelRef.current, materialFinishes);
    scheduleDraw();
  }, [materialFinishes, status, scheduleDraw]);

  useEffect(() => {
    expandedRef.current = expanded;
    qualityRef.current(expanded);
    scheduleDraw();
  }, [expanded, scheduleDraw]);

  useEffect(() => {
    illustrationsHiddenRef.current = illustrationsHidden;
    illustrationToggleRef.current?.setVisible(!illustrationsHidden);
    scheduleDraw();
  }, [
    illustrationsHidden,
    configuration,
    variantSKU,
    status,
    scheduleDraw,
  ]);

  useEffect(() => {
    if (status !== "fallback" || !fallbackSrc) {
      return undefined;
    }
    let active = true;
    new THREE.FileLoader()
      .setResponseType("text")
      .load(fallbackSrc, (contents) => {
        if (!active) return;
        const markup = String(contents);
        if (!/^<svg\b/.test(markup.trim()) || /<script\b|\son\w+=/i.test(markup)) {
          return;
        }
        setFallbackContent({ src: fallbackSrc, markup });
      });
    return () => {
      active = false;
    };
  }, [fallbackSrc, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    cancelIntroRotation();
    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let composer: EffectComposer | null = null;
    let ambientOcclusion: GTAOPass | null = null;
    let outputPass: OutputPass | null = null;
    let antialiasPass: FXAAPass | null = null;
    let bloom: UnrealBloomPass | null = null;
    let studioEnvironment: THREE.WebGLRenderTarget | null = null;
    let contactShadow: ReturnType<typeof createStudioContactShadow> = null;
    let lightingReady = false;
    let hasHDR = false;
    let resizeObserver: ResizeObserver | null = null;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    sceneRef.current = scene;
    cameraRef.current = camera;
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(dracoDecoderPath);
    loader.setDRACOLoader(dracoLoader);
    setStatus("loading");

    const showFallback = () => {
      if (!disposed) setStatus("fallback");
    };
    const resize = () => {
      if (!renderer || !composer || disposed) return;
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || width;
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      const presentation = modelRef.current;
      const centerY = presentation
        ? new THREE.Box3()
            .setFromObject(presentation)
            .getCenter(new THREE.Vector3()).y
        : undefined;
      configureStudioCamera(camera, width / height, centerY);
      scheduleDraw();
    };

    const lighting = studioLighting(presentationProfile);
    const applyQuality = (large: boolean) => {
      if (!renderer || !composer || !ambientOcclusion || disposed) return;
      const quality = previewRenderQuality(large, window.devicePixelRatio || 1);
      renderer.setPixelRatio(quality.pixelRatio);
      composer.setPixelRatio(quality.pixelRatio);
      ambientOcclusion.updateGtaoMaterial({
        radius: renderSettingsRef.current?.ao_radius || lighting.aoRadius,
        distanceExponent: 1.65,
        thickness: 0.09,
        distanceFallOff: 0.82,
        scale: lighting.aoScale,
        samples: quality.aoSamples,
      });
      ambientOcclusion.updatePdMaterial({
        radius: 3,
        rings: 2,
        samples: quality.aoSamples,
      });
      resize();
    };

    const showReadyPreview = () => {
      const presentation = modelRef.current;
      if (disposed || !presentation || !lightingReady) return;
      const reducedMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const initialYaw = introYawOffset(0, reducedMotion);
      yawRef.current = initialYaw;
      setYawDegrees(Math.round(initialYaw));
      presentation.rotation.y = THREE.MathUtils.degToRad(initialYaw);
      resize();
      setStatus("ready");
      if (initialYaw !== 0) {
        const startedAt = performance.now();
        const animateIntroRotation = (now: number) => {
          if (disposed) return;
          const elapsed = now - startedAt;
          const nextYaw = introYawOffset(elapsed, false);
          yawRef.current = nextYaw;
          presentation.rotation.y = THREE.MathUtils.degToRad(nextYaw);
          setYawDegrees(Math.round(nextYaw));
          renderRef.current();
          if (elapsed < STUDIO_INTRO_ROTATION_MS) {
            introFrameRef.current = window.requestAnimationFrame(
              animateIntroRotation,
            );
          } else {
            introFrameRef.current = null;
          }
        };
        introFrameRef.current =
          window.requestAnimationFrame(animateIntroRotation);
      }
      onReady?.();
    };

    const finishLighting = (texture?: THREE.DataTexture) => {
      if (disposed || !renderer) {
        texture?.dispose();
        return;
      }
      const pmrem = new THREE.PMREMGenerator(renderer);
      let room: RoomEnvironment | undefined;
      try {
        if (texture) {
          studioEnvironment = pmrem.fromEquirectangular(texture);
        } else {
          room = new RoomEnvironment();
          studioEnvironment = pmrem.fromScene(room, 0.04);
        }
        scene.environment = studioEnvironment.texture;
        scene.environmentIntensity = texture
          ? lighting.environment
          : lighting.fallbackEnvironment;
        hasHDR = Boolean(texture);
        applyRenderSettingsRef.current();
        scene.environmentRotation.y = Math.PI / 4;
        lightingReady = true;
        showReadyPreview();
      } catch {
        showFallback();
      } finally {
        texture?.dispose();
        room?.dispose();
        pmrem.dispose();
      }
    };

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 0.7;
      const keyLight = new THREE.DirectionalLight(
        0xffffff,
        lighting.keyIntensity,
      );
      keyLight.position.set(...lighting.keyPosition);
      scene.add(keyLight);
      const smooth =
        presentationProfile === "smooth-relief" ||
        presentationProfile === "smooth-cavity";
      const cavity = presentationProfile === "smooth-cavity";
      const organizer = presentationProfile === "matte-organizer";
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(
        0xffffff,
        smooth ? (cavity ? 1.5 : 3) : 0,
        4,
        4,
      );
      softbox.position.set(cavity ? 2 : -3, cavity ? 1.5 : 4, cavity ? 5 : 3);
      if (organizer) softbox.position.set(-3, 4, 1);
      softbox.lookAt(0, 0, 0);
      scene.add(softbox);
      let rimLight: THREE.DirectionalLight | undefined;
      if (lighting.rimIntensity > 0) {
        rimLight = new THREE.DirectionalLight(
          0xffffff,
          lighting.rimIntensity,
        );
        rimLight.position.set(2, 2, -3);
        scene.add(rimLight);
      }
      composer = new EffectComposer(renderer);
      ambientOcclusion = new GTAOPass(scene, camera, 1, 1);
      ambientOcclusion.blendIntensity = lighting.aoIntensity;
      applyRenderSettingsRef.current = () => {
        if (!renderer || !ambientOcclusion || disposed) return;
        const settings = renderSettingsRef.current;
        const softness = settings?.softness ?? 0;
        const key = settings?.key ?? lighting.keyIntensity;
        const darkness = glowFieldRef.current ? darknessRef.current : 0;
        const illumination = 1 - darkness * 0.97;
        renderer.toneMappingExposure = settings?.exposure ?? 0.7;
        scene.environmentIntensity =
          (settings?.environment ??
            (hasHDR ? lighting.environment : lighting.fallbackEnvironment)) *
          illumination;
        keyLight.intensity = key * (1 - softness) * illumination;
        if (rimLight)
          rimLight.intensity =
            lighting.rimIntensity * (1 - softness) * illumination;
        softbox.width = softbox.height = 4 + 2 * softness;
        softbox.intensity =
          (((settings?.fill ?? (smooth ? (cavity ? 1.5 : 3) : 0)) +
            key * softness) *
            16) /
          (softbox.width * softbox.height) *
          illumination;
        ambientOcclusion.blendIntensity =
          settings?.occlusion ?? lighting.aoIntensity;
        ambientOcclusion.updateGtaoMaterial({
          radius: settings?.ao_radius || lighting.aoRadius,
        });
        contactShadow?.update(settings);
        if (modelRef.current) {
          updateModelSurface(modelRef.current, settings);
          updateModelGlow(modelRef.current, glowFieldRef.current, darkness);
        }
        canvas.parentElement?.style.setProperty(
          "--tfs-glow-darkness",
          String(darkness),
        );
        if (darkness > 0 && !bloom && composer) {
          bloom = new UnrealBloomPass(
            new THREE.Vector2(
              canvas.clientWidth || 1,
              canvas.clientHeight || 1,
            ),
            0.15,
            0.2,
            0.7,
          );
          composer.insertPass(bloom, 2);
        }
        if (bloom) {
          bloom.enabled = darkness > 0;
          bloom.strength = 0.15 * darkness;
        }
      };
      applyRenderSettingsRef.current();
      outputPass = new OutputPass();
      antialiasPass = new FXAAPass();
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(ambientOcclusion);
      composer.addPass(outputPass);
      composer.addPass(antialiasPass);
      renderRef.current = () => {
        if (!lightingReady) return;
        if (contactShadow && modelRef.current)
          contactShadow.object.rotation.copy(modelRef.current.rotation);
        composer?.render(0);
      };
      qualityRef.current = applyQuality;
      applyQuality(expandedRef.current);
      resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(resize);
      resizeObserver?.observe(canvas);
      window.addEventListener("resize", resize);
      if (environmentUrl) {
        new HDRLoader().load(environmentUrl, finishLighting, undefined, () =>
          finishLighting(),
        );
      } else {
        finishLighting();
      }
      loader.load(
        src,
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;
          styleStudioModel(
            model,
            bodyColorRef.current,
            lidColorRef.current,
            materialColorsRef.current,
            presentationProfile,
          );
          updateModelFinishes(model, materialFinishesRef.current);
          updateModelConfiguration(model, configurationRef.current);
          labelLocalizerRef.current = createModelLabelLocalizer(model, {
            fallbackLocales: labelLocalesRef.current,
          });
          labelLocalizerRef.current.setLocale(localeRef.current);
          const presentation = preparePresentation(
            model,
            sourceRotationXDegrees,
            sourceRotationYDegrees,
            sourceRotationZDegrees,
          );
          modelRef.current = presentation;
          updateModelVariant(presentation, variantSKURef.current);
          illustrationToggleRef.current =
            createModelIllustrationToggle(presentation);
          illustrationToggleRef.current.setVisible(!illustrationsHiddenRef.current);
          setIllustrationSource(
            illustrationToggleRef.current.count > 0 ? src : null,
          );
          contactShadow = createStudioContactShadow(presentation, organizer);
          contactShadowRef.current = contactShadow;
          if (contactShadow) scene.add(contactShadow.object);
          applyRenderSettingsRef.current();
          scene.add(presentation);
          showReadyPreview();
        },
        undefined,
        showFallback,
      );
    } catch {
      showFallback();
    }

    return () => {
      disposed = true;
      cancelIntroRotation();
      renderRef.current = () => undefined;
      qualityRef.current = () => undefined;
      applyRenderSettingsRef.current = () => undefined;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      window.removeEventListener("resize", resize);
      resizeObserver?.disconnect();
      labelLocalizerRef.current?.dispose();
      labelLocalizerRef.current = null;
      illustrationToggleRef.current = null;
      contactShadow?.dispose();
      contactShadowRef.current = null;
      modelRef.current?.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        if (Array.isArray(object.material))
          object.material.forEach((material) => material.dispose());
        else object.material.dispose();
      });
      modelRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      ambientOcclusion?.dispose();
      bloom?.dispose();
      if (glowFrameRef.current !== null)
        window.cancelAnimationFrame(glowFrameRef.current);
      glowFrameRef.current = null;
      darknessRef.current = 0;
      outputPass?.dispose();
      antialiasPass?.dispose();
      composer?.dispose();
      studioEnvironment?.dispose();
      renderer?.dispose();
      dracoLoader.dispose();
    };
  }, [
    cancelIntroRotation,
    dracoDecoderPath,
    environmentUrl,
    onReady,
    scheduleDraw,
    presentationProfile,
    sourceRotationXDegrees,
    sourceRotationYDegrees,
    sourceRotationZDegrees,
    src,
  ]);

  const previewStyle = {
    "--tfs-body-0": `color-mix(in srgb, ${bodyColor} 58%, #23352b)`,
    "--tfs-body-1": `color-mix(in srgb, ${bodyColor} 82%, #23352b)`,
    "--tfs-body-2": bodyColor,
    "--tfs-lid-0": `color-mix(in srgb, ${lidColor} 58%, #23352b)`,
    "--tfs-lid-1": `color-mix(in srgb, ${lidColor} 82%, #23352b)`,
    "--tfs-lid-2": lidColor,
    ...style,
  } as CSSProperties;
  const fallbackMarkup =
    fallbackContent && fallbackContent.src === fallbackSrc
      ? fallbackContent.markup
      : null;
  const previewNotice =
    status === "ready" &&
    previewNoticeState?.src === src &&
    previewNoticeState.locale === locale
      ? previewNoticeState.text
      : "";
  const rootClassName = className
    ? `tfs-preview ${className}`
    : "tfs-preview";

  return (
    <div
      className={rootClassName}
      style={previewStyle}
      role="group"
      aria-label={alt}
      aria-busy={status === "loading"}
      data-studio-viewer
      data-render-mode={status === "ready" ? "webgl" : status}
    >
      <canvas
        ref={canvasRef}
        className="tfs-canvas"
        role="slider"
        tabIndex={0}
        aria-label={rotationLabel}
        aria-valuemin={-180}
        aria-valuemax={180}
        aria-valuenow={yawDegrees}
        aria-valuetext={`${yawDegrees}°`}
        aria-keyshortcuts={onActivate ? "Enter" : undefined}
        onPointerDown={(event) => {
          cancelIntroRotation();
          pointerRef.current = {
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startYaw: yawRef.current,
            dragged: false,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
          event.currentTarget.focus();
        }}
        onPointerMove={(event) => {
          const pointer = pointerRef.current;
          if (!pointer || pointer.id !== event.pointerId) return;
          if (
            Math.hypot(
              event.clientX - pointer.startX,
              event.clientY - pointer.startY,
            ) > 6
          ) {
            pointer.dragged = true;
          }
          applyYaw(pointer.startYaw + (event.clientX - pointer.startX) * 0.45);
        }}
        onPointerUp={(event) => {
          const pointer = pointerRef.current;
          if (pointer?.id !== event.pointerId) return;
          pointerRef.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          const releasedAsTap =
            Math.hypot(
              event.clientX - pointer.startX,
              event.clientY - pointer.startY,
            ) <= 6;
          if (!pointer.dragged && releasedAsTap) {
            onActivate?.();
            if (onPick && sceneRef.current && cameraRef.current) {
              const bounds = event.currentTarget.getBoundingClientRect();
              const point = new THREE.Vector2(
                ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 -
                  1,
                -((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 +
                  1,
              );
              const raycaster = new THREE.Raycaster();
              raycaster.setFromCamera(point, cameraRef.current);
              const hit = raycaster
                .intersectObjects(sceneRef.current.children, true)
                .find(
                  (entry) =>
                    typeof entry.object.userData[STUDIO_OCCURRENCE_ID_KEY] ===
                    "string",
                );
              const occurrenceKey =
                hit?.object.userData[STUDIO_OCCURRENCE_ID_KEY];
              if (occurrenceKey) onPick(occurrenceKey);
            }
          }
        }}
        onPointerCancel={() => {
          pointerRef.current = null;
        }}
        onKeyDown={(event) => {
          cancelIntroRotation();
          if (event.key === "Home") {
            event.preventDefault();
            applyYaw(0);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            applyYaw(yawRef.current + (event.key === "ArrowLeft" ? -15 : 15));
          } else if (event.key === "Enter" && onActivate) {
            event.preventDefault();
            onActivate();
          }
        }}
      />
      {status === "loading" && (
        <div className="tfs-loading">
          {loadingContent ?? <DefaultLoadingIndicator label={loadingLabel} />}
        </div>
      )}
      {status === "fallback" && fallbackMarkup && (
        <div
          className="tfs-fallback"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: fallbackMarkup }}
        />
      )}
      {status === "fallback" && !fallbackMarkup && (
        <span className="tfs-status">{errorContent ?? fallbackLabel}</span>
      )}
      {status === "ready" && previewNotice && (
        <p className="tfs-illustration-notice">{previewNotice}</p>
      )}
      {status === "ready" && illustrationSource === src && (
        <div className="tfs-illustration-controls">
          <button
            type="button"
            className="tfs-view-button"
            aria-pressed={illustrationsHidden}
            title={illustrationLabels.title}
            onClick={() => setIllustrationsHidden((hidden) => !hidden)}
          >
            {illustrationsHidden
              ? illustrationLabels.show
              : illustrationLabels.hide}
          </button>
        </div>
      )}
      {glowFieldKey && status === "ready" ? (
        <div className="tfs-glow-controls">
          <button
            type="button"
            className="tfs-view-button"
            aria-pressed={glowPlaying}
            onClick={glowPlaying ? stopGlowDemo : startGlowDemo}
          >
            {glowPlaying ? glowLabels.daylight : glowLabels.tryDark}
          </button>
          <span>{glowLabels.simulation}</span>
        </div>
      ) : null}
      {viewLabels && status === "ready" && (
        <div
          className="tfs-view-controls"
          role="group"
          aria-label={alt}
        >
          <button
            type="button"
            className="tfs-view-button"
            aria-pressed={Math.abs(yawDegrees) < 90}
            onClick={() => {
              cancelIntroRotation();
              applyYaw(0);
            }}
          >
            {viewLabels.front}
          </button>
          <button
            type="button"
            className="tfs-view-button"
            aria-pressed={Math.abs(yawDegrees) >= 90}
            onClick={() => {
              cancelIntroRotation();
              applyYaw(180);
            }}
          >
            {viewLabels.back}
          </button>
        </div>
      )}
    </div>
  );
}
