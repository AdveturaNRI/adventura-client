import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { toast } from '@/components/ui/feedback/toast';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { fetchNicknameSuggestion } from '@/services/auth/authApi';
import { localizeErrorMessage } from '@/utils/localizeError';

const DICE_HINT = 'Случайный никнейм';
const HINT_SHOW_DELAY_MS = 350;

type NicknameInputProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      gap: Spacing.sm,
      width: '100%',
      maxWidth: '100%',
    },
    label: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      paddingLeft: Spacing.xs,
    },
    field: {
      position: 'relative',
      justifyContent: 'center',
      overflow: 'visible',
      width: '100%',
      maxWidth: '100%',
    },
    input: {
      minHeight: Sizes.controlHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingRight: 48,
      fontSize: FontSize.input,
      color: colors.textSecondary,
      backgroundColor: colors.surface,
      width: '100%',
      maxWidth: '100%',
    },
    inputError: {
      borderColor: colors.destructive,
    },
    error: {
      fontSize: FontSize.caption,
      color: colors.destructive,
      paddingLeft: Spacing.xs,
    },
    diceButton: {
      position: 'absolute',
      right: Spacing.md,
      height: Sizes.controlHeight,
      justifyContent: 'center',
      alignItems: 'center',
      width: 32,
      zIndex: 2,
    },
    diceButtonDisabled: {
      opacity: 0.45,
    },
    tooltip: {
      position: 'absolute',
      bottom: '100%',
      right: -2,
      marginBottom: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
      ...(Platform.OS === 'web'
        ? ({
            opacity: 1,
            transitionProperty: 'opacity',
            transitionDuration: '120ms',
            transitionTimingFunction: 'ease-out',
            whiteSpace: 'nowrap',
          } as object)
        : null),
    },
    tooltipText: {
      fontSize: 11,
      lineHeight: 14,
      color: colors.textMuted,
    },
  });
}

export function NicknameInput({
  label,
  style,
  value,
  onChangeText,
  error,
  ...props
}: NicknameInputProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [hintVisible, setHintVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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

  const handleGenerate = async () => {
    if (isGenerating) return;

    setIsGenerating(true);

    try {
      const response = await fetchNicknameSuggestion();
      onChangeText(response.nickname);
    } catch (generateError) {
      toast.error(localizeErrorMessage(generateError, 'Не удалось сгенерировать никнейм'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, error ? styles.inputError : null, style]}
          editable={!isGenerating}
          {...props}
        />
        <Pressable
          onPress={handleGenerate}
          disabled={isGenerating}
          onHoverIn={isWeb ? showHint : undefined}
          onHoverOut={isWeb ? hideHint : undefined}
          style={[styles.diceButton, isGenerating ? styles.diceButtonDisabled : null]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Сгенерировать никнейм"
          accessibilityHint="Сгенерировать случайный никнейм">
          {isWeb && hintVisible ? (
            <View style={styles.tooltip} pointerEvents="none">
              <Text style={styles.tooltipText}>{DICE_HINT}</Text>
            </View>
          ) : null}
          <Ionicons name="dice-outline" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
