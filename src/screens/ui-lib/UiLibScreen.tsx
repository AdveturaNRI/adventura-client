import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Caption,
  DividerLabel,
  GameCard,
  H1,
  Input,
  LinkLabel,
  LoadingOverlay,
  MENU_SPECS,
  Menu,
  MenuItem,
  NAVBAR_ITEMS,
  Navbar,
  PasswordInput,
  ProgressCircle,
  SocialButton,
  SwipeBlock,
  Switcher,
  UserCard,
  getToastSpecs,
  toast,
} from '@/components/ui';
import { getBadgeSpecs } from '@/components/ui/feedback/badge.config';
import { getSwipeSpecs } from '@/components/ui/swipe/swipe.config';
import { FontSize, Layout, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const DEMO_USERS = [
  {
    name: 'Swintus',
    age: 22,
    tagline: 'Истина в вине!',
    roles: ['Мастер', 'Игрок'],
    playInfo: {
      playsOnline: true,
      location: 'Екатеринбург',
      systems: ['DND 5', 'Другое'],
      readyToLearnNew: true,
      openToAnySystem: false,
      experience: '6 месяцев',
      schedule: 'ПН–ЧТ с 20:00',
      timezone: 'Asia/Yekaterinburg',
    },
    bio: 'Всем привет! Я полный нубасик, но очень хочу в днд',
    visibility: 'Публичная',
  },
  {
    name: 'Алиса',
    age: 25,
    tagline: 'Магия — это просто',
    roles: ['Игрок'],
    playInfo: {
      playsOnline: false,
      location: 'Москва',
      systems: ['DND 5', 'Pathfinder'],
      readyToLearnNew: false,
      openToAnySystem: false,
      experience: '2 года',
      schedule: 'СБ–ВС с 18:00',
      timezone: 'Europe/Moscow',
    },
    bio: 'Ищу камерную группу для длинной кампании',
    visibility: 'Публичная',
  },
  {
    name: 'Гром',
    age: 30,
    tagline: 'Кости решают всё',
    roles: ['Мастер'],
    playInfo: {
      playsOnline: true,
      location: null,
      systems: ['DND 5', 'Call of Cthulhu'],
      readyToLearnNew: false,
      openToAnySystem: true,
      experience: '5 лет',
      schedule: 'ПТ с 21:00',
      timezone: 'Europe/Moscow',
    },
    bio: 'Веду хоррор и классическое фэнтези',
    visibility: 'Публичная',
  },
];

const DEMO_GAMES = [
  {
    title: 'Ищущие сумрак',
    description: 'Тёмная история в карающем и жестоком мире.',
    date: '10 дек. 2025г.',
    time: '18:00',
    format: 'Онлайн',
    system: 'D&D 5',
    level: 'Подходит новичкам',
    price: '1000₽',
    players: '3/5',
  },
  {
    title: 'Пепельные земли',
    description: 'Постапокалиптическое приключение выживших.',
    date: '15 янв. 2026г.',
    time: '20:00',
    format: 'Офлайн',
    system: 'D&D 5',
    level: 'Средний уровень',
    price: '800₽',
    players: '2/4',
  },
  {
    title: 'Шёпот бездны',
    description: 'Космический хоррор и безумие среди звёзд.',
    date: '22 янв. 2026г.',
    time: '19:30',
    format: 'Онлайн',
    system: 'Call of Cthulhu',
    level: 'Для опытных',
    price: '1200₽',
    players: '4/6',
  },
];

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SpecRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.specRow}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      alignItems: 'center',
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.md,
    },
    container: {
      width: '100%',
      maxWidth: Layout.maxContentWidth,
      gap: Spacing.section,
    },
    pageTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    section: {
      gap: Spacing.md,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    sectionBody: {
      gap: Spacing.md,
    },
    socialRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    badgeSpecCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: Spacing.md,
      gap: Spacing.sm,
      backgroundColor: colors.surfaceMuted,
    },
    badgePreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    badgeVariantName: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    badgeDescription: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
    },
    specGrid: {
      gap: Spacing.xs,
    },
    specRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    specLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: 'monospace',
    },
    specValue: {
      flex: 1,
      fontSize: 12,
      color: colors.text,
      textAlign: 'right',
      fontFamily: 'monospace',
    },
    swipeSpecCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: Spacing.md,
      gap: Spacing.xs,
      backgroundColor: colors.surfaceMuted,
    },
    swipeSpecTitle: {
      fontSize: FontSize.caption,
      color: colors.text,
      fontWeight: '600',
    },
    swipeSpecMeta: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: 'monospace',
    },
    swipeDemoBlock: {
      padding: Spacing.md,
      gap: Spacing.xs,
    },
    swipeDemoTitle: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    swipeDemoText: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.4,
    },
    stackLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    cardStack: {
      position: 'relative',
    },
    navbarPreview: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
  });
}

export default function UiLibScreen() {
  const [switcherValue, setSwitcherValue] = useState('login');
  const [swipeMessage, setSwipeMessage] = useState(
    'Свайпни или потяни мышью блок влево или вправо',
  );
  const [cardSwipeMessage, setCardSwipeMessage] = useState(
    'Свайпни карточку — она улетит, появится следующая',
  );
  const [userIndex, setUserIndex] = useState(0);
  const [gameIndex, setGameIndex] = useState(0);
  const [navbarValue, setNavbarValue] = useState('games');
  const [menuMessage, setMenuMessage] = useState('Нажми пункт меню');

  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const badgeSpecs = useMemo(() => getBadgeSpecs(colors), [colors]);
  const swipeSpecs = useMemo(() => getSwipeSpecs(colors), [colors]);
  const toastSpecs = useMemo(() => getToastSpecs(colors), [colors]);

  const currentUser = DEMO_USERS[userIndex];
  const currentGame = DEMO_GAMES[gameIndex];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <Text style={styles.pageTitle}>UI Library</Text>

          <Section styles={styles} title="Headers">
            <H1>Начните приключение{'\n'}прямо сейчас</H1>
          </Section>

          <Section styles={styles} title="Labels">
            <LinkLabel>Забыли пароль?</LinkLabel>
            <DividerLabel label="войти с помощью" />
            <View style={styles.linkRow}>
              <LinkLabel>Регистрация</LinkLabel>
              <Caption>·</Caption>
              <LinkLabel>Войти</LinkLabel>
            </View>
          </Section>

          <Section styles={styles} title="Inputs">
            <Input label="Никнейм" defaultValue="Swintus" />
            <PasswordInput label="Пароль" defaultValue="password" />
          </Section>

          <Section styles={styles} title="Buttons">
            <Button label="Войти" />
            <Switcher
              options={[
                { key: 'login', label: 'Вход' },
                { key: 'register', label: 'Регистрация' },
              ]}
              value={switcherValue}
              onChange={setSwitcherValue}
            />
            <View style={styles.socialRow}>
              <SocialButton provider="vk" />
              <SocialButton provider="yandex" />
            </View>
          </Section>

          <Section styles={styles} title="Badges">
            {badgeSpecs.map((spec) => (
              <View key={spec.variant} style={styles.badgeSpecCard}>
                <View style={styles.badgePreviewRow}>
                  <Badge label={spec.label} variant={spec.variant} />
                  <Text style={styles.badgeVariantName}>{spec.variant}</Text>
                </View>
                <Text style={styles.badgeDescription}>{spec.description}</Text>
                <View style={styles.specGrid}>
                  <SpecRow styles={styles} label="background" value={spec.backgroundColor} />
                  <SpecRow styles={styles} label="border" value={spec.borderColor} />
                  <SpecRow styles={styles} label="text" value={spec.textColor} />
                  <SpecRow styles={styles} label="fontSize" value={`${spec.fontSize}px`} />
                  <SpecRow styles={styles} label="minHeight" value={`${spec.minHeight}px`} />
                  <SpecRow styles={styles} label="radius" value={`${spec.borderRadius}px`} />
                  <SpecRow styles={styles} label="paddingX" value={`${spec.paddingHorizontal}px`} />
                </View>
              </View>
            ))}

            <View style={styles.badgeRow}>
              <ProgressCircle value={100} />
              <Caption>ProgressCircle · 100%</Caption>
            </View>
          </Section>

          <Section styles={styles} title="Loader">
            <LoadingOverlay label="Бросаем d20..." />
          </Section>

          <Section styles={styles} title="Toasts">
            <Caption>react-native-toast-message · success / error / info / warning</Caption>

            {toastSpecs.map((spec) => (
              <View key={spec.variant} style={styles.badgeSpecCard}>
                <Text style={styles.badgeVariantName}>{spec.label}</Text>
                <Text style={styles.badgeDescription}>{spec.description}</Text>
                <Button
                  label={`Показать ${spec.label.toLowerCase()}`}
                  onPress={() =>
                    toast[spec.variant](`Пример уведомления: ${spec.label.toLowerCase()}`, {
                      title: spec.label,
                    })
                  }
                />
              </View>
            ))}

            <Text style={styles.stackLabel}>Позиция</Text>
            <View style={styles.socialRow}>
              <Button
                label="Сверху"
                variant="outline"
                onPress={() =>
                  toast.info('Тост появляется сверху экрана', {
                    title: 'Верх',
                    position: 'top',
                  })
                }
              />
              <Button
                label="Снизу"
                variant="outline"
                onPress={() =>
                  toast.info('Тост появляется снизу экрана', {
                    title: 'Низ',
                    position: 'bottom',
                  })
                }
              />
            </View>

            <Text style={styles.stackLabel}>Выравнивание</Text>
            <View style={styles.socialRow}>
              <Button
                label="Слева"
                variant="outline"
                onPress={() =>
                  toast.warning('Выравнивание по левому краю', {
                    alignment: 'left',
                    position: 'top',
                  })
                }
              />
              <Button
                label="По центру"
                variant="outline"
                onPress={() =>
                  toast.warning('Выравнивание по центру', {
                    alignment: 'center',
                    position: 'top',
                  })
                }
              />
              <Button
                label="Справа"
                variant="outline"
                onPress={() =>
                  toast.warning('Выравнивание по правому краю', {
                    alignment: 'right',
                    position: 'top',
                  })
                }
              />
            </View>
          </Section>

          <Section styles={styles} title="Swipe">
            <Caption>{swipeMessage}</Caption>
            {swipeSpecs.map((spec) => (
              <View key={spec.direction} style={styles.swipeSpecCard}>
                <Text style={styles.swipeSpecTitle}>
                  {spec.gesture} → {spec.reveals}
                </Text>
                <Text style={styles.swipeSpecMeta}>
                  color: {spec.defaultColor} · label: {spec.exampleLabel}
                </Text>
              </View>
            ))}

            <SwipeBlock
              leftAction={{
                label: 'Закрепить',
                backgroundColor: colors.primary,
                onPress: () => setSwipeMessage('Сработало: свайп вправо → Закрепить'),
              }}
              rightAction={{
                label: 'Удалить',
                backgroundColor: colors.destructive,
                onPress: () => setSwipeMessage('Сработало: свайп влево → Удалить'),
              }}>
              <View style={styles.swipeDemoBlock}>
                <Text style={styles.swipeDemoTitle}>Блок с вайпом</Text>
                <Text style={styles.swipeDemoText}>
                  Свайп или drag вправо — закрепить, влево — удалить
                </Text>
              </View>
            </SwipeBlock>

            <SwipeBlock
              rightAction={{
                label: 'Скрыть',
                backgroundColor: colors.textMuted,
                onPress: () => setSwipeMessage('Только свайп влево → Скрыть'),
              }}>
              <View style={styles.swipeDemoBlock}>
                <Text style={styles.swipeDemoTitle}>Только влево</Text>
                <Text style={styles.swipeDemoText}>Доступно одно действие справа</Text>
              </View>
            </SwipeBlock>
          </Section>

          <Section styles={styles} title="Cards">
            <Caption>{cardSwipeMessage}</Caption>

            <Text style={styles.stackLabel}>Профили</Text>
            <View style={styles.cardStack}>
              <UserCard
                {...currentUser}
                swipe={{
                  dismissible: true,
                  resetKey: userIndex,
                  leftAction: {
                    label: 'В избранные',
                    backgroundColor: colors.primary,
                  },
                  rightAction: {
                    label: 'Скрыть',
                    backgroundColor: colors.textMuted,
                  },
                  onDismiss: (direction) => {
                    setCardSwipeMessage(
                      direction === 'right'
                        ? `${currentUser.name} в избранных — следующий профиль`
                        : `${currentUser.name} скрыт — следующий профиль`,
                    );
                    setUserIndex((index) => (index + 1) % DEMO_USERS.length);
                  },
                }}
              />
            </View>

            <Text style={styles.stackLabel}>Игры</Text>
            <View style={styles.cardStack}>
              <GameCard
                {...currentGame}
                swipe={{
                  dismissible: true,
                  resetKey: gameIndex,
                  leftAction: {
                    label: 'Записаться',
                    backgroundColor: colors.success,
                  },
                  rightAction: {
                    label: 'Скрыть',
                    backgroundColor: colors.destructive,
                  },
                  onDismiss: (direction) => {
                    setCardSwipeMessage(
                      direction === 'right'
                        ? `Заявка на «${currentGame.title}» — следующая игра`
                        : `«${currentGame.title}» скрыта — следующая игра`,
                    );
                    setGameIndex((index) => (index + 1) % DEMO_GAMES.length);
                  },
                }}
              />
            </View>
          </Section>

          <Section styles={styles} title="Navigation">
            <Caption>{menuMessage}</Caption>

            <Text style={styles.stackLabel}>Menu</Text>
            <Menu title="Основные">
              {MENU_SPECS.map((item) => (
                <MenuItem
                  key={item.key}
                  label={item.label}
                  subtitle={item.subtitle}
                  icon={item.icon}
                  onPress={() => setMenuMessage(`Выбрано: ${item.label}`)}
                />
              ))}
            </Menu>

            <Text style={styles.stackLabel}>Navbar</Text>
            <View style={styles.navbarPreview}>
              <Navbar items={NAVBAR_ITEMS} value={navbarValue} onChange={setNavbarValue} />
            </View>
            <Caption>Активная вкладка: {NAVBAR_ITEMS.find((item) => item.key === navbarValue)?.label}</Caption>
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

