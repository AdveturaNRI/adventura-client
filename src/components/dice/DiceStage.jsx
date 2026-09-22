import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState, } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';
import { buildDiceBoxNativeHtml } from '@/components/dice/dice-box-native-html';
import { FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { DEFAULT_DICE_ACCENT } from '@/utils/dice-color-storage';
const WebView = RNWebView;
function createStyles(colors) {
    return StyleSheet.create({
        wrap: {
            flex: 1,
            minHeight: 260,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: '#0B1220',
        },
        wrapTransparent: {
            minHeight: 0,
            borderRadius: 0,
            backgroundColor: 'transparent',
        },
        web: {
            flex: 1,
            backgroundColor: '#0B1220',
        },
        webTransparent: {
            backgroundColor: 'transparent',
        },
        fallback: {
            ...StyleSheet.absoluteFill,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
        },
        fallbackText: {
            color: colors.textSecondary,
            textAlign: 'center',
            fontSize: FontSize.label,
        },
    });
}
/**
 * Native: WebView wrapper around the same @3d-dice/dice-box engine (CDN assets).
 */
export const DiceStage = forwardRef(function DiceStage({ onReady, onDone, transparent = false, accent, skin, animationSpeed = 'normal' }, ref) {
    const colors = useTheme();
    const themeAccent = accent?.trim() || colors.primary || DEFAULT_DICE_ACCENT;
    const styles = useThemedStyles(createStyles);
    const bridgeRef = useRef(null);
    const speedRef = useRef(animationSpeed);
    speedRef.current = animationSpeed;
    const skinRef = useRef(skin ?? 'standard');
    skinRef.current = skin ?? 'standard';
    const pendingRef = useRef(null);
    const [failed, setFailed] = useState(false);
    const send = useCallback((payload) => {
        const json = JSON.stringify(payload);
        bridgeRef.current?.injectJavaScript?.(`window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(json)} })); true;`);
    }, []);
    useImperativeHandle(ref, () => ({
        roll: (notation) => new Promise((resolve, reject) => {
            pendingRef.current = { resolve, reject };
            send({ type: 'roll', notation, speed: speedRef.current, skin: skinRef.current });
        }),
        preview: (notation) => {
            send({ type: 'preview', notation: notation ?? [], speed: speedRef.current, skin: skinRef.current });
        },
        clear: () => {
            const pending = pendingRef.current;
            pendingRef.current = null;
            send({ type: 'clear' });
            pending?.reject(new Error('Dice roll cleared'));
        },
        resize: () => {
            send({ type: 'resize' });
        },
    }), [send]);
    const html = useMemo(() => buildDiceBoxNativeHtml({ accent: themeAccent, transparent }), [themeAccent, transparent]);
    return (<View style={[styles.wrap, transparent ? styles.wrapTransparent : null]} pointerEvents="none">
      {failed ? (<View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            Нужен интернет, чтобы загрузить 3D-кубики на устройстве
          </Text>
        </View>) : (<WebView key={themeAccent} ref={(node) => {
                bridgeRef.current = node;
            }} originWhitelist={['*']} source={{ html, baseUrl: 'https://unpkg.com' }} onMessage={(event) => {
                try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'ready') {
                        onReady?.();
                    }
                    if (data.type === 'done' && data.outcome) {
                        pendingRef.current?.resolve(data.outcome);
                        pendingRef.current = null;
                        onDone?.(data.outcome);
                    }
                    if (data.type === 'error') {
                        setFailed(true);
                        pendingRef.current?.reject(new Error(data.message || 'Dice error'));
                        pendingRef.current = null;
                    }
                }
                catch {
                    // ignore
                }
            }} style={[styles.web, transparent ? styles.webTransparent : null]} javaScriptEnabled domStorageEnabled mixedContentMode="always" allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} scrollEnabled={false} bounces={false} overScrollMode="never" setSupportMultipleWindows={false} androidLayerType="hardware" pointerEvents="none"/>)}
    </View>);
});
