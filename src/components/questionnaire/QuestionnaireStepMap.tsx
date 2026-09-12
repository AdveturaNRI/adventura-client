import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { QuestionnaireMapNode } from '@/screens/questionnaire/questionnaire-step-summary';

type MapVariant = 'inline' | 'sidebar';

function createVerticalStyles(colors: ThemeColors, mapWidth: number, variant: MapVariant) {
  return StyleSheet.create({
    container: {
      width: mapWidth,
      flexShrink: 0,
      paddingVertical: Spacing.xs,
      paddingRight: variant === 'inline' ? Spacing.sm : 0,
      borderRightWidth: variant === 'inline' ? 1 : 0,
      borderRightColor: colors.borderLight,
    },
    title: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      color: colors.textSubtle,
      marginBottom: Spacing.sm,
    },
    nodes: {
      gap: 0,
    },
    nodeRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    nodeRowPressable: {
      borderRadius: 8,
      marginLeft: -Spacing.xs,
      paddingLeft: Spacing.xs,
      marginRight: -Spacing.xs,
      paddingRight: Spacing.xs,
      cursor: 'pointer',
    },
    nodeRowPressed: {
      opacity: 0.75,
      backgroundColor: colors.surfaceMuted,
    },
    rail: {
      width: 18,
      alignItems: 'center',
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dotCompleted: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    dotCurrent: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      transform: [{ scale: 1.15 }],
    },
    connector: {
      width: 2,
      flex: 1,
      minHeight: 12,
      backgroundColor: colors.borderLight,
      marginVertical: 2,
    },
    connectorCompleted: {
      backgroundColor: colors.primary,
    },
    content: {
      flex: 1,
      paddingBottom: Spacing.md,
      gap: 2,
    },
    nodeTitle: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
    },
    nodeTitleCurrent: {
      color: colors.primary,
    },
    nodeTitleUpcoming: {
      color: colors.textSubtle,
    },
    line: {
      fontSize: 11,
      color: colors.text,
      lineHeight: 15,
    },
    lineMuted: {
      color: colors.textMuted,
      fontStyle: 'italic',
    },
  });
}

function getHorizontalTrackInsetPercent(nodeCount: number): number {
  return 100 / (nodeCount * 2);
}

function getHorizontalProgressWidthPercent(nodeCount: number, currentIndex: number): number {
  if (nodeCount <= 1 || currentIndex <= 0) {
    return 0;
  }

  return (currentIndex / nodeCount) * 100;
}

function createHorizontalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignSelf: 'stretch',
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      marginBottom: Spacing.sm,
      gap: Spacing.xs,
    },
    railArea: {
      position: 'relative',
      height: 14,
      justifyContent: 'center',
      width: '100%',
    },
    trackBase: {
      position: 'absolute',
      top: 6,
      height: 2,
      backgroundColor: colors.borderLight,
    },
    trackProgress: {
      position: 'absolute',
      top: 6,
      height: 2,
      backgroundColor: colors.primary,
    },
    dotsRow: {
      flexDirection: 'row',
      width: '100%',
    },
    dotSlot: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    labelsRow: {
      flexDirection: 'row',
      width: '100%',
      alignItems: 'flex-start',
    },
    labelSlot: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingHorizontal: 1,
    },
    labelPressable: {
      borderRadius: 8,
      paddingVertical: 2,
      paddingHorizontal: 1,
      width: '100%',
      alignItems: 'center',
      cursor: 'pointer',
    },
    labelPressed: {
      opacity: 0.75,
      backgroundColor: colors.surfaceMuted,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dotCompleted: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    dotCurrent: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    nodeTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 14,
      width: '100%',
    },
    nodeTitleCurrent: {
      color: colors.primary,
    },
    nodeTitleUpcoming: {
      color: colors.textSubtle,
    },
  });
}

type QuestionnaireStepMapProps = {
  nodes: QuestionnaireMapNode[];
  variant?: MapVariant;
  disabled?: boolean;
  maxNavigableStepIndex?: number;
  onStepPress?: (stepIndex: number) => void;
};

function isStepNavigable(
  node: QuestionnaireMapNode,
  maxNavigableStepIndex: number,
  disabled: boolean,
  onStepPress?: (stepIndex: number) => void,
): boolean {
  return (
    node.status !== 'current' &&
    node.index <= maxNavigableStepIndex &&
    !disabled &&
    Boolean(onStepPress)
  );
}

export function QuestionnaireStepMap({
  nodes,
  variant = 'inline',
  disabled = false,
  maxNavigableStepIndex = Number.POSITIVE_INFINITY,
  onStepPress,
}: QuestionnaireStepMapProps) {
  const isDesktopWeb = useIsDesktopWeb();
  const isHorizontal = variant === 'inline' && !isDesktopWeb;
  const mapWidth = variant === 'sidebar' ? 200 : isDesktopWeb ? 168 : undefined;

  const verticalStyles = useThemedStyles((colors) =>
    createVerticalStyles(colors, mapWidth ?? 112, variant),
  );
  const horizontalStyles = useThemedStyles(createHorizontalStyles);

  if (nodes.length === 0) {
    return null;
  }

  if (isHorizontal) {
    const trackInset = getHorizontalTrackInsetPercent(nodes.length);
    const currentIndex = nodes.findIndex((node) => node.status === 'current');
    const progressWidth = getHorizontalProgressWidthPercent(nodes.length, currentIndex);

    return (
      <View
        style={horizontalStyles.container}
        accessibilityRole="summary"
        accessibilityLabel="Карта шагов анкеты">
        <View style={horizontalStyles.railArea}>
          <View
            style={[
              horizontalStyles.trackBase,
              {
                left: `${trackInset}%`,
                right: `${trackInset}%`,
              },
            ]}
          />
          {progressWidth > 0 ? (
            <View
              style={[
                horizontalStyles.trackProgress,
                {
                  left: `${trackInset}%`,
                  width: `${progressWidth}%`,
                },
              ]}
            />
          ) : null}
          <View style={horizontalStyles.dotsRow}>
            {nodes.map((node) => {
              const isCompleted = node.status === 'completed';
              const isCurrent = node.status === 'current';
              const isNavigable = isStepNavigable(
                node,
                maxNavigableStepIndex,
                disabled,
                onStepPress,
              );

              const dot = (
                <View
                  style={[
                    horizontalStyles.dot,
                    isCompleted && horizontalStyles.dotCompleted,
                    isCurrent && horizontalStyles.dotCurrent,
                  ]}
                />
              );

              if (isNavigable) {
                return (
                  <Pressable
                    key={node.index}
                    accessibilityRole="button"
                    accessibilityLabel={`Перейти к шагу «${node.title}»`}
                    onPress={() => onStepPress?.(node.index)}
                    style={horizontalStyles.dotSlot}>
                    {dot}
                  </Pressable>
                );
              }

              return (
                <View key={node.index} style={horizontalStyles.dotSlot}>
                  {dot}
                </View>
              );
            })}
          </View>
        </View>

        <View style={horizontalStyles.labelsRow}>
          {nodes.map((node) => {
            const isCurrent = node.status === 'current';
            const isNavigable = isStepNavigable(
              node,
              maxNavigableStepIndex,
              disabled,
              onStepPress,
            );

            const label = (
              <Text
                style={[
                  horizontalStyles.nodeTitle,
                  isCurrent && horizontalStyles.nodeTitleCurrent,
                  node.status === 'upcoming' && horizontalStyles.nodeTitleUpcoming,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}>
                {node.title}
              </Text>
            );

            if (isNavigable) {
              return (
                <View key={node.index} style={horizontalStyles.labelSlot}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Перейти к шагу «${node.title}»`}
                    onPress={() => onStepPress?.(node.index)}
                    style={({ pressed }) => [
                      horizontalStyles.labelPressable,
                      pressed && horizontalStyles.labelPressed,
                    ]}>
                    {label}
                  </Pressable>
                </View>
              );
            }

            return (
              <View key={node.index} style={horizontalStyles.labelSlot}>
                {label}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  const styles = verticalStyles;

  return (
    <View style={styles.container} accessibilityRole="summary" accessibilityLabel="Карта шагов анкеты">
      <Text style={styles.title}>Карта</Text>
      <View style={styles.nodes}>
        {nodes.map((node, nodeIndex) => {
          const isLast = nodeIndex === nodes.length - 1;
          const isCompleted = node.status === 'completed';
          const isCurrent = node.status === 'current';
          const isNavigable = isStepNavigable(node, maxNavigableStepIndex, disabled, onStepPress);

          const nodeContent = (
            <>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.dot,
                    isCompleted && styles.dotCompleted,
                    isCurrent && styles.dotCurrent,
                  ]}
                />
                {!isLast ? (
                  <View style={[styles.connector, isCompleted && styles.connectorCompleted]} />
                ) : null}
              </View>

              <View style={styles.content}>
                <Text
                  style={[
                    styles.nodeTitle,
                    isCurrent && styles.nodeTitleCurrent,
                    node.status === 'upcoming' && styles.nodeTitleUpcoming,
                  ]}
                  numberOfLines={1}>
                  {node.title}
                </Text>
                {node.lines.map((line) => (
                  <Text
                    key={`${node.index}-${line}`}
                    style={[styles.line, line === 'Пока пусто' && styles.lineMuted]}
                    numberOfLines={2}>
                    {line}
                  </Text>
                ))}
              </View>
            </>
          );

          if (isNavigable) {
            return (
              <Pressable
                key={node.index}
                accessibilityRole="button"
                accessibilityLabel={`Перейти к шагу «${node.title}»`}
                onPress={() => onStepPress?.(node.index)}
                style={({ pressed }) => [
                  styles.nodeRow,
                  styles.nodeRowPressable,
                  pressed && styles.nodeRowPressed,
                ]}>
                {nodeContent}
              </Pressable>
            );
          }

          return (
            <View key={node.index} style={styles.nodeRow}>
              {nodeContent}
            </View>
          );
        })}
      </View>
    </View>
  );
}
