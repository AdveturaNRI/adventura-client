import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import ChatsScreen from '@/screens/main/ChatsScreen';

export default function ChatsIndexScreen() {
  const isDesktopWeb = useIsDesktopWeb();
  const colors = useTheme();

  if (!isDesktopWeb) {
    return <ChatsScreen />;
  }

  return (
    <View style={styles.pane}>
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Выберите чат</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Переписка откроется здесь — список диалогов слева.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: 360,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.button,
    fontWeight: '700',
  },
  hint: {
    fontSize: FontSize.label,
    textAlign: 'center',
    lineHeight: FontSize.label * 1.45,
  },
});
