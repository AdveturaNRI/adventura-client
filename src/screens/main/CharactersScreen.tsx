import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CharacterCard } from '@/components/characters/CharacterCard';
import { AuthorsBar } from '@/components/authors/AuthorsBar';
import { fetchMyRewards } from '@/services/rewards/rewardsApi';
import { BASE_CHARACTER_SLOTS } from '@/data/rewards/catalog';
import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import {
  ScrollToTopButton,
  shouldShowScrollToTop,
} from '@/components/navigation/ScrollToTopButton';
import {
  GameSystemsPicker,
  type GameSystemOption,
} from '@/components/questionnaire/GameSystemsPicker';
import { Switcher, type SwitcherOption } from '@/components/ui';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAuthors } from '@/context/AuthorsContext';
import {
  buildMockCharacters,
  charactersByScope,
  filterMockCharacters,
  pickMockCharacterSystems,
  type CharacterScope,
  type MockCharacter,
} from '@/data/characters/mock-characters';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { fetchGameSystems } from '@/services/reference/referenceApi';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 1120;
const DESKTOP_CARD_WIDTH = 420;
const DESKTOP_GRID_GAP = Spacing.lg;

const SCOPE_OPTIONS: SwitcherOption[] = [
  { key: 'mine', label: 'Мои', icon: 'person-outline' },
  { key: 'community', label: 'Сообщество', icon: 'people-outline' },
];

function createLocalStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    shell: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      gap: isDesktopWeb ? Spacing.lg : Spacing.md,
      paddingBottom: Spacing.xl,
    },
    headerBlock: {
      gap: Spacing.xs,
    },
    pageTitle: {
      fontSize: isDesktopWeb ? 32 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.4,
    },
    pageSubtitle: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.45,
      maxWidth: 520,
    },
    scopeSwitcher: {
      width: isDesktopWeb ? 460 : '100%',
      alignSelf: isDesktopWeb ? 'flex-start' : undefined,
    },
    toolbar: {
      gap: Spacing.sm,
    },
    searchRow: {
      flexDirection: isDesktopWeb ? 'row' : 'column',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      gap: Spacing.sm,
      width: '100%',
    },
    searchField: {
      flex: isDesktopWeb ? 1 : undefined,
      width: isDesktopWeb ? undefined : '100%',
      minWidth: 0,
      minHeight: 44,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: FontSize.input,
      color: colors.text,
      paddingVertical: Platform.OS === 'web' ? 10 : 8,
      ...Platform.select({
        web: { outlineStyle: 'none' } as object,
        default: {},
      }),
    },
    filtersActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexShrink: 0,
    },
    systemBtn: {
      flexShrink: 0,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    systemBtnActive: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    systemBtnLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
    },
    filtersBadge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    filtersBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    filtersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    },
    activeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 32,
      paddingLeft: 10,
      paddingRight: 8,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    activeChipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    grid: {
      flexDirection: isDesktopWeb ? 'row' : 'column',
      flexWrap: isDesktopWeb ? 'wrap' : 'nowrap',
      alignContent: 'flex-start',
      gap: isDesktopWeb ? DESKTOP_GRID_GAP : Spacing.md,
    },
    cardSlot: {
      width: isDesktopWeb ? DESKTOP_CARD_WIDTH : '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CARD_WIDTH : '100%',
    },
    stateWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.xl,
    },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    emptyTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    emptyHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.caption * 1.45,
      maxWidth: 320,
    },
  });
}

export default function CharactersScreen() {
  const mainStyles = useMainScreenStyles();
  const colors = useTheme();
  const { user } = useAuth();
  const { authors } = useAuthors();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));

  const [scope, setScope] = useState<CharacterScope>('mine');
  const [systemOptions, setSystemOptions] = useState<GameSystemOption[]>([]);
  const [characters, setCharacters] = useState<MockCharacter[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [systemsOpen, setSystemsOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [maxSlots, setMaxSlots] = useState(BASE_CHARACTER_SLOTS);
  const scrollRef = useRef<ScrollView>(null);
  const ownerNickname = user?.nickname?.trim() || 'Вы';

  useEffect(() => {
    let cancelled = false;

    void fetchMyRewards()
      .then((data) => {
        if (!cancelled) {
          setMaxSlots(data.limits.maxActiveCharacters);
        }
      })
      .catch(() => undefined);

    void fetchGameSystems()
      .then((items) => {
        if (cancelled) {
          return;
        }

        const options =
          items.length > 0
            ? items.map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description ?? null,
                isOfficial: item.isOfficial,
              }))
            : pickMockCharacterSystems([]).map((name, index) => ({
                id: `fallback-${index}`,
                name,
                description: null,
                isOfficial: true,
              }));
        setSystemOptions(options);
        setCharacters(
          buildMockCharacters(
            pickMockCharacterSystems(options.map((item) => item.name)),
            ownerNickname,
          ),
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        const fallbackNames = pickMockCharacterSystems([]);
        setSystemOptions(
          fallbackNames.map((name, index) => ({
            id: `fallback-${index}`,
            name,
            description: null,
            isOfficial: true,
          })),
        );
        setCharacters(buildMockCharacters(fallbackNames, ownerNickname));
      });

    return () => {
      cancelled = true;
    };
  }, [ownerNickname]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchQuery(searchDraft.trim());
    }, 350);
    return () => clearTimeout(handle);
  }, [searchDraft]);

  const scopedCharacters = useMemo(
    () => charactersByScope(characters, scope),
    [characters, scope],
  );

  const visibleCharacters = useMemo(
    () => filterMockCharacters(scopedCharacters, searchQuery, selectedSystems),
    [scopedCharacters, searchQuery, selectedSystems],
  );

  const hasActiveFilters = searchQuery.length > 0 || selectedSystems.length > 0;
  const isMineScope = scope === 'mine';
  const pageSubtitle = isMineScope
    ? `Твои листы. Слотов: ${maxSlots}${maxSlots > BASE_CHARACTER_SLOTS ? ' с бонусом тестера' : ''}.`
    : 'Листы других игроков. Смотри и копируй себе.';
  const emptyTitle = hasActiveFilters
    ? 'Никого не нашлось'
    : isMineScope
      ? 'Пока нет своих персонажей'
      : 'В сообществе пока пусто';
  const emptyHint = hasActiveFilters
    ? 'Снимите систему или поменяйте запрос — так проще попасть в список.'
    : isMineScope
      ? 'Когда создашь лист, он окажется здесь.'
      : 'Когда игроки поделятся листами, они появятся здесь.';

  const scopeOptions = useMemo<SwitcherOption[]>(
    () =>
      SCOPE_OPTIONS.map((option) => ({
        ...option,
        badge: charactersByScope(characters, option.key as CharacterScope).length,
      })),
    [characters],
  );

  const handleScopeChange = useCallback((key: string) => {
    setScope(key as CharacterScope);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const openSystems = useCallback(() => {
    setSystemsOpen(true);
  }, []);

  const removeSystem = useCallback((system: string) => {
    setSelectedSystems((current) => current.filter((item) => item !== system));
  }, []);

  const applySystemFromCard = useCallback((system: string) => {
    setSelectedSystems((current) => (current.includes(system) ? current : [...current, system]));
  }, []);

  const systemButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Фильтр по системам"
      onPress={openSystems}
      style={({ pressed }) => [
        styles.systemBtn,
        selectedSystems.length > 0 && styles.systemBtnActive,
        pressed && { opacity: 0.88 },
      ]}>
      <Ionicons
        name="layers-outline"
        size={16}
        color={selectedSystems.length > 0 ? colors.primary : colors.text}
      />
      <Text
        style={[
          styles.systemBtnLabel,
          selectedSystems.length > 0 && { color: colors.primary },
        ]}>
        Система
      </Text>
      {selectedSystems.length > 0 ? (
        <View style={styles.filtersBadge}>
          <Text style={styles.filtersBadgeText}>{selectedSystems.length}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <ScreenTransition animateOnFocus>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={mainStyles.scroll}
          contentContainerStyle={mainStyles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            setShowScrollTop(shouldShowScrollToTop(event.nativeEvent.contentOffset.y));
          }}>
          <View style={styles.shell}>
            {showCompactNav ? (
              <View style={styles.headerBlock}>
                <MobileScreenHeader title="Персонажи" />
                <Text style={styles.pageSubtitle}>{pageSubtitle}</Text>
              </View>
            ) : (
              <View style={styles.headerBlock}>
                <Text style={styles.pageTitle}>Персонажи</Text>
                <Text style={styles.pageSubtitle}>{pageSubtitle}</Text>
              </View>
            )}

            <AuthorsBar authors={authors} />

            <View style={styles.scopeSwitcher}>
              <Switcher
                options={scopeOptions}
                value={scope}
                onChange={handleScopeChange}
                stretch
              />
            </View>

            <View style={styles.toolbar}>
              <View style={styles.searchRow}>
                <View style={styles.searchField}>
                  <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    value={searchDraft}
                    onChangeText={setSearchDraft}
                    placeholder="Имя, класс или система"
                    placeholderTextColor={colors.textMuted}
                    style={styles.searchInput}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {searchDraft ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Очистить поиск"
                      hitSlop={8}
                      onPress={() => setSearchDraft('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
                {isDesktopWeb ? (
                  <View style={styles.filtersActionsRow}>{systemButton}</View>
                ) : null}
              </View>

              <View style={styles.filtersRow}>
                {!isDesktopWeb ? systemButton : null}
                {selectedSystems.map((system) => (
                  <Pressable
                    key={system}
                    accessibilityRole="button"
                    accessibilityLabel={`Убрать фильтр ${system}`}
                    onPress={() => removeSystem(system)}
                    style={({ pressed }) => [styles.activeChip, pressed && { opacity: 0.85 }]}>
                    <Ionicons name="layers-outline" size={13} color={colors.primary} />
                    <Text style={styles.activeChipLabel}>{system}</Text>
                    <Ionicons name="close" size={14} color={colors.primary} />
                  </Pressable>
                ))}
              </View>
            </View>

            {visibleCharacters.length === 0 ? (
              <View style={styles.stateWrap}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name={isMineScope ? 'person-outline' : 'people-outline'}
                    size={26}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                <Text style={styles.emptyHint}>{emptyHint}</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {visibleCharacters.map((item) => (
                  <View key={item.id} style={styles.cardSlot}>
                    <CharacterCard
                      item={item}
                      showOwner={!isMineScope}
                      onSystemPress={applySystemFromCard}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <ScrollToTopButton
          visible={showScrollTop}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        />
      </View>

      <GameSystemsPicker
        visible={systemsOpen}
        options={systemOptions}
        selectedNames={selectedSystems}
        allowCustomSystems={false}
        layout="filter"
        title="Система"
        onChange={setSelectedSystems}
        onClose={() => setSystemsOpen(false)}
      />
    </ScreenTransition>
  );
}
