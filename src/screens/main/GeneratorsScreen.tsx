import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ArtStudioPanel } from '@/components/art-studio';
import { AuthorsBar } from '@/components/authors/AuthorsBar';
import { PartnersTicker } from '@/components/partners/PartnersTicker';
import { copyTextToClipboard } from '@/components/gm-toolkit/copyText';
import { GmChatTargetPicker } from '@/components/gm-toolkit/GmChatTargetPicker';
import { GmResultCard } from '@/components/gm-toolkit/GmResultCard';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import {
  ScrollToTopButton,
  shouldShowScrollToTop,
} from '@/components/navigation/ScrollToTopButton';
import {
  Button,
  SelectField,
  Switcher,
  toast,
  type SelectOption,
  type SwitcherOption,
} from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useAuthors } from '@/context/AuthorsContext';
import { useTheme, useThemePreference } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useMainScreenStyles } from '@/screens/main/main-screen.styles';
import { sendChatMessage } from '@/services/chats/chatsApi';
import {
  categoryLabel,
  formatCardChatMessage,
  formatCardPlaintext,
  generateDungeon,
  generateKingdom,
  generateNPC,
  generateSettlement,
  generateTavern,
  listRaces,
  listSettlementSizes,
  listTavernTypes,
  loadGmHistory,
  pushGmHistory,
  subscribeGmHistory,
  type Gender,
  type GeneratorCard,
  type GeneratorCategory,
  type HistoryEntry,
} from '@/services/gm-toolkit';
import {
  entityIdForGmCategory,
  queueArtFromExternal,
} from '@/services/art-studio';
import { localizeErrorMessage } from '@/utils/localizeError';

type TabKey = GeneratorCategory | 'art' | 'history';

/** Временно выкл.: нет ключей FusionBrain / донастройка Kandinsky */
const ART_STUDIO_ENABLED = false;

const TAB_OPTIONS: SwitcherOption[] = [
  { key: 'npc', label: 'NPC' },
  { key: 'tavern', label: 'Таверны' },
  { key: 'kingdom', label: 'Королевства' },
  { key: 'settlement', label: 'Локации' },
  { key: 'dungeon', label: 'Подземелья' },
  ...(ART_STUDIO_ENABLED ? [{ key: 'art', label: 'Арты' } satisfies SwitcherOption] : []),
  { key: 'history', label: 'История' },
];

function formatTime(at: number) {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    tabsScroll: {
      flexGrow: 0,
    },
    tabsContent: {
      paddingBottom: 2,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 179, 64, 0.55)' : 'rgba(255, 149, 0, 0.32)',
      // Непрозрачный фон: полупрозрачный оранжевый на #000 сливается, текст пропадает.
      backgroundColor: isDark ? '#3A2A10' : 'rgba(255, 149, 0, 0.1)',
    },
    noticeIcon: {
      marginTop: 1,
    },
    noticeTextBlock: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    noticeTitle: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: isDark ? '#FFB340' : '#FF9500',
      lineHeight: FontSize.caption * 1.35,
    },
    noticeText: {
      fontSize: FontSize.caption,
      color: isDark ? '#FFE0B2' : colors.textSecondary,
      lineHeight: FontSize.caption * 1.45,
    },
    filters: {
      gap: Spacing.sm,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    filterHalf: {
      flexGrow: 1,
      flexBasis: 160,
      minWidth: 140,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    actionBtn: {
      flexGrow: 1,
      minWidth: 120,
    },
    empty: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.18)',
      backgroundColor: 'rgba(21, 122, 254, 0.05)',
      padding: Spacing.lg,
      gap: Spacing.sm,
      alignItems: 'flex-start',
    },
    emptyTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    emptyText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.45,
    },
    historyItem: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.18)',
      backgroundColor: 'rgba(21, 122, 254, 0.05)',
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    historyTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    historyMeta: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    historyTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    historySummary: {
      fontSize: FontSize.label,
      color: colors.textSecondary,
      lineHeight: FontSize.label * 1.4,
    },
    historyActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    miniBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.24)',
    },
    miniBtnText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
  });
}

export default function GeneratorsScreen() {
  const pageStyles = useMainScreenStyles();
  const colors = useTheme();
  const { authors } = useAuthors();
  const { colorScheme } = useThemePreference();
  const isDark = colorScheme === 'dark';
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, isDark));
  const hasDesktopSidebar = useIsDesktopSidebarVisible();

  const [tab, setTab] = useState<TabKey>('npc');
  const [raceKey, setRaceKey] = useState<string>('random');
  const [gender, setGender] = useState<Gender>('random');
  const [tavernType, setTavernType] = useState<string>('random');
  const [settlementSize, setSettlementSize] = useState<string>('random');
  const [cardsByTab, setCardsByTab] = useState<
    Partial<Record<GeneratorCategory, GeneratorCard>>
  >({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingChatCard, setPendingChatCard] = useState<GeneratorCard | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const card =
    tab !== 'history' && tab !== 'art' ? (cardsByTab[tab] ?? null) : null;

  useEffect(() => {
    void loadGmHistory();
    return subscribeGmHistory(setHistory);
  }, []);

  const raceOptions: SelectOption[] = useMemo(
    () => [
      { id: 'random', label: 'Случайная раса' },
      ...listRaces().map((race) => ({ id: race.key, label: race.label })),
    ],
    [],
  );

  const genderOptions: SelectOption[] = useMemo(
    () => [
      { id: 'random', label: 'Случайный пол' },
      { id: 'm', label: 'Мужской' },
      { id: 'f', label: 'Женский' },
    ],
    [],
  );

  const tavernTypeOptions: SelectOption[] = useMemo(
    () => [
      { id: 'random', label: 'Любой тип' },
      ...listTavernTypes().map((type) => ({ id: type.key, label: type.label })),
    ],
    [],
  );

  const settlementSizeOptions: SelectOption[] = useMemo(
    () => [
      { id: 'random', label: 'Любой масштаб' },
      ...listSettlementSizes().map((size) => ({ id: size.key, label: size.label })),
    ],
    [],
  );

  const roll = useCallback(
    (category: GeneratorCategory) => {
      let next: GeneratorCard;
      switch (category) {
        case 'npc':
          next = generateNPC(raceKey, gender);
          break;
        case 'tavern':
          next = generateTavern({ typeKey: tavernType });
          break;
        case 'kingdom':
          next = generateKingdom();
          break;
        case 'settlement':
          next = generateSettlement(settlementSize);
          break;
        case 'dungeon':
          next = generateDungeon();
          break;
        default:
          next = generateNPC(raceKey, gender);
      }
      setCardsByTab((prev) => ({ ...prev, [category]: next }));
      pushGmHistory(next);
      return next;
    },
    [gender, raceKey, settlementSize, tavernType],
  );

  // Первый заход на вкладку — один бросок. Назад без перегенерации.
  useEffect(() => {
    if (tab === 'history' || tab === 'art') return;
    if (cardsByTab[tab]) return;
    roll(tab);
  }, [tab, cardsByTab, roll]);
  const handleCopy = useCallback(async (target: GeneratorCard) => {
    try {
      await copyTextToClipboard(formatCardPlaintext(target));
      toast.success('Скопировано');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось скопировать'));
    }
  }, []);

  const openChatPicker = useCallback((target: GeneratorCard) => {
    setPendingChatCard(target);
    setPickerOpen(true);
  }, []);

  const openArtStudio = useCallback(
    (target: GeneratorCard) => {
      const entityId = entityIdForGmCategory(target.category);
      const prompt =
        target.category === 'npc'
          ? `${target.name}, ${target.raceLabel}, ${target.occupation}, ${target.appearance}`
          : target.summary;
      queueArtFromExternal(prompt, entityId);
      setTab('art');
    },
    [],
  );

  const handleSendToChat = useCallback(
    async (conversationId: string, title: string) => {
      if (!pendingChatCard) return;
      setChatBusy(true);
      try {
        await sendChatMessage(conversationId, {
          body: formatCardChatMessage(pendingChatCard),
        });
        toast.success(`Отправлено в «${title}»`);
        setPickerOpen(false);
        setPendingChatCard(null);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось отправить в чат'));
      } finally {
        setChatBusy(false);
      }
    },
    [pendingChatCard],
  );

  return (
    <ScreenTransition>
      <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={pageStyles.scroll}
        contentContainerStyle={pageStyles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          setShowScrollTop(shouldShowScrollToTop(event.nativeEvent.contentOffset.y));
        }}>
        {hasDesktopSidebar ? (
          <Text style={pageStyles.title}>Генераторы</Text>
        ) : (
          <MobileScreenHeader title="Генераторы" />
        )}

        <AuthorsBar authors={authors} />

        <PartnersTicker />

        <View
          style={styles.notice}
          accessibilityRole="text"
          accessibilityLabel="Кубики грамматики иногда выкидывают единицу">
          <Ionicons
            name="alert-circle"
            size={18}
            color={isDark ? '#FFB340' : '#FF9500'}
            style={styles.noticeIcon}
          />
          <View style={styles.noticeTextBlock}>
            <Text style={styles.noticeTitle}>
              Кубики грамматики иногда выкидывают единицу
            </Text>
            <Text style={styles.noticeText}>
              Взгляните на карточку перед отправкой в чат — возможно, придется
              поправить пару окончаний.
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}>
          <Switcher
            options={TAB_OPTIONS}
            value={tab}
            onChange={(key) => setTab(key as TabKey)}
            size="compact"
          />
        </ScrollView>

        {tab !== 'history' && tab !== 'art' ? (
          <View style={styles.filters}>
            {tab === 'npc' ? (
              <View style={styles.filterRow}>
                <View style={styles.filterHalf}>
                  <SelectField
                    label="Раса"
                    value={raceKey}
                    options={raceOptions}
                    onChange={(value) => setRaceKey(value ?? 'random')}
                  />
                </View>
                <View style={styles.filterHalf}>
                  <SelectField
                    label="Пол"
                    value={gender}
                    options={genderOptions}
                    onChange={(value) => setGender((value as Gender) ?? 'random')}
                  />
                </View>
              </View>
            ) : null}

            {tab === 'tavern' ? (
              <SelectField
                label="Тип заведения"
                value={tavernType}
                options={tavernTypeOptions}
                onChange={(value) => setTavernType(value ?? 'random')}
              />
            ) : null}

            {tab === 'settlement' ? (
              <SelectField
                label="Масштаб"
                value={settlementSize}
                options={settlementSizeOptions}
                onChange={(value) => setSettlementSize(value ?? 'random')}
              />
            ) : null}

            <View style={styles.actions}>
              <Button
                label="Ещё раз"
                icon={<Ionicons name="refresh" size={18} color={colors.onPrimary} />}
                onPress={() => roll(tab)}
                style={styles.actionBtn}
              />
              <Button
                label="Скопировать"
                variant="outline"
                icon={<Ionicons name="copy-outline" size={18} color={colors.text} />}
                disabled={!card}
                onPress={() => card && void handleCopy(card)}
                style={styles.actionBtn}
              />
              <Button
                label="В чат"
                variant="outline"
                icon={
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.text} />
                }
                disabled={!card}
                onPress={() => card && openChatPicker(card)}
                style={styles.actionBtn}
              />
              {ART_STUDIO_ENABLED ? (
                <Button
                  label="В арты"
                  variant="outline"
                  icon={<Ionicons name="brush-outline" size={18} color={colors.text} />}
                  disabled={!card}
                  onPress={() => card && openArtStudio(card)}
                  style={styles.actionBtn}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {ART_STUDIO_ENABLED && tab === 'art' ? (
          <ArtStudioPanel />
        ) : tab === 'history' ? (
          history.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>История пуста</Text>
              <Text style={styles.emptyText}>
                Сгенерируй NPC, таверну или подземелье — последние 20 сохранятся здесь.
              </Text>
            </View>
          ) : (
            history.map((entry) => (
              <View key={entry.id} style={styles.historyItem}>
                <View style={styles.historyTop}>
                  <Text style={styles.historyMeta}>
                    {categoryLabel(entry.card.category)} · {formatTime(entry.at)}
                  </Text>
                </View>
                <Text style={styles.historyTitle}>{entry.card.name}</Text>
                <Text style={styles.historySummary} numberOfLines={3}>
                  {entry.card.summary}
                </Text>
                <View style={styles.historyActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void handleCopy(entry.card)}
                    style={({ pressed }) => [styles.miniBtn, pressed && { opacity: 0.85 }]}>
                    <Ionicons name="copy-outline" size={14} color={colors.primary} />
                    <Text style={styles.miniBtnText}>Скопировать</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openChatPicker(entry.card)}
                    style={({ pressed }) => [styles.miniBtn, pressed && { opacity: 0.85 }]}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={styles.miniBtnText}>В чат</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )
        ) : card ? (
          <GmResultCard card={card} />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Пока пусто</Text>
            <Text style={styles.emptyText}>Нажми «Ещё раз», чтобы бросить генерацию.</Text>
          </View>
        )}
      </ScrollView>

      <ScrollToTopButton
        visible={showScrollTop}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
      </View>

      <GmChatTargetPicker
        visible={pickerOpen}
        busy={chatBusy}
        onClose={() => {
          if (!chatBusy) {
            setPickerOpen(false);
            setPendingChatCard(null);
          }
        }}
        onPick={(conversationId, title) => void handleSendToChat(conversationId, title)}
      />
    </ScreenTransition>
  );
}
