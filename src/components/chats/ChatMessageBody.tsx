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

export function ChatMessageBody({ text, textStyle, linkStyle }: ChatMessageBodyProps) {
  const parts = useMemo(() => {
    const chunks: Array<{ type: 'text' | 'link'; value: string }> = [];
    let lastIndex = 0;
    const matches = text.matchAll(URL_PATTERN);

    for (const match of matches) {
      const value = match[0];
      const index = match.index ?? 0;
      if (index > lastIndex) {
        chunks.push({ type: 'text', value: text.slice(lastIndex, index) });
      }
      chunks.push({ type: 'link', value });
      lastIndex = index + value.length;
    }

    if (lastIndex < text.length) {
      chunks.push({ type: 'text', value: text.slice(lastIndex) });
    }

    if (chunks.length === 0) {
      chunks.push({ type: 'text', value: text });
    }

    return chunks;
  }, [text]);

  return (
    <Text style={textStyle} selectable={false}>
      {parts.map((part, index) =>
        part.type === 'link' ? (
          <Text
            key={`${part.type}-${index}`}
            selectable={false}
            style={[textStyle, styles.linkBase, linkStyle]}
            onPress={() => openExternalLink(part.value)}>
            {part.value}
          </Text>
        ) : (
          <Text key={`${part.type}-${index}`} selectable={false} style={textStyle}>
            {part.value}
          </Text>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  linkBase: {
    textDecorationLine: 'underline',
  },
});
