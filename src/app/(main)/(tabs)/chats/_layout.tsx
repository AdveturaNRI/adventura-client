import { Slot, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { stackScreenOptions } from '@/constants/navigation.config';
import { useTheme } from '@/hooks/use-theme';
import ChatsScreen from '@/screens/main/ChatsScreen';

export default function ChatsLayout() {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();

  if (isDesktopWeb) {
    return (
      <View style={styles.split}>
        <View style={[styles.rail, { borderRightColor: colors.border, backgroundColor: colors.background }]}>
          <ChatsScreen variant="rail" />
        </View>
        <View style={[styles.pane, { backgroundColor: colors.background }]}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background, flex: 1 },
        ...stackScreenOptions,
      }}
    />
  );
}

const styles = StyleSheet.create({
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
  },
  pane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
});
