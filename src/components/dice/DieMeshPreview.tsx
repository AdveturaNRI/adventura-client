import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import type { DieGlyphSides } from '@/components/dice/DieGlyph';
import { FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type DieMeshPreviewProps = {
  sides: DieGlyphSides;
  size?: number;
  active?: boolean;
  /** Hex body color; defaults to saved dice accent / theme primary. */
  themeColor?: string;
  /** Kept for API compat — snapshots don't hold a live GL context. */
  paused?: boolean;
};

type SharedAssets = {
  BABYLON: any;
  themeRoot: string;
};

const SharedCtx = createContext<SharedAssets | null>(null);

const THEME_ROOT = '/dice-box/themes/default/';
const CDN_THEME =
  'https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1.1.4/dist/assets/themes/default/';
const DIE_NAMES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;

/** sides:accent → dataURL. Reopen popover without creating 7 WebGL contexts again. */
const snapshotCache = new Map<string, string>();

/** One live preview engine at a time — 7 parallel Babylon + roll iframe = white screen even on a beefy PC. */
let previewBuildChain: Promise<void> = Promise.resolve();

function enqueuePreviewBuild(task: () => Promise<void>) {
  const run = previewBuildChain.then(task, task);
  previewBuildChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

declare global {
  interface Window {
    BABYLON?: any;
    __ADVENTURA_DIE_PREVIEW__?: string;
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureBabylon() {
  if (window.BABYLON?.Engine) {
    return window.BABYLON;
  }
  await loadScript('https://cdn.babylonjs.com/v5.57.1/babylon.js');
  await loadScript('https://cdn.babylonjs.com/v5.57.1/loaders/babylonjs.loaders.min.js');
  return window.BABYLON;
}

async function resolveThemeRoot() {
  try {
    const res = await fetch(`${THEME_ROOT}preview.babylon`);
    if (res.ok) return THEME_ROOT;
  } catch {
    // fall through
  }
  for (const root of [THEME_ROOT, CDN_THEME]) {
    try {
      const res = await fetch(`${root}default.json`);
      if (!res.ok) continue;
      await buildCleanPreview(await res.json());
      return root;
    } catch {
      // try next
    }
  }
  throw new Error('dice theme unavailable');
}

async function buildCleanPreview(data: Record<string, unknown>) {
  if (Array.isArray(data.meshes)) {
    data.meshes = (data.meshes as Record<string, unknown>[])
      .filter((m) => DIE_NAMES.includes(String(m.name || '') as (typeof DIE_NAMES)[number]))
      .map((m) => {
        const copy = { ...m };
        delete copy.physicsImpostor;
        delete copy.physicsMass;
        delete copy.physicsFriction;
        delete copy.physicsRestitution;
        return copy;
      });
  }
  delete data.gravity;
  window.__ADVENTURA_DIE_PREVIEW__ = JSON.stringify(data);
}

function dieLabel(sides: DieGlyphSides) {
  return `d${sides}`;
}

function DieTextFallback({
  sides,
  size,
  active,
  themeColor,
}: {
  sides: DieGlyphSides;
  size: number;
  active: boolean;
  themeColor: string;
}) {
  const colors = useTheme();
  const label = dieLabel(sides);
  const fontSize = Math.max(12, Math.round(size * (label.length > 3 ? 0.28 : 0.34)));
  const tint = themeColor || colors.primary;

  return (
    <View
      style={[
        styles.textWrap,
        {
          width: size,
          height: size,
          opacity: active ? 1 : 0.45,
          borderColor: active ? tint : colors.border,
          backgroundColor: active ? `${tint}22` : 'transparent',
        },
      ]}>
      <Text style={[styles.textLabel, { color: tint, fontSize }]}>{label}</Text>
    </View>
  );
}

/** Prefetch Babylon + theme root once for all picker cards. */
export function DieMeshPreviewProvider({ children }: { children: ReactNode }) {
  const [shared, setShared] = useState<SharedAssets | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    let cancelled = false;

    (async () => {
      const BABYLON = await ensureBabylon();
      const themeRoot = await resolveThemeRoot();
      if (!cancelled) {
        setShared({ BABYLON, themeRoot });
      }
    })().catch((err) => {
      console.error('[DieMeshPreview] assets', err);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return <SharedCtx.Provider value={shared}>{children}</SharedCtx.Provider>;
}

function hexToBabylonColor3(BABYLON: any, hex: string) {
  try {
    return BABYLON.Color3.FromHexString(hex);
  } catch {
    return new BABYLON.Color3(0.082, 0.478, 0.996);
  }
}

function applyDieAccent(
  BABYLON: any,
  themeRoot: string,
  scene: any,
  mat: any,
  hex: string,
) {
  const theme = hexToBabylonColor3(BABYLON, hex);
  const luma = 0.2126 * theme.r + 0.7152 * theme.g + 0.0722 * theme.b;
  const diffuseName = luma > 0.55 ? 'diffuse-dark.png' : 'diffuse-light.png';
  mat.setColor3('themeColor', theme);
  if ((mat as { __adventuraDiffuse?: string }).__adventuraDiffuse === diffuseName) {
    return null;
  }
  (mat as { __adventuraDiffuse?: string }).__adventuraDiffuse = diffuseName;
  const diffuseTex = new BABYLON.Texture(`${themeRoot}${diffuseName}`, scene);
  diffuseTex.hasAlpha = true;
  mat.setTexture('diffuseSampler', diffuseTex);
  return diffuseTex;
}

function waitTextureReady(tex: any, timeoutMs = 8000): Promise<void> {
  if (!tex) {
    return Promise.resolve();
  }
  if (typeof tex.isReady === 'function' && tex.isReady()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    try {
      tex.onLoadObservable?.addOnce?.(() => {
        window.clearTimeout(timer);
        finish();
      });
    } catch {
      window.clearTimeout(timer);
      finish();
    }
  });
}

function disposeEngine(engine: any, scene: any) {
  try {
    engine?.stopRenderLoop?.();
  } catch {
    // ignore
  }
  try {
    scene?.dispose?.();
  } catch {
    // ignore
  }
  try {
    engine?.dispose?.();
  } catch {
    // ignore
  }
}

/**
 * Real @3d-dice theme mesh, snapshotted to an image.
 * Live WebGL is released after capture so the roll iframe isn't fighting 7 contexts.
 */
export function DieMeshPreview({
  sides,
  size = 56,
  active = true,
  themeColor,
}: DieMeshPreviewProps) {
  const colors = useTheme();
  const accent = themeColor?.trim() || colors.primary;
  const shared = useContext(SharedCtx);
  const cacheKey = `${sides}:${accent.toLowerCase()}`;
  const [snapshot, setSnapshot] = useState<string | null>(
    () => snapshotCache.get(cacheKey) ?? null,
  );
  const [failed, setFailed] = useState(false);
  const genRef = useRef(0);

  useEffect(() => {
    const cached = snapshotCache.get(cacheKey);
    if (cached) {
      setSnapshot(cached);
      setFailed(false);
      return;
    }

    if (Platform.OS !== 'web' || !shared || typeof document === 'undefined') {
      return;
    }

    const { BABYLON, themeRoot } = shared;
    const die = dieLabel(sides);
    const gen = ++genRef.current;
    let cancelled = false;

    setFailed(false);

    void enqueuePreviewBuild(async () => {
      if (cancelled || gen !== genRef.current) {
        return;
      }

      const canvas = document.createElement('canvas');
      const px = Math.max(128, Math.round(size * 2));
      canvas.width = px;
      canvas.height = px;
      canvas.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
      document.body.appendChild(canvas);

      let engine: any;
      let scene: any;

      try {
        engine = new BABYLON.Engine(canvas, true, {
          preserveDrawingBuffer: true,
          adaptToDeviceRatio: false,
          alpha: true,
          antialias: true,
        });
        scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

        new BABYLON.HemisphericLight('h', new BABYLON.Vector3(0.25, 1, 0.35), scene).intensity =
          1.15;
        new BABYLON.DirectionalLight('k', new BABYLON.Vector3(-0.45, -1, 0.55), scene).intensity =
          1.05;

        const camera = new BABYLON.ArcRotateCamera(
          'cam',
          -Math.PI / 3.1,
          Math.PI / 2.5,
          2.5,
          BABYLON.Vector3.Zero(),
          scene,
        );
        camera.inputs.clear();
        scene.activeCamera = camera;

        if (!BABYLON.Effect.ShadersStore.adventuraDieVertexShader) {
          BABYLON.Effect.ShadersStore.adventuraDieVertexShader = `
            precision highp float;
            attribute vec3 position;
            attribute vec3 normal;
            attribute vec2 uv;
            uniform mat4 world;
            uniform mat4 worldViewProjection;
            varying vec2 vUV;
            varying vec3 vNormalW;
            void main() {
              vec4 p = vec4(position, 1.0);
              gl_Position = worldViewProjection * p;
              vUV = uv;
              vNormalW = normalize(vec3(world * vec4(normal, 0.0)));
            }
          `;
          BABYLON.Effect.ShadersStore.adventuraDieFragmentShader = `
            precision highp float;
            varying vec2 vUV;
            varying vec3 vNormalW;
            uniform sampler2D diffuseSampler;
            uniform vec3 themeColor;
            uniform vec3 lightDir;
            void main() {
              vec4 tex = texture2D(diffuseSampler, vUV);
              vec3 base = mix(themeColor, tex.rgb, tex.a);
              float ndl = max(0.42, dot(normalize(vNormalW), normalize(-lightDir)));
              float rim = pow(1.0 - max(0.0, dot(normalize(vNormalW), vec3(0.0, 0.0, 1.0))), 2.0) * 0.12;
              gl_FragColor = vec4(base * (0.55 + 0.55 * ndl) + vec3(rim), 1.0);
            }
          `;
        }

        const meshes: any[] = await new Promise((resolve, reject) => {
          const onError = (_s: unknown, message?: string) => {
            reject(new Error(message || 'import failed'));
          };
          const onMeshes = (loaded: any[]) => resolve(loaded);
          const mem = window.__ADVENTURA_DIE_PREVIEW__;
          if (mem) {
            BABYLON.SceneLoader.ImportMesh(
              die,
              themeRoot,
              `data:${mem}`,
              scene,
              onMeshes,
              null,
              onError,
            );
          } else {
            BABYLON.SceneLoader.ImportMesh(
              die,
              themeRoot,
              'preview.babylon',
              scene,
              onMeshes,
              null,
              onError,
            );
          }
        });

        if (cancelled || gen !== genRef.current) {
          disposeEngine(engine, scene);
          canvas.remove();
          return;
        }

        const mesh =
          meshes.find((m) => m.name === die) ||
          meshes.find((m) => DIE_NAMES.includes(String(m.name) as (typeof DIE_NAMES)[number])) ||
          meshes[0];

        if (!mesh) {
          throw new Error('mesh missing');
        }

        for (const m of meshes) {
          const keep = m === mesh || m.parent === mesh;
          m.setEnabled(keep);
          m.isVisible = keep;
        }

        mesh.scaling.set(10, 10, 10);
        mesh.rotation.set(0.35, 0.7, 0.1);

        const mat = new BABYLON.ShaderMaterial(
          `${die}-mat`,
          scene,
          { vertex: 'adventuraDie', fragment: 'adventuraDie' },
          {
            attributes: ['position', 'normal', 'uv'],
            uniforms: ['world', 'worldViewProjection', 'themeColor', 'lightDir'],
            samplers: ['diffuseSampler'],
          },
        );
        mat.setVector3('lightDir', new BABYLON.Vector3(-0.45, -1, 0.55));
        mat.backFaceCulling = true;
        const diffuseTex = applyDieAccent(BABYLON, themeRoot, scene, mat, accent);
        mesh.material = mat;
        mesh.getChildMeshes?.(true)?.forEach((child: any) => {
          child.material = mat;
        });

        mesh.computeWorldMatrix(true);
        const bi = mesh.getHierarchyBoundingVectors(true);
        const sizeVec = bi.max.subtract(bi.min);
        const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 0.01);
        camera.setTarget(BABYLON.Vector3.Center(bi.min, bi.max));
        camera.radius = maxDim * 2.35;
        camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius;

        await waitTextureReady(diffuseTex);
        // A couple of frames for shader compile.
        for (let i = 0; i < 4; i += 1) {
          if (cancelled || gen !== genRef.current) {
            break;
          }
          engine.resize();
          scene.render();
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }

        if (cancelled || gen !== genRef.current) {
          disposeEngine(engine, scene);
          canvas.remove();
          return;
        }

        const dataUrl = canvas.toDataURL('image/png');
        snapshotCache.set(cacheKey, dataUrl);
        setSnapshot(dataUrl);
        setFailed(false);
      } catch (err) {
        console.error('[DieMeshPreview]', die, err);
        if (!cancelled && gen === genRef.current) {
          setFailed(true);
        }
      } finally {
        disposeEngine(engine, scene);
        try {
          canvas.remove();
        } catch {
          // ignore
        }
      }
    });

    return () => {
      cancelled = true;
      genRef.current += 1;
    };
  }, [accent, cacheKey, shared, sides, size]);

  if (Platform.OS !== 'web') {
    return <DieTextFallback sides={sides} size={size} active={active} themeColor={accent} />;
  }

  const showText = failed || !snapshot;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        opacity: active ? 1 : 0.45,
      }}>
      {showText ? (
        <DieTextFallback sides={sides} size={size} active themeColor={accent} />
      ) : null}
      {snapshot ? (
        <img
          src={snapshot}
          alt=""
          width={size}
          height={size}
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            borderRadius: 8,
            display: 'block',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      ) : null}
    </div>
  );
}

const styles = StyleSheet.create({
  textWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  textLabel: {
    fontWeight: '800',
    letterSpacing: 0.2,
    includeFontPadding: false,
    fontSize: FontSize.caption,
  },
});
