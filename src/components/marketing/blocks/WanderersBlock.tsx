import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  MarketingButton,
  MarketingPanel,
  MarketingSection,
  SectionHeader,
  useMarketingBreakpoint,
} from '@/components/marketing/shared';
import type { ResolvedMarketingSkin } from '@/components/marketing/theme';
import type { WandererFeedBlock } from '@/components/marketing/types';

type Props = {
  block: WandererFeedBlock;
  skin: ResolvedMarketingSkin;
  onCta: (url: string, key: string) => void;
};

type Direction = 'right' | 'left';

type DeckCard = {
  key: string;
  name: string;
  age: number;
  roles: string[];
  presence: string;
  online: boolean;
  place: string;
  playsOnline: boolean;
  tagline: string;
  experience: string;
  systems: string[];
  schedule: string;
  about: string;
  /** Generated portrait of a person who doesn't exist; the face sits in the upper half. */
  photo: ImageSource;
  /** Shown while the photo loads. */
  palette: [string, string];
};

/** Fictional questionnaires: the landing must not show real people. */
const MOCK_WANDERERS: DeckCard[] = [
  {
    key: 'tema',
    name: 'Тёма_за_ширмой',
    age: 27,
    roles: ['Мастер'],
    presence: 'в сети',
    online: true,
    place: 'Москва',
    playsOnline: true,
    tagline: 'Веду кампанию по Забытым королевствам',
    experience: '5+ лет',
    systems: ['D&D 5e', 'Pathfinder 2e'],
    schedule: 'Пт, Сб',
    about:
      'Вожу третью кампанию подряд. Люблю, когда игроки сами двигают сюжет, а я подкидываю последствия. Ищу двоих в постоянную группу по пятницам, новичкам всё объясню.',
    photo: require('../../../../assets/images/wanderers/tema.webp'),
    palette: ['#5B3CC4', '#1E9BFF'],
  },
  {
    key: 'lisica',
    name: 'Лисица',
    age: 23,
    roles: ['Игрок'],
    presence: 'была 10 мин. назад',
    online: false,
    place: '',
    playsOnline: true,
    tagline: 'Отыгрыш важнее кубов',
    experience: '1–3 года',
    systems: ['Call of Cthulhu', 'Vampire: The Masquerade'],
    schedule: 'Вт, Чт',
    about:
      'Играю за персонажей с тёмным прошлым и обожаю детективные ваншоты. В голосе без проблем, камеру включаю. Ищу мастера, который любит хоррор и не боится долгих пауз.',
    photo: require('../../../../assets/images/wanderers/lisica.webp'),
    palette: ['#FF6B3D', '#C2185B'],
  },
  {
    key: 'gnom',
    name: 'Гном_с_кружкой',
    age: 31,
    roles: ['Игрок', 'Мастер'],
    presence: 'в сети',
    online: true,
    place: 'Санкт-Петербург',
    playsOnline: false,
    tagline: 'Свой стол и террейн дома',
    experience: '5+ лет',
    systems: ['Warhammer Fantasy', 'D&D 5e'],
    schedule: 'Сб, Вс',
    about:
      'Собираю миниатюры и печатаю террейн. По выходным провожу офлайн-сессии у себя на Петроградке, чай и снеки с меня. Могу подменить мастера, если ваш заболел.',
    photo: require('../../../../assets/images/wanderers/gnom.webp'),
    palette: ['#2E9E5B', '#0F5C4A'],
  },
  {
    key: 'arkana',
    name: 'Аркана',
    age: 25,
    roles: ['Мастер'],
    presence: 'была вчера',
    online: false,
    place: 'Казань',
    playsOnline: true,
    tagline: 'Пишу свои миры',
    experience: '3–5 лет',
    systems: ['Авторская система', 'Fate'],
    schedule: 'По договорённости',
    about:
      'Вожу по своему сеттингу про летающие острова. Правила лёгкие, упор на историю и решения игроков. Первая сессия бесплатно, дальше договоримся.',
    photo: require('../../../../assets/images/wanderers/arkana.webp'),
    palette: ['#9562F5', '#E040A0'],
  },
  {
    key: 'bard',
    name: 'Сонный_Бард',
    age: 20,
    roles: ['Игрок'],
    presence: 'в сети',
    online: true,
    place: '',
    playsOnline: true,
    tagline: 'Хочу попробовать НРИ впервые',
    experience: 'Новичок',
    systems: ['Любая система'],
    schedule: 'Будни вечером',
    about:
      'Посмотрел Critical Role и понял, что хочу так же. Опыта ноль, но правила читать готов. Ищу дружелюбную группу, где не страшно ошибиться.',
    photo: require('../../../../assets/images/wanderers/bard.webp'),
    palette: ['#F5A623', '#E8590C'],
  },
  {
    key: 'raven',
    name: 'Капитан_Рейвен',
    age: 34,
    roles: ['Мастер'],
    presence: 'был 2 ч. назад',
    online: false,
    place: 'Екатеринбург',
    playsOnline: true,
    tagline: 'Космос и киберпанк',
    experience: '5+ лет',
    systems: ['Starfinder', 'Cyberpunk RED'],
    schedule: 'Ср, Пт',
    about:
      'Веду sci-fi кампании с музыкой и картами в Foundry. Длинные арки на полгода, сессии по 4 часа. Не хватает одного игрока на роль пилота.',
    photo: require('../../../../assets/images/wanderers/raven.webp'),
    palette: ['#157AFE', '#0B1F4D'],
  },
];

const LIKE_COLOR = '#34C759';
const SKIP_COLOR = '#FF3B30';
const MASTER_COLOR = '#9562F5';

/**
 * Decorative copy of the feed's active-filter row. Broad on purpose: almost every
 * questionnaire in the deck fits these, so cards don't contradict the chips.
 */
const DEMO_FILTERS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Игрок', icon: 'game-controller-outline' },
  { label: 'Мастер', icon: 'book-outline' },
  { label: 'Онлайн', icon: 'wifi-outline' },
  { label: 'Любая система', icon: 'apps-outline' },
  { label: 'Готов пробовать новое', icon: 'sparkles-outline' },
  { label: 'Вечера и выходные', icon: 'calendar-outline' },
];

/** Not strictly alternating, so the loop doesn't look mechanical. */
const SWIPE_PATTERN: Direction[] = ['right', 'right', 'left', 'right', 'left', 'left', 'right'];
/** Lets the landing's scroll reveal fade the block in before the first lean. */
const FIRST_HOLD_MS = 450;
const HOLD_MS = 1900;
const LEAN_MS = 380;
const LEAN_HOLD_MS = 360;
const FLY_MS = 480;
const STACK_OFFSET = 14;
const STACK_SCALE = 0.05;
const VISIBLE_CARDS = 3;
const CARD_WIDTH = 360;
const CARD_RATIO = 1.55;
/** Upper bound on phones; the screen-height budget below usually wins. */
const MOBILE_CARD_RATIO = 1.42;
/**
 * Everything on a phone screen besides the deck: landing top bar (~72), panel padding (32),
 * three-line title (~106), filters row (36), legend (30) and the gaps between them (54).
 */
const MOBILE_CHROME_HEIGHT = 330;
/** A four-line description under the title. */
const MOBILE_DESCRIPTION_HEIGHT = 100;
const MOBILE_CTA_HEIGHT = 66;
/** Below this the copy covers the face; short phones (iPhone SE) scroll the block instead. */
const MOBILE_CARD_MIN_HEIGHT = 420;
const MOBILE_STACK_OFFSET = 8;
/** Below this the overlay text would reach the role chips, so the bio gets fewer lines. */
const SHORT_CARD_HEIGHT = 440;
/** Room on each side of the deck for the scaled-down cards behind. */
const DECK_SIDE_ROOM = 8;
/** Lean before the fly-out; phones lean less since the card spans the panel. */
const LEAN = 0.16;
const MOBILE_LEAN = 0.08;
const ABOUT_LINES = 7;
const MAX_SYSTEMS = 2;
/** How far the photo reaches under the copy, and how long its fade-out is. */
const PHOTO_OVERLAP = 56;
const PHOTO_FADE = 72;

export function WanderersBlockView({ block, skin, onCta }: Props) {
  const { isMobile, width } = useMarketingBreakpoint();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [cursor, setCursor] = useState(0);
  const key = block.id ?? 'wanderers';
  const cards = MOCK_WANDERERS;
  const openUrl = block.ctaUrl || '/wanderers';

  const advance = useCallback(() => setCursor((value) => value + 1), []);

  // Phones: the card width comes from CSS (full panel width, capped), so a stale window
  // size can't push it past the panel. The estimate only drives height and fly distance.
  const mobileEstimate = Math.max(240, Math.min(CARD_WIDTH, width - 64 - DECK_SIDE_ROOM * 2));
  const cardWidth = isMobile ? mobileEstimate : CARD_WIDTH;
  const stackOffset = isMobile ? MOBILE_STACK_OFFSET : STACK_OFFSET;
  const stackRoom = stackOffset * (VISIBLE_CARDS - 1) + 8;
  const hasCta = Boolean(block.ctaLabel && block.ctaUrl);
  // Phones: the whole block (title, filters, deck, legend) should fit one screen.
  const mobileBudget =
    height -
    MOBILE_CHROME_HEIGHT -
    (block.description ? MOBILE_DESCRIPTION_HEIGHT : 0) -
    stackRoom -
    (hasCta ? MOBILE_CTA_HEIGHT : 0);
  const cardHeight = isMobile
    ? Math.max(
        MOBILE_CARD_MIN_HEIGHT,
        Math.min(Math.round(cardWidth * MOBILE_CARD_RATIO), mobileBudget),
      )
    : Math.round(cardWidth * CARD_RATIO);
  const aboutLines = cardHeight < SHORT_CARD_HEIGHT ? 3 : ABOUT_LINES;
  const deckHeight = cardHeight + stackRoom;
  const visible = Math.min(VISIBLE_CARDS, cards.length);

  const deck = (
    <View
      style={[
        styles.deck,
        isMobile
          ? { width: '100%', maxWidth: CARD_WIDTH + DECK_SIDE_ROOM * 2, height: deckHeight }
          : { width: cardWidth + DECK_SIDE_ROOM * 2, height: deckHeight },
      ]}>
      {Array.from({ length: visible }, (_, index) => visible - 1 - index).map((slot) => {
        const absolute = cursor + slot;
        const card = cards[absolute % cards.length];
        return (
          <SwipeCard
            key={absolute}
            card={card}
            slot={slot}
            direction={SWIPE_PATTERN[absolute % SWIPE_PATTERN.length]}
            width={cardWidth}
            height={cardHeight}
            fluid={isMobile}
            stackOffset={stackOffset}
            aboutLines={aboutLines}
            lean={isMobile ? MOBILE_LEAN : LEAN}
            animate={!reduceMotion}
            onSwiped={advance}
            onOpen={() => onCta(openUrl, key)}
          />
        );
      })}
    </View>
  );

  const cta =
    block.ctaLabel && block.ctaUrl ? (
      <View style={isMobile ? styles.ctaMobile : styles.cta}>
        <MarketingButton
          skin={skin}
          label={block.ctaLabel}
          onPress={() => onCta(block.ctaUrl!, key)}
        />
      </View>
    ) : null;

  if (isMobile) {
    return (
      <MarketingSection skin={skin}>
        <MarketingPanel skin={skin}>
          <View style={styles.mobileLayout}>
            <SectionHeader
              skin={skin}
              title={block.title}
              description={block.description}
              align="center"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersScroll}
              contentContainerStyle={styles.filtersScrollContent}>
              <DemoFilters skin={skin} />
            </ScrollView>
            {deck}
            <View style={[styles.legend, styles.centerRow]}>
              <LegendChip icon="heart" label="→ В избранные" color={LIKE_COLOR} />
              <LegendChip icon="close" label="← Пропустить" color={SKIP_COLOR} />
            </View>
            {cta}
          </View>
        </MarketingPanel>
      </MarketingSection>
    );
  }

  return (
    <MarketingSection skin={skin}>
      <MarketingPanel skin={skin}>
        <View style={styles.layout}>
          <View style={styles.copy}>
            <SectionHeader
              skin={skin}
              title={block.title}
              description={block.description}
              align="left"
            />
            <View style={styles.filters}>
              <DemoFilters skin={skin} />
            </View>
            <View style={styles.legend}>
              <LegendChip icon="heart" label="Вправо — в избранные" color={LIKE_COLOR} />
              <LegendChip icon="close" label="Влево — пропустить" color={SKIP_COLOR} />
            </View>
            {cta}
          </View>
          {deck}
        </View>
      </MarketingPanel>
    </MarketingSection>
  );
}

/** Chips only; the parent decides between wrapping (desktop) and a scroll row (phones). */
function DemoFilters({ skin }: { skin: ResolvedMarketingSkin }) {
  return (
    <>
      <View
        accessibilityLabel={`Пример фильтров: ${DEMO_FILTERS.map((item) => item.label).join(', ')}`}
        style={[
          styles.filtersToggle,
          { borderColor: skin.accentColor, backgroundColor: `${skin.accentColor}14` },
        ]}>
        <Ionicons name="options-outline" size={16} color={skin.accentColor} />
        <Text style={[styles.filtersToggleLabel, { color: skin.text }]}>Фильтры</Text>
        <View style={[styles.filtersBadge, { backgroundColor: skin.accentColor }]}>
          <Text style={styles.filtersBadgeText}>{DEMO_FILTERS.length}</Text>
        </View>
      </View>
      {DEMO_FILTERS.map((item, index) => (
        <Animated.View
          key={item.label}
          entering={FadeIn.delay(120 + index * 90).duration(320)}
          style={[
            styles.filterChip,
            { backgroundColor: skin.accentColor, borderColor: skin.accentColor },
          ]}>
          <Ionicons name={item.icon} size={14} color="#FFFFFF" />
          <Text style={styles.filterChipLabel} numberOfLines={1}>
            {item.label}
          </Text>
          <Ionicons name="close" size={14} color="#FFFFFF" />
        </Animated.View>
      ))}
    </>
  );
}

function LegendChip({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}) {
  return (
    <View style={[styles.legendChip, { backgroundColor: `${color}1A`, borderColor: `${color}40` }]}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.legendText, { color }]}>{label}</Text>
    </View>
  );
}

function SwipeCard({
  card,
  slot,
  direction,
  width,
  height,
  fluid,
  stackOffset,
  aboutLines,
  lean,
  animate,
  onSwiped,
  onOpen,
}: {
  card: DeckCard;
  slot: number;
  direction: Direction;
  width: number;
  height: number;
  /** Stretch between the deck's side insets instead of using `width`. */
  fluid: boolean;
  stackOffset: number;
  aboutLines: number;
  lean: number;
  animate: boolean;
  onSwiped: () => void;
  onOpen: () => void;
}) {
  const swipe = useSharedValue(0);
  const sign = direction === 'right' ? 1 : -1;
  const color = direction === 'right' ? LIKE_COLOR : SKIP_COLOR;
  // The very first card and any resume after a pause swipe soon; the rest wait their turn.
  const quickStart = useRef(slot === 0);

  useEffect(() => {
    if (slot !== 0) return;
    if (!animate) {
      quickStart.current = true;
      swipe.set(withTiming(0, { duration: 220 }));
      return;
    }
    const holdMs = quickStart.current ? FIRST_HOLD_MS : HOLD_MS;
    quickStart.current = false;
    const timer = setTimeout(() => {
      swipe.set(
        withSequence(
          withTiming(sign * lean, { duration: LEAN_MS, easing: Easing.out(Easing.cubic) }),
          withTiming(sign * lean * 1.06, { duration: LEAN_HOLD_MS }),
          withTiming(
            sign * 1.3,
            { duration: FLY_MS, easing: Easing.in(Easing.cubic) },
            (finished) => {
              if (finished) runOnJS(onSwiped)();
            },
          ),
        ),
      );
    }, holdMs);
    return () => {
      clearTimeout(timer);
      cancelAnimation(swipe);
    };
  }, [slot, animate, lean, sign, swipe, onSwiped]);

  const stackStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: withTiming(slot * stackOffset, { duration: 380 }) },
        { scale: withTiming(1 - slot * STACK_SCALE, { duration: 380 }) },
      ],
    }),
    [slot, stackOffset],
  );

  const swipeStyle = useAnimatedStyle(() => {
    const value = swipe.get();
    return {
      opacity: interpolate(Math.abs(value), [0.7, 1.3], [1, 0], 'clamp'),
      transform: [{ translateX: value * width * 1.15 }, { rotate: `${value * 16}deg` }],
    };
  }, [width]);

  const highlightStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(Math.abs(swipe.get()), [lean * 0.12, lean * 0.9], [0, 1], 'clamp'),
    }),
    [lean],
  );

  const stampStyle = useAnimatedStyle(() => {
    const strength = interpolate(Math.abs(swipe.get()), [lean * 0.25, lean], [0, 1], 'clamp');
    return {
      opacity: strength,
      transform: [
        { rotate: direction === 'right' ? '-12deg' : '12deg' },
        { scale: 0.8 + strength * 0.2 },
      ],
    };
  }, [direction, lean]);

  return (
    <Animated.View
      entering={FadeIn.duration(320)}
      style={[
        styles.slot,
        fluid ? styles.slotFluid : { width },
        { height, zIndex: VISIBLE_CARDS - slot },
        stackStyle,
      ]}>
      <Animated.View style={[styles.fill, swipeStyle]}>
        <Pressable
          accessibilityLabel={`Анкета ${card.name}`}
          disabled={slot !== 0}
          onPress={onOpen}
          style={styles.fill}>
          <WandererCardFace card={card} aboutLines={aboutLines} />
        </Pressable>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            { borderColor: color },
            Platform.OS === 'web' ? ({ boxShadow: `0 0 28px ${color}99` } as object) : null,
            highlightStyle,
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.stamp,
            direction === 'right' ? styles.stampLeft : styles.stampRight,
            { borderColor: color, backgroundColor: `${color}26` },
            stampStyle,
          ]}>
          <Ionicons name={direction === 'right' ? 'heart' : 'close'} size={16} color={color} />
          <Text style={[styles.stampText, { color }]}>
            {direction === 'right' ? 'В избранные' : 'Пропустить'}
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

function WandererCardFace({ card, aboutLines }: { card: DeckCard; aboutLines: number }) {
  const systems = card.systems.slice(0, MAX_SYSTEMS);
  const extraSystems = card.systems.length - systems.length;
  const place = [card.playsOnline ? 'Онлайн' : null, card.place].filter(Boolean).join(' · ');
  const name = `${card.name}, ${card.age}`;
  const [from, to] = card.palette;
  const [infoHeight, setInfoHeight] = useState(0);

  return (
    <View style={styles.face}>
      <View
        style={[
          StyleSheet.absoluteFill,
          Platform.OS === 'web'
            ? ({ backgroundImage: `linear-gradient(160deg, ${from} 0%, ${to} 100%)` } as object)
            : { backgroundColor: from },
        ]}
      />
      {/* Ends just below the top of the copy, so on short cards the face isn't under the text. */}
      <View
        pointerEvents="none"
        style={[styles.photoBox, { bottom: Math.max(0, infoHeight - PHOTO_OVERLAP) }]}>
        <Image
          source={card.photo}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          transition={200}
          accessible={false}
        />
      </View>
      <View pointerEvents="none" style={styles.shade} />
      <View pointerEvents="none" style={styles.spacer} />

      <View style={styles.topRow}>
        <View style={styles.roles}>
          {card.roles.slice(0, 2).map((role) => {
            const isMaster = /мастер/i.test(role);
            return (
              <View
                key={role}
                style={[styles.roleChip, { backgroundColor: isMaster ? MASTER_COLOR : LIKE_COLOR }]}>
                <Ionicons
                  name={isMaster ? 'book-outline' : 'game-controller-outline'}
                  size={11}
                  color="#FFFFFF"
                />
                <Text style={styles.roleText}>{role}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.presenceChip}>
          <View
            style={[
              styles.presenceDot,
              { backgroundColor: card.online ? LIKE_COLOR : 'rgba(255,255,255,0.7)' },
            ]}
          />
          <Text style={styles.presenceText} numberOfLines={1}>
            {card.presence}
          </Text>
        </View>
      </View>

      <View
        style={styles.info}
        onLayout={(event) => setInfoHeight(Math.round(event.nativeEvent.layout.height))}>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.tagline} numberOfLines={1}>
            {card.tagline}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons
            name={card.playsOnline ? 'wifi-outline' : 'location-outline'}
            size={13}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={styles.metaText} numberOfLines={1}>
            {place}
          </Text>
        </View>
        <View style={styles.chips}>
          <InfoChip icon="ribbon-outline" label={card.experience} accent />
          {systems.map((system) => (
            <InfoChip key={system} icon="dice-outline" label={system} />
          ))}
          {extraSystems > 0 ? <InfoChip label={`+${extraSystems}`} /> : null}
          <InfoChip icon="calendar-outline" label={card.schedule} />
        </View>
        <Text style={styles.about} numberOfLines={aboutLines}>
          {card.about}
        </Text>
      </View>
    </View>
  );
}

function InfoChip({
  icon,
  label,
  accent = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.chip, accent && styles.chipAccent]}>
      {icon ? <Ionicons name={icon} size={11} color="#FFFFFF" /> : null}
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  copy: { flex: 1, minWidth: 0, gap: 20 },
  mobileLayout: { width: '100%', alignItems: 'center', gap: 18 },
  centerRow: { justifyContent: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  filtersScroll: { alignSelf: 'stretch', flexGrow: 0 },
  filtersScrollContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
  filtersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  filtersToggleLabel: { fontSize: 13, fontWeight: '600' },
  filtersBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipLabel: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  legendText: { fontSize: 13, fontWeight: '700' },
  cta: { alignSelf: 'flex-start' },
  ctaMobile: { alignSelf: 'center' },
  deck: { position: 'relative', alignItems: 'center', alignSelf: 'center' },
  slot: { position: 'absolute', top: 0, left: DECK_SIDE_ROOM },
  slotFluid: { right: DECK_SIDE_ROOM },  fill: { width: '100%', height: '100%' },
  face: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1A2A42',
    ...Platform.select({
      web: { boxShadow: '0 14px 36px rgba(0,0,0,0.28)' } as object,
      default: { elevation: 4 },
    }),
  },
  photoBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    ...Platform.select({
      web: {
        maskImage: `linear-gradient(to bottom, #000 calc(100% - ${PHOTO_FADE}px), transparent)`,
      } as object,
      default: {},
    }),
  },
  spacer: { flex: 1, minHeight: 44 },
  shade: {
    ...StyleSheet.absoluteFill,
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 40%, rgba(0,0,0,0) 72%), linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 18%)',
      } as object,
      default: { backgroundColor: 'rgba(0,0,0,0.35)' },
    }),
  },
  topRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  roles: { flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  presenceChip: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  presenceDot: { width: 7, height: 7, borderRadius: 4 },
  presenceText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  info: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 8 },
  identity: { gap: 2 },
  name: { fontSize: 22, lineHeight: 27, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  tagline: { fontSize: 13, lineHeight: 17, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { flexShrink: 1, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  chipAccent: { backgroundColor: 'rgba(21,122,254,0.55)', borderColor: 'rgba(21,122,254,0.8)' },
  chipText: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  about: { fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.92)' },
  highlight: {
    ...StyleSheet.absoluteFill,
    borderRadius: 22,
    borderWidth: 3,
  },
  stamp: {
    position: 'absolute',
    top: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 2,
  },
  stampLeft: { left: 16 },
  stampRight: { right: 16 },
  stampText: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
});
