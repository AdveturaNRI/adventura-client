import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ensureRewardsFxStyles } from '@/components/rewards/rewards-fx';
import {
  REWARD_BADGES,
  rewardUiTone,
  type RewardBadgeType,
} from '@/data/rewards/catalog';
import { FontSize } from '@/constants/theme';
import { useThemePreference } from '@/hooks/use-theme';

function portalToBody(node: ReactNode) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return null;
  }
  // Native bundles never hit this branch.
  const { createPortal } = require('react-dom') as typeof import('react-dom');
  return createPortal(node, document.body);
}

type Props = {
  type: RewardBadgeType;
  size?: number;
  /** Off when the icon sits inside another button (web forbids nested `<button>`). */
  interactive?: boolean;
};

const ICON_MAP: Record<RewardBadgeType, keyof typeof Ionicons.glyphMap> = {
  alpha_tester: 'sparkles',
  bug_hunter: 'bug',
  founding_dm: 'flame',
  early_arrival: 'compass',
  tavern_keeper: 'beer',
};

const TIP_WIDTH = 236;
const TIP_GAP = 10;
const VIEW_PAD = 12;

type TipPos = {
  top: number;
  left: number;
  caret: number;
  place: 'above' | 'below';
};

function getWebElement(ref: { current: View | null }): HTMLElement | null {
  const node = ref.current as unknown;
  if (node && typeof node === 'object' && 'getBoundingClientRect' in node) {
    return node as HTMLElement;
  }
  return null;
}

function clampTip(centerX: number, top: number, bottom: number, viewportW: number): TipPos {
  const place: TipPos['place'] = top > 96 ? 'above' : 'below';
  const half = TIP_WIDTH / 2;
  const left = Math.max(VIEW_PAD + half, Math.min(centerX, viewportW - VIEW_PAD - half));
  const caret = Math.max(14, Math.min(centerX - (left - half), TIP_WIDTH - 14));
  return {
    left,
    caret,
    place,
    top: place === 'above' ? top - TIP_GAP : bottom + TIP_GAP,
  };
}

export function RewardBadgeIcon({ type, size = 16, interactive = true }: Props) {
  const spec = REWARD_BADGES[type];
  const { colorScheme } = useThemePreference();
  const tone = rewardUiTone(spec, colorScheme === 'dark');
  const hostRef = useRef<View>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<'closed' | 'in' | 'out'>('closed');
  const [pos, setPos] = useState<TipPos | null>(null);
  const box = size + 10;

  useEffect(() => {
    ensureRewardsFxStyles();
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, []);

  const measure = useCallback(() => {
    const el = getWebElement(hostRef);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos(clampTip(rect.left + rect.width / 2, rect.top, rect.bottom, window.innerWidth));
      return;
    }
    hostRef.current?.measureInWindow((x, y, width, height) => {
      const viewportW =
        Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerWidth : x + width + 400;
      setPos(clampTip(x + width / 2, y, y + height, viewportW));
    });
  }, []);

  const show = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    measure();
    setPhase('in');
  }, [measure]);

  const hide = useCallback(() => {
    setPhase((current) => {
      if (current === 'closed') {
        return current;
      }
      return 'out';
    });
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    hideTimer.current = setTimeout(() => {
      setPhase('closed');
      setPos(null);
    }, 140);
  }, []);

  useEffect(() => {
    if (phase === 'closed') {
      return;
    }
    const onReposition = () => measure();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('scroll', onReposition, true);
      window.addEventListener('resize', onReposition);
      return () => {
        window.removeEventListener('scroll', onReposition, true);
        window.removeEventListener('resize', onReposition);
      };
    }
  }, [phase, measure]);

  const hoverHandlers =
    Platform.OS === 'web'
      ? {
          onHoverIn: show,
          onHoverOut: hide,
        }
      : {};

  const overlay =
    pos && phase !== 'closed'
      ? Platform.OS === 'web'
        ? portalToBody(
            <div
              className={`adv-tip ${pos.place === 'above' ? 'is-above' : 'is-below'}${phase === 'out' ? ' is-out' : ''}`}
              style={{
                top: pos.top,
                left: pos.left,
                ['--accent' as string]: spec.accent,
                ['--glow' as string]: spec.glow,
                ['--caret-x' as string]: `${pos.caret}px`,
              }}>
              <span className="adv-tip-caret" />
              <span className="adv-tip-title">{spec.label}</span>
              <span className="adv-tip-body">{spec.tooltip}</span>
            </div>,
          )
        : (
            <Modal visible transparent animationType="fade" statusBarTranslucent>
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View
                  style={[
                    styles.tooltip,
                    {
                      top: pos.top,
                      left: pos.left - TIP_WIDTH / 2,
                      borderColor: spec.accent,
                      transform: [{ translateY: pos.place === 'above' ? -8 : 0 }],
                    },
                  ]}>
                  <Text style={[styles.tooltipTitle, { color: spec.accent }]}>{spec.label}</Text>
                  <Text style={styles.tooltipBody}>{spec.tooltip}</Text>
                </View>
              </View>
            </Modal>
          )
      : null;

  const iconStyle = [
    styles.icon,
    {
      width: box,
      height: box,
      borderRadius: box / 2,
      backgroundColor: tone.bg,
      borderColor: tone.border,
    },
  ];

  if (!interactive) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        pointerEvents="none"
        style={styles.wrap}>
        <View style={iconStyle}>
          <Ionicons name={ICON_MAP[type]} size={size} color={tone.fg} />
        </View>
      </View>
    );
  }

  return (
    <View ref={hostRef} collapsable={false} style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spec.label}
        accessibilityHint={spec.tooltip}
        onPress={() => (phase === 'in' ? hide() : show())}
        {...hoverHandlers}
        style={iconStyle}>
        <Ionicons name={ICON_MAP[type]} size={size} color={tone.fg} />
      </Pressable>
      {overlay}
    </View>
  );
}

export function RewardBadgeRow({
  badges,
  size = 14,
  wrap = false,
  align = 'start',
}: {
  badges: RewardBadgeType[];
  size?: number;
  wrap?: boolean;
  align?: 'start' | 'center';
}) {
  const unique = useMemo(
    () => [...new Set(badges)].sort((a, b) => a.localeCompare(b)),
    [badges],
  );
  if (unique.length === 0) {
    return null;
  }
  return (
    <View
      style={[
        styles.row,
        wrap && styles.rowWrap,
        align === 'center' && styles.rowCenter,
      ]}>
      {unique.map((badge) => (
        <RewardBadgeIcon key={badge} type={badge} size={size} />
      ))}
    </View>
  );
}

export function NameWithBadges({
  name,
  badges,
  textStyle,
  suffix,
  badgeSize = 13,
  layout = 'inline',
  align = 'start',
}: {
  name: string;
  badges?: RewardBadgeType[] | null;
  textStyle?: object;
  suffix?: ReactNode;
  badgeSize?: number;
  layout?: 'inline' | 'stack';
  align?: 'start' | 'center';
}) {
  const row = (
    <RewardBadgeRow
      badges={badges ?? []}
      size={badgeSize}
      wrap={layout === 'stack'}
      align={layout === 'stack' || align === 'center' ? 'center' : 'start'}
    />
  );

  if (layout === 'stack') {
    return (
      <View style={[styles.nameStack, align === 'center' && styles.nameStackCenter]}>
        <Text style={[textStyle, styles.stackName]} numberOfLines={1}>
          {name}
        </Text>
        {row}
        {suffix}
      </View>
    );
  }

  const hasBadges = (badges?.length ?? 0) > 0;

  return (
    <View style={[styles.nameRow, align === 'center' && styles.nameRowCenter]}>
      <Text style={[textStyle, styles.inlineName]} numberOfLines={1}>
        {name}
      </Text>
      {hasBadges ? <View style={styles.nameBadgeDivider} /> : null}
      {row}
      {suffix}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    zIndex: 4,
  },
  rowWrap: {
    flexWrap: 'wrap',
    flexShrink: 1,
    maxWidth: '100%',
    rowGap: 4,
    columnGap: 4,
  },
  rowCenter: {
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flexShrink: 1,
    maxWidth: '100%',
  },
  nameRowCenter: {
    justifyContent: 'center',
  },
  nameBadgeDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    minHeight: 14,
    marginVertical: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.45)',
  },
  inlineName: {
    flexShrink: 1,
    minWidth: 0,
  },
  nameStack: {
    width: '100%',
    maxWidth: '100%',
    gap: 6,
    minWidth: 0,
  },
  nameStackCenter: {
    alignItems: 'center',
  },
  stackName: {
    width: '100%',
    textAlign: 'center',
  },
  tooltip: {
    position: Platform.OS === 'web' ? ('fixed' as const) : 'absolute',
    width: TIP_WIDTH,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(14, 16, 26, 0.94)',
    borderWidth: 1,
    gap: 4,
    zIndex: 100000,
    ...Platform.select({
      web: { boxShadow: '0 18px 40px rgba(6, 8, 16, 0.42)' } as object,
      default: { elevation: 12 },
    }),
  },
  tooltipTitle: {
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
  tooltipBody: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 17,
  },
});
