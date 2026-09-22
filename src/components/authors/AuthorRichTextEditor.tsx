import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FieldLabelHint } from '@/components/ui/inputs/FieldLabelHint';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type AuthorRichTextEditorProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  labelHint?: string;
  placeholder?: string;
  minHeight?: number;
};

function createStyles(colors: ThemeColors, minHeight: number) {
  return StyleSheet.create({
    wrapper: {
      gap: Spacing.sm,
      width: '100%',
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingLeft: Spacing.xs,
      flexWrap: 'wrap',
    },
    label: {
      fontSize: FontSize.label,
      color: colors.textMuted,
    },
    editor: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    toolbar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: 'rgba(21, 122, 254, 0.06)',
    },
    tool: {
      minWidth: 36,
      minHeight: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.2)',
      backgroundColor: colors.surface,
    },
    toolActive: {
      borderColor: 'rgba(21, 122, 254, 0.45)',
      backgroundColor: 'rgba(21, 122, 254, 0.16)',
    },
    toolPressed: {
      opacity: 0.85,
    },
    toolGlyph: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.primary,
    },
    nativeInput: {
      minHeight,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: FontSize.input,
      color: colors.textSecondary,
      textAlignVertical: 'top',
    },
    hint: {
      fontSize: 11,
      color: colors.textMuted,
      paddingHorizontal: Spacing.xs,
      lineHeight: 15,
    },
  });
}

function isHtmlContent(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function toEditorHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (isHtmlContent(trimmed)) {
    return trimmed;
  }
  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function normalizeEditorHtml(html: string) {
  return html === '<p></p>' ? '' : html;
}

type ToolProps = {
  label: string;
  active?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  children: ReactNode;
};

function Tool({ label, active, onPress, styles, children }: ToolProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tool,
        active && styles.toolActive,
        pressed && styles.toolPressed,
      ]}>
      {children}
    </Pressable>
  );
}

function WebTipTapEditor({
  label,
  value,
  onChangeText,
  labelHint,
  placeholder,
  minHeight,
}: Required<
  Pick<AuthorRichTextEditorProps, 'label' | 'value' | 'onChangeText' | 'placeholder' | 'minHeight'>
> &
  Pick<AuthorRichTextEditorProps, 'labelHint'>) {
  const colors = useTheme();
  const styles = useThemedStyles((theme) => createStyles(theme, minHeight));
  const lastEmittedRef = useRef(normalizeEditorHtml(toEditorHtml(value)));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: toEditorHtml(value),
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      const html = normalizeEditorHtml(current.getHTML());
      lastEmittedRef.current = html;
      onChangeText(html);
    },
    editorProps: {
      attributes: {
        class: 'adventura-author-editor',
        style: [
          `min-height:${Math.max(120, minHeight - 52)}px`,
          'padding:12px 14px',
          `font-size:${FontSize.input}px`,
          'line-height:1.55',
          `color:${colors.textSecondary}`,
          'outline:none',
        ].join(';'),
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const incoming = normalizeEditorHtml(toEditorHtml(value));
    if (incoming === lastEmittedRef.current) {
      return;
    }
    lastEmittedRef.current = incoming;
    editor.commands.setContent(incoming || '', { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelHint ? <FieldLabelHint text={labelHint} /> : null}
      </View>

      <View style={styles.editor}>
        <View style={styles.toolbar}>
          <Tool
            label="Жирный"
            styles={styles}
            active={editor.isActive('bold')}
            onPress={() => editor.chain().focus().toggleBold().run()}>
            <Text style={styles.toolGlyph}>B</Text>
          </Tool>
          <Tool
            label="Курсив"
            styles={styles}
            active={editor.isActive('italic')}
            onPress={() => editor.chain().focus().toggleItalic().run()}>
            <Text style={[styles.toolGlyph, { fontStyle: 'italic', fontWeight: '700' }]}>I</Text>
          </Tool>
          <Tool
            label="Подчёркнутый"
            styles={styles}
            active={editor.isActive('underline')}
            onPress={() => editor.chain().focus().toggleUnderline().run()}>
            <Text style={[styles.toolGlyph, { textDecorationLine: 'underline' }]}>U</Text>
          </Tool>
          <Tool
            label="Зачёркнутый"
            styles={styles}
            active={editor.isActive('strike')}
            onPress={() => editor.chain().focus().toggleStrike().run()}>
            <Text style={[styles.toolGlyph, { textDecorationLine: 'line-through' }]}>S</Text>
          </Tool>
          <Tool
            label="Заголовок"
            styles={styles}
            active={editor.isActive('heading', { level: 2 })}
            onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Ionicons name="reorder-two-outline" size={16} color={colors.primary} />
          </Tool>
          <Tool
            label="Список"
            styles={styles}
            active={editor.isActive('bulletList')}
            onPress={() => editor.chain().focus().toggleBulletList().run()}>
            <Ionicons name="list-outline" size={16} color={colors.primary} />
          </Tool>
          <Tool
            label="Нумерованный список"
            styles={styles}
            active={editor.isActive('orderedList')}
            onPress={() => editor.chain().focus().toggleOrderedList().run()}>
            <Ionicons name="list" size={16} color={colors.primary} />
          </Tool>
          <Tool
            label="Цитата"
            styles={styles}
            active={editor.isActive('blockquote')}
            onPress={() => editor.chain().focus().toggleBlockquote().run()}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
          </Tool>
          <Tool
            label="Ссылка"
            styles={styles}
            active={editor.isActive('link')}
            onPress={() => {
              const previous = editor.getAttributes('link').href as string | undefined;
              const next = window.prompt('Ссылка', previous || 'https://');
              if (next === null) {
                return;
              }
              if (!next.trim()) {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                return;
              }
              editor.chain().focus().extendMarkRange('link').setLink({ href: next.trim() }).run();
            }}>
            <Ionicons name="link-outline" size={16} color={colors.primary} />
          </Tool>
        </View>
        <EditorContent editor={editor} />
      </View>

      <Text style={styles.hint}>Выделите текст и нажмите B / I / U — форматирование как в документе.</Text>
    </View>
  );
}

export function AuthorRichTextEditor({
  label,
  value,
  onChangeText,
  labelHint,
  placeholder = 'Напишите текст публикации…',
  minHeight = 180,
}: AuthorRichTextEditorProps) {
  const colors = useTheme();
  const styles = useThemedStyles((theme) => createStyles(theme, minHeight));

  if (Platform.OS === 'web') {
    return (
      <WebTipTapEditor
        label={label}
        value={value}
        onChangeText={onChangeText}
        labelHint={labelHint}
        placeholder={placeholder}
        minHeight={minHeight}
      />
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelHint ? <FieldLabelHint text={labelHint} /> : null}
      </View>
      <View style={styles.editor}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={styles.nativeInput}
        />
      </View>
      <Text style={styles.hint}>На телефоне текст пока без панели форматирования.</Text>
    </View>
  );
}
