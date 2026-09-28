import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { FieldLabelHint } from '@/components/ui/inputs/FieldLabelHint';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const DEFAULT_MIN_HEIGHT = 120;
const VERTICAL_PADDING = Spacing.sm * 2;

type ScrollSnapshot = {
  node: Window | HTMLElement;
  top: number;
  left: number;
};

function collectScrollSnapshots(from: HTMLElement): ScrollSnapshot[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const snaps: ScrollSnapshot[] = [
    { node: window, top: window.scrollY, left: window.scrollX },
  ];

  let node: HTMLElement | null = from.parentElement;
  while (node) {
    snaps.push({ node, top: node.scrollTop, left: node.scrollLeft });
    node = node.parentElement;
  }

  return snaps;
}

function restoreScrollSnapshots(snaps: ScrollSnapshot[]): void {
  for (const snap of snaps) {
    if (snap.node === window) {
      window.scrollTo(snap.left, snap.top);
      continue;
    }

    const el = snap.node as HTMLElement;
    el.scrollTop = snap.top;
    el.scrollLeft = snap.left;
  }
}

type TextAreaProps = TextInputProps & {
  label: string;
  error?: string;
  labelHint?: string;
  minHeight?: number;
  maxHeight?: number;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      gap: Spacing.sm,
      width: '100%',
      maxWidth: '100%',
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingLeft: Spacing.xs,
      flexWrap: 'wrap',
      maxWidth: '100%',
    },
    label: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      flexShrink: 1,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
      fontSize: FontSize.input,
      lineHeight: FontSize.input * 1.45,
      color: colors.textSecondary,
      backgroundColor: colors.surface,
      textAlignVertical: 'top',
      width: '100%',
      maxWidth: '100%',
      ...(Platform.OS === 'web'
        ? ({
            resize: 'none',
          } as object)
        : null),
    },
    inputError: {
      borderColor: colors.destructive,
    },
    error: {
      fontSize: FontSize.caption,
      color: colors.destructive,
      paddingLeft: Spacing.xs,
    },
    counter: {
      alignSelf: 'flex-end',
      fontSize: FontSize.caption,
      color: colors.textMuted,
      paddingRight: Spacing.xs,
    },
    counterLimit: {
      color: colors.destructive,
      fontWeight: '600',
    },
  });
}

export function TextArea({
  label,
  error,
  labelHint,
  minHeight = DEFAULT_MIN_HEIGHT,
  maxHeight,
  style,
  value,
  onChangeText,
  onContentSizeChange,
  maxLength,
  ...props
}: TextAreaProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const inputRef = useRef<TextInput>(null);
  const [height, setHeight] = useState(minHeight);

  const resolveHeight = useCallback(
    (nextHeight: number) => {
      const withMin = Math.max(nextHeight, minHeight);

      if (maxHeight == null) {
        return withMin;
      }

      return Math.min(withMin, maxHeight);
    },
    [maxHeight, minHeight],
  );

  const syncedValueRef = useRef(typeof value === 'string' ? value : '');

  const syncWebHeight = useCallback(() => {
    const element = inputRef.current as unknown as HTMLTextAreaElement | null;

    if (!element) {
      return;
    }

    // Collapsing height to 0/auto jumps RN Web ScrollView (and the window) to the top.
    const snaps = collectScrollSnapshots(element);
    const previousHeight = element.style.height;
    element.style.height = 'auto';
    const nextHeight = resolveHeight(element.scrollHeight);
    element.style.height = previousHeight;
    restoreScrollSnapshots(snaps);

    element.style.height = `${nextHeight}px`;
    restoreScrollSnapshots(snaps);

    setHeight((current) => (current === nextHeight ? current : nextHeight));
  }, [resolveHeight]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const nextValue = typeof value === 'string' ? value : '';
    if (syncedValueRef.current === nextValue) {
      return;
    }

    syncedValueRef.current = nextValue;
    syncWebHeight();
  }, [syncWebHeight, value]);

  useEffect(() => {
    if (!value && height !== minHeight) {
      setHeight(minHeight);
    }
  }, [height, minHeight, value]);

  const handleChangeText = (text: string) => {
    syncedValueRef.current = text;
    onChangeText?.(text);

    if (Platform.OS === 'web') {
      requestAnimationFrame(syncWebHeight);
    }
  };

  const handleContentSizeChange: TextInputProps['onContentSizeChange'] = (event) => {
    const contentHeight = event.nativeEvent.contentSize.height + VERTICAL_PADDING;
    setHeight(resolveHeight(contentHeight));
    onContentSizeChange?.(event);
  };

  const canScroll = maxHeight != null && height >= maxHeight;
  const valueLength = typeof value === 'string' ? value.length : 0;
  const isAtCharacterLimit = maxLength != null && valueLength >= maxLength;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelHint ? <FieldLabelHint text={labelHint} /> : null}
      </View>
      <TextInput
        ref={inputRef}
        multiline
        value={value}
        onChangeText={handleChangeText}
        placeholderTextColor={colors.textMuted}
        scrollEnabled={canScroll}
        style={[
          styles.input,
          error ? styles.inputError : null,
          { height, minHeight },
          maxHeight != null ? { maxHeight } : null,
          Platform.OS === 'web'
            ? ({ overflow: canScroll ? 'auto' : 'hidden' } as object)
            : null,
          style,
        ]}
        onContentSizeChange={handleContentSizeChange}
        maxLength={maxLength}
        {...props}
      />
      {maxLength != null ? (
        <Text style={[styles.counter, isAtCharacterLimit ? styles.counterLimit : null]}>
          {valueLength} / {maxLength}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
