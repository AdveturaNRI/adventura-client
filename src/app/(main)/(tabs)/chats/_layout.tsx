import { Slot, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ChatVoicePlaybackBar } from '@/components/chats/ChatVoicePlaybackBar';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { stackScreenOptions } from '@/constants/navigation.config';
import { VoicePlaybackProvider } from '@/context/VoicePlaybackContext';
import { useTheme } from '@/hooks/use-theme';
import ChatsScreen from '@/screens/main/ChatsScreen';

function ChatsShell() {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();

  return (
    <View style={styles.root}>
      <ChatVoicePlaybackBar />
      {isDesktopWeb ? (
        <View style={styles.split}>
          <View style={[styles.rail, { borderRightColor: colors.border, backgroundColor: colors.background }]}>
            <ChatsScreen variant="rail" />
          </View>
          <View style={[styles.pane, { backgroundColor: colors.background }]}>
            <Slot />
          </View>
        </View>
      ) : (
        <View style={styles.pane}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background, flex: 1 },
              ...stackScreenOptions,
            }}
          />
        </View>
      )}
    </View>
  );
}

export default function ChatsLayout() {
  return (
    <VoicePlaybackProvider>
      <ChatsShell />
    </VoicePlaybackProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  split: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  rail: {
    width: 380,
    maxWidth: '40%',
    minWidth: 300,
    borderRightWidth: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  pane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
});
