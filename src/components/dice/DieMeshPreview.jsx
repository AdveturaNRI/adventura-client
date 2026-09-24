import { createContext, useContext, useEffect, useRef, useState, } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
const SharedCtx = createContext(null);
const THEME_ROOT = '/dice-box/themes/default/';
const CDN_THEME = 'https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1.1.4/dist/assets/themes/default/';
const DIE_NAMES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
function loadScript(src) {
    return new Promise((resolve, reject) => {
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
        if (res.ok)
            return THEME_ROOT;
    }
    catch {
        // fall through
    }
    // No preview.babylon → clean default.json once into memory (data: import).
    for (const root of [THEME_ROOT, CDN_THEME]) {
        try {
            const res = await fetch(`${root}default.json`);
            if (!res.ok)
                continue;
            await buildCleanPreview(await res.json());
            return root;
        }
        catch {
            // try next
        }
    }
    throw new Error('dice theme unavailable');
}
async function buildCleanPreview(data) {
    // Store cleaned JSON on window so ImportMesh can use data: without re-fetch physics spam.
    if (Array.isArray(data.meshes)) {
        data.meshes = data.meshes
            .filter((m) => DIE_NAMES.includes(String(m.name || '')))
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
    delete data.colliderFaceMap;
    window.__ADVENTURA_DIE_PREVIEW__ =
        JSON.stringify(data);
}
function dieLabel(sides) {
    return `d${sides}`;
}
function DieTextFallback({ sides, size, active, themeColor, }) {
    const colors = useTheme();
    const label = dieLabel(sides);
    const fontSize = Math.max(12, Math.round(size * (label.length > 3 ? 0.28 : 0.34)));
    const tint = themeColor || colors.primary;
    return (<View style={[
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
    </View>);
}
/** Prefetch Babylon + theme root once for all picker cards. */
export function DieMeshPreviewProvider({ children }) {
    const [shared, setShared] = useState(null);
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
/**
 * Real @3d-dice/dice-box theme mesh in a small WebGL canvas.
 * Text label (d4 / d20…) while loading or if 3D assets fail.
 */
function hexToBabylonColor3(BABYLON, hex) {
    try {
        return BABYLON.Color3.FromHexString(hex);
    }
    catch {
        return new BABYLON.Color3(0.082, 0.478, 0.996);
    }
}
function applyDieAccent(BABYLON, themeRoot, scene, mat, hex) {
    const theme = hexToBabylonColor3(BABYLON, hex);
    const luma = 0.2126 * theme.r + 0.7152 * theme.g + 0.0722 * theme.b;
    const diffuseName = luma > 0.55 ? 'diffuse-dark.png' : 'diffuse-light.png';
    mat.setColor3('themeColor', theme);
    // Не пересоздаём текстуру на каждый кадр/смену цвета в той же luma-зоне — иначе превью мигает.
    if (mat.__adventuraDiffuse === diffuseName) {
        return;
    }
    mat.__adventuraDiffuse = diffuseName;
    const diffuseTex = new BABYLON.Texture(`${themeRoot}${diffuseName}`, scene);
    diffuseTex.hasAlpha = true;
    mat.setTexture('diffuseSampler', diffuseTex);
}
export function DieMeshPreview({ sides, size = 56, active = true, themeColor, }) {
    const colors = useTheme();
    const accent = themeColor?.trim() || colors.primary;
    const shared = useContext(SharedCtx);
    const canvasRef = useRef(null);
    const materialRef = useRef(null);
    const accentRef = useRef(accent);
    accentRef.current = accent;
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    // Build WebGL scene once per die — remounting all 7 on color change hits browser context limits.
    useEffect(() => {
        if (Platform.OS !== 'web' || !shared || !canvasRef.current) {
            return;
        }
        const { BABYLON, themeRoot } = shared;
        const canvas = canvasRef.current;
        let disposed = false;
        let engine;
        let scene;
        const die = dieLabel(sides);
        setReady(false);
        setFailed(false);
        materialRef.current = null;
        const failTimer = window.setTimeout(() => {
            if (!disposed)
                setFailed(true);
        }, 10000);
        try {
            engine = new BABYLON.Engine(canvas, true, {
                preserveDrawingBuffer: true,
                adaptToDeviceRatio: true,
                alpha: true,
                antialias: true,
            });
            scene = new BABYLON.Scene(engine);
            scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
            new BABYLON.HemisphericLight('h', new BABYLON.Vector3(0.25, 1, 0.35), scene).intensity = 1.15;
            new BABYLON.DirectionalLight('k', new BABYLON.Vector3(-0.45, -1, 0.55), scene).intensity = 1.05;
            const camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 3.1, Math.PI / 2.5, 2.5, BABYLON.Vector3.Zero(), scene);
            camera.inputs.clear();
            scene.activeCamera = camera;
            const onMeshes = (meshes) => {
                if (disposed)
                    return;
                window.clearTimeout(failTimer);
                const mesh = meshes.find((m) => m.name === die) ||
                    meshes.find((m) => DIE_NAMES.includes(String(m.name))) ||
                    meshes[0];
                if (!mesh) {
                    setFailed(true);
                    return;
                }
                for (const m of meshes) {
                    const keep = m === mesh || m.parent === mesh;
                    m.setEnabled(keep);
                    m.isVisible = keep;
                }
                // Package meshes ship without materials — match dice-box color shader:
                // finalColor = mix(themeColor.rgb, texture.rgb, texture.a)
                mesh.scaling.set(10, 10, 10);
                mesh.rotation.set(0.35, 0.7, 0.1);
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
                const mat = new BABYLON.ShaderMaterial(`${die}-mat`, scene, {
                    vertex: 'adventuraDie',
                    fragment: 'adventuraDie',
                }, {
                    attributes: ['position', 'normal', 'uv'],
                    uniforms: ['world', 'worldViewProjection', 'themeColor', 'lightDir'],
                    samplers: ['diffuseSampler'],
                });
                mat.setVector3('lightDir', new BABYLON.Vector3(-0.45, -1, 0.55));
                mat.backFaceCulling = true;
                applyDieAccent(BABYLON, themeRoot, scene, mat, accentRef.current);
                mesh.material = mat;
                mesh.getChildMeshes?.(true)?.forEach((child) => {
                    child.material = mat;
                });
                if (disposed) {
                    try {
                        mat.dispose?.();
                    }
                    catch {
                        // ignore
                    }
                    return;
                }
                materialRef.current = { BABYLON, themeRoot, scene, mat };
                mesh.computeWorldMatrix(true);
                const bi = mesh.getHierarchyBoundingVectors(true);
                const sizeVec = bi.max.subtract(bi.min);
                const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 0.01);
                camera.setTarget(BABYLON.Vector3.Center(bi.min, bi.max));
                camera.radius = maxDim * 2.35;
                camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius;
                // Static pose — one paint, no render loop (avoids WebGL spam on unmount).
                engine.resize();
                scene.render();
                setReady(true);
            };
            const onError = (_s, message) => {
                console.error('[DieMeshPreview] import', die, message);
                if (!disposed)
                    setFailed(true);
            };
            const mem = window.__ADVENTURA_DIE_PREVIEW__;
            if (mem) {
                BABYLON.SceneLoader.ImportMesh(die, themeRoot, `data:${mem}`, scene, onMeshes, null, onError);
            }
            else {
                BABYLON.SceneLoader.ImportMesh(die, themeRoot, 'preview.babylon', scene, onMeshes, null, onError);
            }
        }
        catch (err) {
            console.error('[DieMeshPreview]', err);
            voidMicrotask(() => {
                if (!disposed)
                    setFailed(true);
            });
        }
        const onResize = () => {
            if (disposed)
                return;
            try {
                engine?.resize?.();
                scene?.render?.();
            }
            catch {
                // ignore
            }
        };
        window.addEventListener('resize', onResize);
        return () => {
            disposed = true;
            materialRef.current = null;
            window.clearTimeout(failTimer);
            window.removeEventListener('resize', onResize);
            try {
                engine?.stopRenderLoop?.();
                scene?.dispose?.();
                engine?.dispose?.();
            }
            catch {
                // ignore
            }
        };
    }, [shared, sides]);
    useEffect(() => {
        const handle = materialRef.current;
        if (!handle) {
            return;
        }
        applyDieAccent(handle.BABYLON, handle.themeRoot, handle.scene, handle.mat, accent);
        try {
            handle.scene?.render?.();
        }
        catch {
            // ignore
        }
    }, [accent]);
    const showText = Platform.OS !== 'web' || failed || !shared || !ready;
    if (Platform.OS !== 'web') {
        return <DieTextFallback sides={sides} size={size} active={active} themeColor={accent}/>;
    }
    return (<div style={{
            width: size,
            height: size,
            position: 'relative',
            opacity: active ? 1 : 0.45,
        }}>
      {showText ? (<DieTextFallback sides={sides} size={size} active themeColor={accent}/>) : null}
      <canvas ref={canvasRef} width={Math.max(128, Math.round(size * 2))} height={Math.max(128, Math.round(size * 2))} style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: failed ? 'none' : 'block',
            borderRadius: 8,
            background: 'transparent',
            opacity: ready ? 1 : 0,
            pointerEvents: 'none',
        }}/>
    </div>);
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
