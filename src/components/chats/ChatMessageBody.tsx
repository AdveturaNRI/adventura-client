import { useMemo } from 'react';
import { Linking, Platform, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

const URL_PATTERN =
  /((?:https?:\/\/|www\.)[^\s<>"'`)\]]+)/gi;

type ChatMessageBodyProps = {
  text: string;
  textStyle: StyleProp<TextStyle>;
  linkStyle: StyleProp<TextStyle>;
};

function normalizeUrl(raw: string) {
  const trimmed = raw.replace(/[.,;:!?)]+$/g, '');
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function openExternalLink(raw: string) {
  const url = normalizeUrl(raw);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(url);
}

/** Soft wrap points so one long token can't blow past the bubble on native/web. */
function allowBreaksInLongTokens(value: string, every = 18) {
  return value.replace(/\S{19,}/g, (token) =>
    token.replace(new RegExp(`.{1,${every}}`, 'g'), (chunk) => `${chunk}\u200B`),
  );
}

export function ChatMessageBody({ text, textStyle, linkStyle }: ChatMessageBodyProps) {
  const parts = useMemo(() => {
    const chunks: Array<{ type: 'text' | 'link'; value: string; display: string }> = [];
    let lastIndex = 0;
    const matches = text.matchAll(URL_PATTERN);

    for (const match of matches) {
      const value = match[0];
      const index = match.index ?? 0;
      if (index > lastIndex) {
        const slice = text.slice(lastIndex, index);
        chunks.push({ type: 'text', value: slice, display: allowBreaksInLongTokens(slice) });
      }
      chunks.push({ type: 'link', value, display: allowBreaksInLongTokens(value) });
      lastIndex = index + value.length;
    }

    if (lastIndex < text.length) {
      const slice = text.slice(lastIndex);
      chunks.push({ type: 'text', value: slice, display: allowBreaksInLongTokens(slice) });
    }

    if (chunks.length === 0) {
      chunks.push({ type: 'text', value: text, display: allowBreaksInLongTokens(text) });
    }

    return chunks;
  }, [text]);

  return (
    <Text style={[styles.body, textStyle]} selectable={false}>
      {parts.map((part, index) =>
        part.type === 'link' ? (
          <Text
            key={`${part.type}-${index}`}
            selectable={false}
            style={[styles.body, textStyle, styles.linkBase, linkStyle]}
            onPress={() => openExternalLink(part.value)}>
            {part.display}
          </Text>
        ) : (
          <Text key={`${part.type}-${index}`} selectable={false} style={[styles.body, textStyle]}>
            {part.display}
          </Text>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: {
    flexShrink: 1,
    maxWidth: '100%',
    ...Platform.select({
      web: {
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
      } as object,
      default: {},
    }),
  },
  linkBase: {
    textDecorationLine: 'underline',
  },
});
