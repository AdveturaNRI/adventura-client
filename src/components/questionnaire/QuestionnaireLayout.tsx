import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { QuestionnaireStepMap } from '@/components/questionnaire/QuestionnaireStepMap';
import { Button } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import type { QuestionnaireMapNode } from '@/screens/questionnaire/questionnaire-step-summary';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: Spacing.lg,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    mapBleed: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      alignSelf: 'stretch',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    backButtonPressed: {
      opacity: 0.85,
    },
    stepMeta: {
      flex: 1,
      alignItems: 'flex-end',
      gap: Spacing.xs,
    },
    stepLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
    },
    progressTrack: {
      width: '100%',
      maxWidth: 160,
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.borderLight,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    body: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
    },
    bodyStacked: {
      flexDirection: 'column',
      gap: 0,
    },
    main: {
      flex: 1,
      minWidth: 0,
      gap: Spacing.lg,
    },
    footer: {
      gap: Spacing.sm,
    },
  });
}

type QuestionnaireFooterActionsProps = {
  continueLabel: string;
  saveExitLabel: string;
  savingLabel: string;
  isSaving?: boolean;
  canSave?: boolean;
  onContinue: () => void;
  onSaveExit: () => void;
};

export function QuestionnaireFooterActions({
  continueLabel,
  saveExitLabel,
  savingLabel,
  isSaving = false,
  canSave = true,
  onContinue,
  onSaveExit,
}: QuestionnaireFooterActionsProps) {
  const styles = useThemedStyles(createStyles);
  const footerDisabled = isSaving || !canSave;

  return (
    <View style={styles.footer}>
      <Button
        label={isSaving ? savingLabel : continueLabel}
        onPress={footerDisabled ? undefined : onContinue}
        style={footerDisabled ? { opacity: 0.45 } : undefined}
      />
      <Button
        label={isSaving ? savingLabel : saveExitLabel}
        variant="outline"
        onPress={footerDisabled ? undefined : onSaveExit}
        style={footerDisabled ? { opacity: 0.45 } : undefined}
      />
    </View>
  );
}

type QuestionnaireLayoutProps = {
  stepIndex: number;
  totalSteps: number;
  continueLabel: string;
  saveExitLabel: string;
  savingLabel: string;
  isSaving?: boolean;
  canSave?: boolean;
  stepMap?: QuestionnaireMapNode[];
  renderStepMap?: boolean;
  maxNavigableStepIndex?: number;
  onBack: () => void;
  onStepPress?: (stepIndex: number) => void;
  onContinue: () => void;
  onSaveExit: () => void;
  showFooter?: boolean;
  children: ReactNode;
};

export function QuestionnaireLayout({
  stepIndex,
  totalSteps,
  continueLabel,
  saveExitLabel,
  savingLabel,
  isSaving = false,
  canSave = true,
  stepMap = [],
  renderStepMap = true,
  maxNavigableStepIndex,
  onBack,
  onStepPress,
  onContinue,
  onSaveExit,
  showFooter = true,
  children,
}: QuestionnaireLayoutProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles(createStyles);
  const progress = ((stepIndex + 1) / totalSteps) * 100;
  const showMap = renderStepMap && stepMap.length > 0;
  const mapElement = showMap ? (
    <QuestionnaireStepMap
      nodes={stepMap}
      disabled={isSaving}
      maxNavigableStepIndex={maxNavigableStepIndex}
      onStepPress={onStepPress}
    />
  ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.stepMeta}>
          <Text style={styles.stepLabel}>
            Шаг {stepIndex + 1} из {totalSteps}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>

      {!isDesktopWeb && mapElement ? <View style={styles.mapBleed}>{mapElement}</View> : null}

      <View style={[styles.body, !isDesktopWeb && styles.bodyStacked]}>
        {isDesktopWeb ? mapElement : null}

        <View style={styles.main}>
          {children}

          {showFooter ? (
            <QuestionnaireFooterActions
              continueLabel={continueLabel}
              saveExitLabel={saveExitLabel}
              savingLabel={savingLabel}
              isSaving={isSaving}
              canSave={canSave}
              onContinue={onContinue}
              onSaveExit={onSaveExit}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
