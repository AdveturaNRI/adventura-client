import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import RenderHTML, { defaultSystemFonts } from 'react-native-render-html';

import { FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AuthorRichTextProps = {
  value: string;
};

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function plainToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function AuthorRichText({ value }: AuthorRichTextProps) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const html = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    return looksLikeHtml(trimmed) ? trimmed : plainToHtml(trimmed);
  }, [value]);

  const tagsStyles = useMemo(
    () => ({
      body: {
        color: colors.textSecondary,
        fontSize: FontSize.label,
        lineHeight: FontSize.label * 1.55,
        margin: 0,
      },
      p: {
        marginTop: 0,
        marginBottom: Spacing.sm,
      },
      h2: {
        color: colors.text,
        fontSize: FontSize.h1,
        fontWeight: '700' as const,
        marginTop: Spacing.sm,
        marginBottom: Spacing.sm,
      },
      h3: {
        color: colors.text,
        fontSize: FontSize.button,
        fontWeight: '700' as const,
        marginTop: Spacing.sm,
        marginBottom: Spacing.xs,
      },
      strong: {
        color: colors.text,
        fontWeight: '700' as const,
      },
      em: {
        fontStyle: 'italic' as const,
      },
      u: {
        textDecorationLine: 'underline' as const,
      },
      s: {
        textDecorationLine: 'line-through' as const,
        color: colors.textMuted,
      },
      a: {
        color: colors.primary,
        textDecorationLine: 'underline' as const,
        fontWeight: '600' as const,
      },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        paddingLeft: Spacing.md,
        marginVertical: Spacing.sm,
        color: colors.textMuted,
        fontStyle: 'italic' as const,
      },
      ul: {
        marginBottom: Spacing.sm,
        paddingLeft: Spacing.md,
      },
      ol: {
        marginBottom: Spacing.sm,
        paddingLeft: Spacing.md,
      },
      li: {
        marginBottom: 4,
      },
    }),
    [colors],
  );

  if (!html) {
    return null;
  }

  return (
    <View style={{ width: '100%' }}>
      <RenderHTML
        contentWidth={Math.max(280, width - Spacing.lg * 4)}
        source={{ html }}
        systemFonts={[...defaultSystemFonts]}
        tagsStyles={tagsStyles}
        defaultTextProps={{ selectable: true }}
      />
    </View>
  );
}
