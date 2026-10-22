import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RenderHTML, { defaultSystemFonts } from 'react-native-render-html';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FadeInImage } from '@/components/ui';
import { FontSize, Spacing } from '@/constants/theme';
import { useTheme, useThemePreference } from '@/hooks/use-theme';
import type { SiteAnnouncement } from '@/services/announcements/announcementsApi';
import { formatDateRu } from '@/utils/date-format';

function formatAnnouncementDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = formatDateRu(date);
  const time = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day}, ${time}`;
}

type SiteAnnouncementModalProps = {
  announcement: SiteAnnouncement | null;
  visible: boolean;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
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

function aspectStyle(aspect: SiteAnnouncement['theme']['imageAspect']) {
  switch (aspect) {
    case '4:3':
      return { aspectRatio: 4 / 3 };
    case '1:1':
      return { aspectRatio: 1 };
    case 'auto':
      return { minHeight: 140, maxHeight: 280 };
    case '16:9':
    default:
      return { aspectRatio: 16 / 9 };
  }
}

export function SiteAnnouncementModal({
  announcement,
  visible,
  index,
  total,
  onPrev,
  onNext,
  onClose,
}: SiteAnnouncementModalProps) {
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const colors = useTheme();
  const { colorScheme } = useThemePreference();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const theme = announcement?.theme;
  // CMS palette is light|dark. If it doesn't match the app theme, use ThemeContext
  // so a default white sheet doesn't stay white in dark mode.
  const followAppTheme = Boolean(theme && theme.themeMode !== colorScheme);
  const sheetBg = followAppTheme
    ? colors.surface
    : (theme?.backgroundColor ?? colors.surface);
  const titleColor = followAppTheme
    ? colors.text
    : (theme?.titleColor ?? colors.text);
  const bodyColor = followAppTheme
    ? colors.textSecondary
    : (theme?.bodyColor ?? colors.textSecondary);
  const accent = theme?.accentColor || colors.primary;
  const buttonColor = theme?.buttonColor || accent;
  const imagePlaceholder = colors.surfaceMuted;

  const sideLayout =
    Boolean(theme?.imageLayout === 'side') &&
    isDesktopWeb &&
    Boolean(announcement?.imageUrl) &&
    theme?.showImage !== false;

  const titleHtml = useMemo(() => {
    const raw = announcement?.title?.trim() ?? '';
    if (!raw) return '';
    return looksLikeHtml(raw) ? raw : '';
  }, [announcement?.title]);

  const html = useMemo(() => {
    const raw = announcement?.body?.trim() ?? '';
    if (!raw) return '';
    return looksLikeHtml(raw) ? raw : plainToHtml(raw);
  }, [announcement?.body]);

  const maxModalWidth = Math.min(
    theme?.modalWidth ?? 480,
    Math.max(300, windowWidth - 32),
  );

  const contentWidth = Math.max(240, maxModalWidth - Spacing.lg * 2);

  const tagsStyles = useMemo(
    () => ({
      body: {
        color: bodyColor,
        fontSize: FontSize.label,
        lineHeight: FontSize.label * 1.55,
        margin: 0,
      },
      p: { marginTop: 0, marginBottom: Spacing.sm },
      strong: {
        fontWeight: '700' as const,
        color: titleColor,
      },
      b: {
        fontWeight: '700' as const,
        color: titleColor,
      },
      em: { fontStyle: 'italic' as const },
      i: { fontStyle: 'italic' as const },
      a: {
        color: accent,
        textDecorationLine: 'underline' as const,
      },
      ul: { marginBottom: Spacing.sm, paddingLeft: Spacing.md },
      ol: { marginBottom: Spacing.sm, paddingLeft: Spacing.md },
      li: { marginBottom: 4 },
    }),
    [accent, bodyColor, titleColor],
  );

  const titleTagsStyles = useMemo(
    () => ({
      body: {
        color: titleColor,
        fontSize: FontSize.h1,
        fontWeight: '700' as const,
        lineHeight: FontSize.h1 * 1.25,
        margin: 0,
      },
      p: { marginTop: 0, marginBottom: 0 },
      strong: { fontWeight: '800' as const },
      b: { fontWeight: '800' as const },
      em: { fontStyle: 'italic' as const },
      i: { fontStyle: 'italic' as const },
    }),
    [titleColor],
  );

  if (!announcement || !theme) {
    return null;
  }

  const showImage = theme.showImage !== false && Boolean(announcement.imageUrl);
  const showAction =
    theme.showActionButton !== false &&
    Boolean(announcement.actionLabel) &&
    Boolean(announcement.actionUrl);
  const showPager = total > 1;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  const focusX = theme.imageFocusX ?? 50;
  const focusY = theme.imageFocusY ?? 50;
  const sheetMaxHeight = windowHeight - insets.top - insets.bottom - 24;
  // Cap cover so text stays reachable; cover scrolls away with content (top layout).
  const imageMaxHeight = Math.round(
    Math.min(sheetMaxHeight * (isDesktopWeb ? 0.48 : 0.42), isDesktopWeb ? 320 : 240),
  );

  const animationType = theme.animationEnabled === false ? 'none' : 'fade';

  const onAction = () => {
    const url = announcement.actionUrl;
    if (!url) return;
    void Linking.openURL(url).catch(() => undefined);
  };

  const pagerLabel = `Новость ${index + 1} из ${total}`;
  const dateLabel = formatAnnouncementDate(announcement.publishedAt);
  const pagerOnImage = showImage && !sideLayout;

  const renderPager = (onImage: boolean) => {
    if (!showPager) return null;
    return (
      <View
        style={[
          styles.pager,
          {
            backgroundColor: onImage ? 'rgba(0,0,0,0.45)' : `${accent}18`,
          },
          onImage ? styles.pagerOnImage : null,
        ]}
      >
        <Pressable
          onPress={onPrev}
          disabled={!canPrev}
          hitSlop={10}
          style={({ pressed }) => [
            styles.pagerArrow,
            !canPrev ? styles.pagerArrowDisabled : null,
            pressed && canPrev ? styles.pressed : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Предыдущая новость"
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={onImage ? '#FFFFFF' : accent}
          />
        </Pressable>

        <Text
          style={[
            styles.pagerLabel,
            { color: onImage ? '#FFFFFF' : titleColor },
          ]}
          accessibilityLiveRegion="polite"
        >
          {pagerLabel}
        </Text>

        <Pressable
          onPress={onNext}
          disabled={!canNext}
          hitSlop={10}
          style={({ pressed }) => [
            styles.pagerArrow,
            !canNext ? styles.pagerArrowDisabled : null,
            pressed && canNext ? styles.pressed : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Следующая новость"
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={onImage ? '#FFFFFF' : accent}
          />
        </Pressable>
      </View>
    );
  };

  const coverImage =
    showImage && announcement.imageUrl ? (
      <View
        style={[
          sideLayout ? styles.imageSide : styles.imageTop,
          { backgroundColor: imagePlaceholder },
          !sideLayout ? aspectStyle(theme.imageAspect) : null,
          { maxHeight: imageMaxHeight },
        ]}
      >
        <FadeInImage
          uri={announcement.imageUrl}
          recyclingKey={announcement.id}
          transitionMs={0}
          style={styles.image}
          imageStyle={
            Platform.OS === 'web'
              ? ({
                  objectFit: 'cover',
                  objectPosition: `${focusX}% ${focusY}%`,
                } as ImageStyle)
              : undefined
          }
          contentFit="cover"
          contentPosition={{
            left: `${focusX}%`,
            top: `${focusY}%`,
          }}
        />
        {pagerOnImage ? renderPager(true) : null}
      </View>
    ) : null;

  const textBlock = (
    <>
      {!pagerOnImage ? renderPager(false) : null}

      {dateLabel || announcement.views != null || announcement.likes != null ? (
        <View style={styles.metaRow}>
          {dateLabel ? (
            <Text
              style={[styles.dateLabel, { color: bodyColor }]}
              accessibilityLabel={`Дата публикации ${dateLabel}`}
            >
              {dateLabel}
            </Text>
          ) : null}
          <View style={styles.statsRow}>
            <View
              style={styles.stat}
              accessibilityLabel={`Просмотры: ${announcement.views ?? 0}`}
            >
              <Ionicons name="eye-outline" size={14} color={bodyColor} />
              <Text style={[styles.statText, { color: bodyColor }]}>
                {announcement.views ?? 0}
              </Text>
            </View>
            <View
              style={styles.stat}
              accessibilityLabel={`Лайки: ${announcement.likes ?? 0}`}
            >
              <Ionicons name="heart-outline" size={14} color={bodyColor} />
              <Text style={[styles.statText, { color: bodyColor }]}>
                {announcement.likes ?? 0}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.titleWrap}>
        {titleHtml ? (
          <RenderHTML
            contentWidth={contentWidth}
            source={{ html: titleHtml }}
            systemFonts={[...defaultSystemFonts]}
            tagsStyles={titleTagsStyles}
            defaultTextProps={{ selectable: true }}
          />
        ) : (
          <Text style={[styles.title, { color: titleColor }]}>
            {announcement.title}
          </Text>
        )}
      </View>

      {html ? (
        <RenderHTML
          contentWidth={contentWidth}
          source={{ html }}
          systemFonts={[...defaultSystemFonts]}
          tagsStyles={tagsStyles}
          defaultTextProps={{ selectable: true }}
        />
      ) : null}

      {showAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.actionButton,
            theme.buttonStyle === 'outline'
              ? {
                  backgroundColor: 'transparent',
                  borderWidth: 2,
                  borderColor: buttonColor,
                }
              : { backgroundColor: buttonColor },
            pressed ? styles.pressed : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={announcement.actionLabel ?? 'Действие'}
        >
          <Text
            style={[
              styles.actionLabel,
              {
                color:
                  theme.buttonStyle === 'outline' ? buttonColor : '#FFFFFF',
              },
            ]}
          >
            {announcement.actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View
        style={[
          styles.backdrop,
          styles.backdropCentered,
          {
            paddingTop: Math.max(insets.top, Spacing.md),
            paddingBottom: Math.max(insets.bottom, Spacing.md),
            paddingHorizontal: Spacing.md,
          },
          Platform.OS === 'web' ? styles.backdropWeb : null,
        ]}
        accessibilityViewIsModal
      >
        <View
          key={announcement.id}
          style={[
            styles.sheet,
            {
              backgroundColor: sheetBg,
              borderRadius: theme.borderRadius,
              maxWidth: maxModalWidth,
              width: '100%',
              maxHeight: sheetMaxHeight,
              borderColor: accent,
            },
            sideLayout ? styles.sheetRow : null,
          ]}
          accessibilityRole="alert"
          accessibilityLabel={announcement.title}
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>

          {sideLayout ? coverImage : null}

          <ScrollView
            style={[
              styles.scroll,
              Platform.OS === 'web'
                ? ({
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(120, 120, 128, 0.45) transparent',
                  } as object)
                : null,
            ]}
            {...(Platform.OS === 'web'
              ? ({ className: 'announcement-modal-scroll' } as object)
              : {})}
            contentContainerStyle={[
              styles.scrollContent,
              !sideLayout && showImage ? styles.scrollContentWithCover : null,
            ]}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {!sideLayout ? coverImage : null}
            <View
              style={[
                styles.scrollBody,
                !sideLayout && showImage ? styles.scrollBodyAfterCover : null,
              ]}
            >
              {textBlock}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  backdropWeb: {
    // @ts-expect-error web-only fixed overlay — hides feed cards peeking beside the sheet
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
  },
  backdropCentered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    zIndex: 1,
    isolation: 'isolate',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingRight: 52,
    zIndex: 2,
  },
  pagerOnImage: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 52,
    borderRadius: 999,
    zIndex: 3,
  },
  pagerArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerArrowDisabled: {
    opacity: 0.35,
  },
  pagerLabel: {
    flexShrink: 1,
    fontSize: FontSize.label,
    fontWeight: '600',
    textAlign: 'center',
  },
  imageTop: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  imageSide: {
    width: '42%',
    minHeight: 200,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  scroll: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.lg,
  },
  scrollContentWithCover: {
    paddingTop: 0,
  },
  scrollBody: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    // Close button: right 10 + 40 wide — keep content clear of that corner.
    paddingRight: Spacing.lg + 44,
    gap: Spacing.md,
  },
  scrollBodyAfterCover: {
    paddingTop: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  dateLabel: {
    fontSize: FontSize.caption,
    fontWeight: '500',
    opacity: 0.85,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    opacity: 0.85,
  },
  statText: {
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  titleWrap: {
    width: '100%',
  },
  title: {
    fontSize: FontSize.h1,
    fontWeight: '700',
    lineHeight: FontSize.h1 * 1.25,
  },
  actionButton: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  actionLabel: {
    fontSize: FontSize.button,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
