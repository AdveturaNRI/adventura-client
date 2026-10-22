import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const HINT_SHOW_DELAY_MS = 350;

type FieldLabelHintProps = {
  text: string;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    trigger: {
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
      width: 18,
      height: 18,
    },
    tooltip: {
      position: 'absolute',
      bottom: '100%',
      right: 0,
      marginBottom: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: 6,
      // Hard dark chip — readable on light and dark forms; CSS !important fights Safari.
      backgroundColor: '#2C2C2E',
      borderWidth: 1,
      borderColor: '#48484A',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 2,
      zIndex: 10,
      ...(Platform.OS === 'web'
        ? ({
            whiteSpace: 'nowrap',
            transitionProperty: 'opacity',
            transitionDuration: '120ms',
            transitionTimingFunction: 'ease-out',
          } as object)
        : null),
    },
    tooltipText: {
      fontSize: 11,
      lineHeight: 14,
      color: '#FFFFFF',
      fontWeight: '500',
    },
  });
}

export function FieldLabelHint({ text }: FieldLabelHintProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [hintVisible, setHintVisible] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
    };
  }, []);

  const showHint = () => {
    hintTimerRef.current = setTimeout(() => {
      setHintVisible(true);
    }, HINT_SHOW_DELAY_MS);
  };

  const hideHint = () => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    setHintVisible(false);
  };

  return (
    <Pressable
      onHoverIn={isWeb ? showHint : undefined}
      onHoverOut={isWeb ? hideHint : undefined}
      style={styles.trigger}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={text}>
      {isWeb && hintVisible ? (
        <View
          style={styles.tooltip}
          pointerEvents="none"
          {...({ className: 'adventura-field-hint' } as object)}>
          <Text
            style={styles.tooltipText}
            {...({ className: 'adventura-field-hint-text' } as object)}>
            {text}
          </Text>
        </View>
      ) : null}
      <Ionicons name="information-circle-outline" size={15} color={colors.textSubtle} />
    </Pressable>
  );
}
