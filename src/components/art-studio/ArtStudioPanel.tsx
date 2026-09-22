import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ArtCanvasLoader } from '@/components/art-studio/ArtCanvasLoader';
import { copyTextToClipboard } from '@/components/gm-toolkit/copyText';
import { GmChatTargetPicker } from '@/components/gm-toolkit/GmChatTargetPicker';
import { Button, FadeInImage, TextArea, toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { sendChatMessage } from '@/services/chats/chatsApi';
import {
  ART_CAMERAS,
  ART_ENTITIES,
  ART_LIGHTING,
  ART_STYLES,
  ArtBuilderService,
  composeArtPrompt,
  consumeArtFromExternal,
  generateArtViaApi,
  getEntityPreset,
  inferCameraFromPrompt,
  loadArtHistory,
  looksLikeRussian,
  pushArtHistory,
  resolveCameraId,
  subscribeArtExternalQueue,
  subscribeArtHistory,
  type ArtBuildInput,
  type ArtBuildResult,
  type ArtCameraId,
  type ArtEntityId,
  type ArtHistoryEntry,
  type ArtLightingId,
  type ArtStyleId,
  type ArtTaskView,
} from '@/services/art-studio';
import { fetchMyRewards, type MyRewardsResponse } from '@/services/rewards/rewardsApi';
import { localizeErrorMessage } from '@/utils/localizeError';

type AccordionKey = 'style' | 'lighting' | 'camera' | 'prompt' | null;

const GENERATION_COOLDOWN_SEC = 15;

const ENTITY_ICONS: Record<ArtEntityId, keyof typeof Ionicons.glyphMap> = {
  portrait: 'person-outline',
  landscape: 'image-outline',
  interior: 'home-outline',
  item: 'diamond-outline',
  token: 'ellipse-outline',
};

function downloadArt(url: string, fileName: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName || 'art.jpg';
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }
  void Linking.openURL(url);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      gap: Spacing.md,
    },
    sectionLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    entityRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    entityChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.28)',
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
      minWidth: 118,
    },
    entityChipActive: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.18)',
    },
    entityChipText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    entityHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    promptWrap: {
      position: 'relative',
    },
    clearBtn: {
      position: 'absolute',
      right: 10,
      top: 36,
      zIndex: 2,
      padding: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    accordion: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.18)',
      backgroundColor: 'rgba(21, 122, 254, 0.04)',
      overflow: 'hidden',
    },
    accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      gap: Spacing.sm,
    },
    accordionTitle: {
      flex: 1,
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    accordionValue: {
      fontSize: FontSize.caption,
      color: colors.primary,
      fontWeight: '600',
      maxWidth: '42%',
      textAlign: 'right',
    },
    accordionBody: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      gap: 8,
    },
    optionChip: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.24)',
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    optionChipActive: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.2)',
    },
    optionChipText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    promptBox: {
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      padding: Spacing.sm,
      gap: Spacing.sm,
    },
    promptText: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.45,
    },
    ruHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    canvasCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.2)',
      backgroundColor: 'rgba(21, 122, 254, 0.05)',
      padding: Spacing.md,
      gap: Spacing.sm,
      alignItems: 'center',
    },
    frame: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.placeholderAlt,
    },
    emptyCanvas: {
      width: '100%',
      maxWidth: 420,
      minHeight: 180,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: 'rgba(21, 122, 254, 0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    emptyTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.label * 1.4,
    },
    meta: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      width: '100%',
    },
    actionBtn: {
      flexGrow: 1,
      minWidth: 140,
    },
    progressBlock: {
      gap: Spacing.sm,
      alignItems: 'center',
      width: '100%',
    },
    progressTrack: {
      width: '100%',
      maxWidth: 420,
      height: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.16)',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    statusText: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
    },
    historySection: {
      gap: Spacing.sm,
    },
    historyScroll: {
      gap: 8,
      paddingVertical: 2,
    },
    thumb: {
      width: 72,
      height: 72,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    thumbActive: {
      borderColor: colors.primary,
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
  });
}

export function ArtStudioPanel() {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  const [input, setInput] = useState<ArtBuildInput>({ ...ArtBuilderService.defaults });
  const [openAccordion, setOpenAccordion] = useState<AccordionKey>('style');
  const [result, setResult] = useState<ArtBuildResult | null>(null);
  const [history, setHistory] = useState<ArtHistoryEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [taskProgress, setTaskProgress] = useState(0);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [limits, setLimits] = useState<MyRewardsResponse['limits'] | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const startCooldown = useCallback(() => {
    clearCooldownTimer();
    setCooldownLeft(GENERATION_COOLDOWN_SEC);
    cooldownTimerRef.current = setInterval(() => {
      setCooldownLeft((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCooldownTimer]);

  useEffect(() => {
    return () => {
      clearCooldownTimer();
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      abortRef.current?.abort();
    };
  }, [clearCooldownTimer]);


  useEffect(() => {
    void loadArtHistory();
    void fetchMyRewards()
      .then((data) => setLimits(data.limits))
      .catch(() => undefined);
    return subscribeArtHistory(setHistory);
  }, []);

  useEffect(() => {
    return subscribeArtExternalQueue((payload) => {
      if (!payload) return;
      const consumed = consumeArtFromExternal();
      if (!consumed) return;
      setInput((prev) => ({
        ...prev,
        userPrompt: consumed.text,
        entityId: consumed.categoryId,
        cameraId:
          consumed.categoryId === 'landscape' || consumed.categoryId === 'interior'
            ? 'aerial'
            : consumed.categoryId === 'token' || consumed.categoryId === 'item'
              ? 'isometric'
              : inferCameraFromPrompt(consumed.text) ?? 'fullbody',
      }));
      toast.success('Промпт подставлен из генератора');
    });
  }, []);

  const entity = useMemo(() => getEntityPreset(input.entityId), [input.entityId]);
  const livePrompt = useMemo(() => composeArtPrompt(input), [input]);
  const resolvedCameraId = useMemo(() => resolveCameraId(input), [input]);
  const styleLabel = ART_STYLES.find((item) => item.id === input.styleId)?.label ?? '';
  const lightingLabel =
    ART_LIGHTING.find((item) => item.id === input.lightingId)?.label ?? '';
  const cameraLabel =
    ART_CAMERAS.find((item) => item.id === resolvedCameraId)?.label ?? '';

  const frameAspect = entity.size.width / entity.size.height;

  const toggleAccordion = useCallback((key: AccordionKey) => {
    setOpenAccordion((prev) => (prev === key ? null : key));
  }, []);

  const cancelGenerate = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const generate = useCallback(async () => {
    if (generating || cooldownLeft > 0) return;
    if (input.entityId === 'portrait' && limits && limits.remainingPortraitGenerations <= 0) {
      toast.error(`На сегодня портреты закончились (${limits.dailyPortraitGenerations})`);
      return;
    }
    if (!input.userPrompt.trim()) {
      toast.error('Сначала опиши персонажа или сцену');
      return;
    }
    const inferred = inferCameraFromPrompt(input.userPrompt);
    const requestInput =
      inferred && inferred !== input.cameraId
        ? { ...input, cameraId: inferred }
        : input;
    if (inferred && inferred !== input.cameraId) {
      setInput(requestInput);
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGenerating(true);
    setTaskProgress(2);
    setTaskMessage('Ставим в очередь…');
    setElapsedSec(0);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    try {
      const next = await generateArtViaApi(requestInput, {
        signal: controller.signal,
        onProgress: (view: ArtTaskView) => {
          setTaskProgress(view.progress || 0);
          setTaskMessage(view.message ?? null);
        },
      });
      setImageLoading(true);
      setResult(next);
      pushArtHistory(next);
      setTaskProgress(100);
      setTaskMessage(null);
      if (requestInput.entityId === 'portrait') {
        void fetchMyRewards()
          .then((data) => setLimits(data.limits))
          .catch(() => undefined);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.success('Генерация отменена');
      } else {
        toast.error(localizeErrorMessage(error, 'Не удалось сгенерировать арт'));
      }
      setImageLoading(false);
      setTaskMessage(null);
    } finally {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      setGenerating(false);
      setTaskProgress(0);
      startCooldown();
    }
  }, [cooldownLeft, generating, input, limits, startCooldown]);

  const handleCopyPrompt = useCallback(async () => {
    try {
      await copyTextToClipboard(livePrompt);
      toast.success('Промпт скопирован');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось скопировать'));
    }
  }, [livePrompt]);

  const handleCopyUrl = useCallback(async () => {
    if (!result) return;
    try {
      await copyTextToClipboard(result.url);
      toast.success('Ссылка скопирована');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось скопировать ссылку'));
    }
  }, [result]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadArt(result.url, `adventura-art-${result.seed}.jpg`);
  }, [result]);

  const handleSendToChat = useCallback(
    async (conversationId: string, title: string) => {
      if (!pendingUrl) return;
      setChatBusy(true);
      try {
        await sendChatMessage(conversationId, {
          body: '🎨 Арт из студии мастера',
          files: [
            {
              uri: pendingUrl,
              name: `art-${Date.now()}.jpg`,
              mimeType: 'image/jpeg',
            },
          ],
        });
        toast.success(`Отправлено в «${title}»`);
        setPickerOpen(false);
        setPendingUrl(null);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось отправить в чат'));
      } finally {
        setChatBusy(false);
      }
    },
    [pendingUrl],
  );

  const openChatFor = useCallback((url: string) => {
    setPendingUrl(url);
    setPickerOpen(true);
  }, []);

  const restoreFromHistory = useCallback((entry: ArtHistoryEntry) => {
    setImageLoading(true);
    setResult(entry.result);
    setInput({
      userPrompt: entry.result.userPrompt,
      entityId: entry.result.entityId,
      styleId: entry.result.styleId,
      lightingId: entry.result.lightingId,
      cameraId: entry.result.cameraId,
    });
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.sectionLabel}>Тип арта</Text>
      <View style={styles.entityRow}>
        {ART_ENTITIES.map((item) => {
          const active = item.id === input.entityId;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setInput((prev) => ({ ...prev, entityId: item.id }))}
              style={({ pressed }) => [
                styles.entityChip,
                active && styles.entityChipActive,
                pressed && { opacity: 0.88 },
              ]}>
              <Ionicons
                name={ENTITY_ICONS[item.id]}
                size={16}
                color={colors.primary}
              />
              <View>
                <Text style={styles.entityChipText}>{item.label}</Text>
                {item.hint ? <Text style={styles.entityHint}>{item.hint}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.promptWrap}>
        <TextArea
          label="Детали сцены"
          value={input.userPrompt}
          onChangeText={(userPrompt) => setInput((prev) => ({ ...prev, userPrompt }))}
          placeholder={entity.placeholder}
          minHeight={110}
          maxHeight={220}
        />
        {input.userPrompt ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Очистить"
            onPress={() => setInput((prev) => ({ ...prev, userPrompt: '' }))}
            style={styles.clearBtn}>
            <Ionicons name="close" size={16} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {looksLikeRussian(input.userPrompt) ? (
        <Text style={styles.ruHint}>
          Русский ок — Kandinsky понимает без перевода. Смотри собранный промпт ниже.
        </Text>
      ) : null}

      <View style={styles.accordion}>
        <Pressable
          accessibilityRole="button"
          onPress={() => toggleAccordion('style')}
          style={styles.accordionHeader}>
          <Text style={styles.accordionTitle}>Стиль рисовки</Text>
          <Text style={styles.accordionValue} numberOfLines={1}>
            {styleLabel}
          </Text>
          <Ionicons
            name={openAccordion === 'style' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
        {openAccordion === 'style' ? (
          <View style={styles.accordionBody}>
            <View style={styles.optionRow}>
              {ART_STYLES.map((item) => {
                const active = item.id === input.styleId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      setInput((prev) => ({ ...prev, styleId: item.id as ArtStyleId }))
                    }
                    style={[styles.optionChip, active && styles.optionChipActive]}>
                    <Text style={styles.optionChipText}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.accordion}>
        <Pressable
          accessibilityRole="button"
          onPress={() => toggleAccordion('lighting')}
          style={styles.accordionHeader}>
          <Text style={styles.accordionTitle}>Освещение</Text>
          <Text style={styles.accordionValue} numberOfLines={1}>
            {lightingLabel}
          </Text>
          <Ionicons
            name={openAccordion === 'lighting' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
        {openAccordion === 'lighting' ? (
          <View style={styles.accordionBody}>
            <View style={styles.optionRow}>
              {ART_LIGHTING.map((item) => {
                const active = item.id === input.lightingId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      setInput((prev) => ({
                        ...prev,
                        lightingId: item.id as ArtLightingId,
                      }))
                    }
                    style={[styles.optionChip, active && styles.optionChipActive]}>
                    <Text style={styles.optionChipText}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.accordion}>
        <Pressable
          accessibilityRole="button"
          onPress={() => toggleAccordion('camera')}
          style={styles.accordionHeader}>
          <Text style={styles.accordionTitle}>Ракурс камеры</Text>
          <Text style={styles.accordionValue} numberOfLines={1}>
            {cameraLabel}
          </Text>
          <Ionicons
            name={openAccordion === 'camera' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
        {openAccordion === 'camera' ? (
          <View style={styles.accordionBody}>
            <View style={styles.optionRow}>
              {ART_CAMERAS.map((item) => {
                const active = item.id === resolvedCameraId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      setInput((prev) => ({
                        ...prev,
                        cameraId: item.id as ArtCameraId,
                      }))
                    }
                    style={[styles.optionChip, active && styles.optionChipActive]}>
                    <Text style={styles.optionChipText}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.accordion}>
        <Pressable
          accessibilityRole="button"
          onPress={() => toggleAccordion('prompt')}
          style={styles.accordionHeader}>
          <Text style={styles.accordionTitle}>Собранный промпт</Text>
          <Ionicons
            name={openAccordion === 'prompt' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
        {openAccordion === 'prompt' ? (
          <View style={styles.accordionBody}>
            <View style={styles.promptBox}>
              <Text style={styles.promptText} selectable>
                {livePrompt}
              </Text>
              <Button
                label="Скопировать промпт"
                variant="outline"
                icon={<Ionicons name="copy-outline" size={16} color={colors.text} />}
                onPress={() => void handleCopyPrompt()}
              />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {input.entityId === 'portrait' && limits ? (
          <Text style={{ fontSize: FontSize.caption, color: colors.primary, fontWeight: '600' }}>
            Портреты сегодня: {limits.usedPortraitGenerationsToday} / {limits.dailyPortraitGenerations}
          </Text>
        ) : null}
        <Button
          label={
            generating
              ? 'Генерация…'
              : cooldownLeft > 0
                ? `Подожди ${cooldownLeft} с`
                : input.entityId === 'portrait' && limits && limits.remainingPortraitGenerations <= 0
                  ? 'Лимит портретов'
                  : 'Сгенерировать'
          }
          icon={<Ionicons name="color-wand-outline" size={18} color={colors.onPrimary} />}
          disabled={
            generating ||
            cooldownLeft > 0 ||
            Boolean(input.entityId === 'portrait' && limits && limits.remainingPortraitGenerations <= 0)
          }
          onPress={() => void generate()}
          style={styles.actionBtn}
        />
        {generating ? (
          <Button
            label="Отменить"
            variant="outline"
            icon={<Ionicons name="close-circle-outline" size={18} color={colors.text} />}
            onPress={cancelGenerate}
            style={styles.actionBtn}
          />
        ) : (
          <Button
            label={cooldownLeft > 0 ? `Реролл ${cooldownLeft} с` : 'Реролл'}
            variant="outline"
            icon={<Ionicons name="shuffle-outline" size={18} color={colors.text} />}
            disabled={!result || cooldownLeft > 0}
            onPress={() => void generate()}
            style={styles.actionBtn}
          />
        )}
      </View>

      {generating ? (
        <View style={styles.progressBlock}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(4, taskProgress)}%` }]} />
          </View>
          <Text style={styles.statusText}>
            {taskMessage ?? 'Рисуем арт…'} · {elapsedSec} с
          </Text>
        </View>
      ) : null}

      <View style={styles.canvasCard}>
        {generating && !result ? (
          <View style={[styles.frame, { aspectRatio: frameAspect }]}>
            <ArtCanvasLoader
              style={StyleSheet.absoluteFillObject}
              label={taskMessage ?? 'Рисуем арт…'}
              hint="Обычно 15–40 секунд. Можно отменить."
            />
          </View>
        ) : result ? (
          <>
            <View style={[styles.frame, { aspectRatio: result.width / result.height }]}>
              <FadeInImage
                uri={result.url}
                recyclingKey={`${result.seed}-${result.url}`}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                onLoad={() => setImageLoading(false)}
                onError={() => setImageLoading(false)}
              />
              {generating || imageLoading ? (
                <ArtCanvasLoader
                  overlay
                  label={
                    generating
                      ? (taskMessage ?? 'Рисуем новый арт…')
                      : 'Проявляем картинку…'
                  }
                  hint={
                    generating
                      ? `${elapsedSec} с · можно отменить`
                      : undefined
                  }
                />
              ) : null}
            </View>
            <Text style={styles.meta}>
              {result.width}×{result.height}
            </Text>
            <View style={styles.actions}>
              <Button
                label="Ссылка"
                variant="outline"
                icon={<Ionicons name="link-outline" size={16} color={colors.text} />}
                onPress={() => void handleCopyUrl()}
                style={styles.actionBtn}
              />
              <Button
                label="В чат"
                variant="outline"
                icon={
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.text} />
                }
                onPress={() => openChatFor(result.url)}
                style={styles.actionBtn}
              />
              <Button
                label="Скачать"
                variant="outline"
                icon={<Ionicons name="download-outline" size={16} color={colors.text} />}
                onPress={handleDownload}
                style={styles.actionBtn}
              />
            </View>
          </>
        ) : (
          <View style={[styles.emptyCanvas, { aspectRatio: frameAspect }]}>
            <Ionicons name="brush-outline" size={32} color={colors.primary} />
            <Text style={styles.emptyTitle}>Холст пуст</Text>
            <Text style={styles.emptyText}>
              Опиши персонажа или сцену и жми «Сгенерировать».
            </Text>
          </View>
        )}
      </View>

      {history.length > 0 ? (
        <View style={styles.historySection}>
          <Text style={styles.sectionLabel}>История сессии</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.historyScroll}>
            {history.map((entry) => {
              const active = result?.url === entry.result.url;
              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityLabel="Вернуть арт"
                  onPress={() => restoreFromHistory(entry)}
                  onLongPress={() => openChatFor(entry.result.url)}
                  style={[styles.thumb, active && styles.thumbActive]}>
                  <FadeInImage
                    uri={entry.result.url}
                    style={styles.thumbImage}
                    contentFit="cover"
                    recyclingKey={entry.id}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.ruHint}>Тап — в холст. Долгий тап — отправить в чат.</Text>
        </View>
      ) : null}

      <GmChatTargetPicker
        visible={pickerOpen}
        busy={chatBusy}
        onClose={() => {
          if (!chatBusy) {
            setPickerOpen(false);
            setPendingUrl(null);
          }
        }}
        onPick={(conversationId, title) => void handleSendToChat(conversationId, title)}
      />
    </View>
  );
}
