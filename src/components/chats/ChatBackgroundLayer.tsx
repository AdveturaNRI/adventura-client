import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  getChatBackgroundPreset,
  resolveChatBackground,
  resolveChatBackgroundDimmer,
  resolveChatBackgroundSync,
  resolvePresetColors,
  subscribeConversationChatBackground,
  subscribeGlobalChatBackground,
  type ChatBackgroundSetting,
} from '@/utils/chat-background-settings';

type ChatBackgroundLayerProps = {
  isDark: boolean;
  conversationId?: string | null;
  /** Signed URL протух — родитель пусть перезапросит conversation.background. */
  onCustomImageError?: () => void;
};

function PresetFill({ colors }: { colors: [string, string] }) {
  const webGradient =
    Platform.OS === 'web'
      ? ({
          backgroundImage: `linear-gradient(160deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
        } as object)
      : null;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors[0] }, webGradient]}>
      {Platform.OS !== 'web' ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors[1],
              opacity: 0.55,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

export function ChatBackgroundLayer({
  isDark,
  conversationId,
  onCustomImageError,
}: ChatBackgroundLayerProps) {
  const [setting, setSetting] = useState<ChatBackgroundSetting>(() =>
    resolveChatBackgroundSync(conversationId),
  );

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void resolveChatBackground(conversationId).then((next) => {
        if (!cancelled) setSetting(next);
      });
    };
    refresh();
    const unsubGlobal = subscribeGlobalChatBackground(() => refresh());
    const unsubChat = subscribeConversationChatBackground((id) => {
      if (id === '*' || id === conversationId) {
        refresh();
      }
    });
    return () => {
      cancelled = true;
      unsubGlobal();
      unsubChat();
    };
  }, [conversationId]);

  if (setting.kind === 'default') {
    return null;
  }

  const dimmer = resolveChatBackgroundDimmer(setting, isDark);
  const preset =
    setting.kind === 'preset' ? getChatBackgroundPreset(setting.presetId) : undefined;
  const presetColors = preset
    ? resolvePresetColors(preset, isDark)
    : (['#2A3138', '#1A1F24'] as [string, string]);

  return (
    <View pointerEvents="none" style={styles.root}>
      {setting.kind === 'preset' ? (
        <PresetFill colors={presetColors} />
      ) : (
        <Image
          source={{ uri: setting.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
          onError={() => {
            if (setting.uri.startsWith('http://') || setting.uri.startsWith('https://')) {
              onCustomImageError?.();
            }
          }}
        />
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(0,0,0,${dimmer})` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
});
