import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { suggestAddresses, type GeocodeResult } from '@/services/clubs/clubsApi';

const SEARCH_DEBOUNCE_MS = 220;
const RESULTS_HEIGHT = 220;

type Props = {
  label: string;
  placeholder: string;
  value: string;
  cityLabel?: string;
  onChangeText: (text: string) => void;
  onSelect: (hit: GeocodeResult) => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      gap: Spacing.sm,
      position: 'relative',
      zIndex: 18,
    },
    wrapperRaised: {
      zIndex: 90,
    },
    webBackdrop: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
    },
    label: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      paddingLeft: Spacing.xs,
    },
    inputWrap: {
      position: 'relative',
      zIndex: 2,
    },
    input: {
      minHeight: Sizes.controlHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingRight: 44,
      fontSize: FontSize.input,
      color: colors.textSecondary,
      backgroundColor: colors.surface,
    },
    inputActions: {
      position: 'absolute',
      right: Spacing.sm,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
    },
    clearButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    results: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: Spacing.sm,
      maxHeight: RESULTS_HEIGHT,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 16,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      zIndex: 30,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 8,
    },
    resultsList: {
      maxHeight: RESULTS_HEIGHT,
    },
    resultItem: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      gap: 2,
    },
    resultItemPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    resultTitle: {
      fontSize: FontSize.input,
      fontWeight: '600',
      color: colors.text,
    },
    resultMeta: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.35,
    },
    emptyState: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: FontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    resultsSpacer: {
      height: RESULTS_HEIGHT + Spacing.sm,
    },
  });
}

export function AddressSuggestField({
  label,
  placeholder,
  value,
  cityLabel,
  onChangeText,
  onSelect,
}: Props) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [settled, setSettled] = useState(false);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const q = value.trim();
    if (!q) {
      setResults([]);
      setSettled(false);
      return;
    }

    if (!open) {
      return;
    }

    setSettled(false);
    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      void suggestAddresses(q, cityLabel)
        .then((items) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setResults(items);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setResults([]);
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setSettled(true);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, cityLabel, open]);

  const showDropdown =
    open && value.trim().length > 0 && (results.length > 0 || settled);

  return (
    <View style={[styles.wrapper, showDropdown && styles.wrapperRaised]}>
      {showDropdown && Platform.OS === 'web' ? (
        <Pressable style={styles.webBackdrop} onPress={() => setOpen(false)} />
      ) : null}

      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="sentences"
          style={styles.input}
        />
        {value.length > 0 ? (
          <View style={styles.inputActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Очистить адрес"
              onPress={() => {
                onChangeText('');
                setResults([]);
                setSettled(false);
                setOpen(false);
              }}
              style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {showDropdown ? (
          <View style={styles.results}>
            {results.length ? (
              <ScrollView
                style={styles.resultsList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled>
                {results.map((item) => {
                  const title = item.shortName || item.displayName;
                  const meta =
                    item.shortName && item.shortName !== item.displayName
                      ? item.displayName
                      : null;

                  return (
                    <Pressable
                      key={`${item.lat}:${item.lng}:${item.displayName}`}
                      onPress={() => {
                        onSelect(item);
                        setOpen(false);
                        setResults([]);
                        setSettled(false);
                      }}
                      style={({ pressed }) => [
                        styles.resultItem,
                        pressed && styles.resultItemPressed,
                      ]}>
                      <Text style={styles.resultTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      {meta ? (
                        <Text style={styles.resultMeta} numberOfLines={2}>
                          {meta}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.emptyState}>
                Ничего не нашлось — уточните улицу или дом
              </Text>
            )}
          </View>
        ) : null}
      </View>
      {showDropdown ? <View style={styles.resultsSpacer} /> : null}
    </View>
  );
}
