import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { StyleSheet, Text, View, type ScrollView } from 'react-native';

import { QuestionnaireChoiceChip } from '@/components/questionnaire/QuestionnaireChoiceChip';
import { QuestionnaireHint } from '@/components/questionnaire/QuestionnaireHint';
import { QuestionnaireOption } from '@/components/questionnaire/QuestionnaireOption';
import {
  QUESTIONNAIRE_PANEL_ERROR_STYLE,
  QuestionnaireRequiredCallout,
} from '@/components/questionnaire/QuestionnaireRequiredCallout';
import { SessionPriceField } from '@/components/questionnaire/SessionPriceField';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { ROLES_STEP } from '@/screens/questionnaire/questionnaire.config';
import type { PlayerRoleChoice, QuestionnaireDraft } from '@/screens/questionnaire/types';
import { useQuestionnaireScreenStyles } from '@/screens/questionnaire/questionnaire-screen.styles';
import { useQuestionnaireFieldFocus } from '@/hooks/use-questionnaire-field-focus';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  isPlayerBudgetValid,
  isSessionPriceValid,
  type GameCostFormat,
  type PlayerPaymentFormat,
} from '@/utils/questionnaire-payment';
import { scheduleScrollAttempts, scrollScrollViewToChild } from '@/utils/scroll-scrollview-to-child';

type RolesStepValue = Pick<
  QuestionnaireDraft,
  | 'role'
  | 'gameCostFormat'
  | 'sessionPriceKind'
  | 'sessionPriceMin'
  | 'sessionPriceMax'
  | 'playerPaymentFormat'
  | 'playerBudgetKind'
  | 'playerBudgetMin'
  | 'playerBudgetMax'
>;

export type RolesFocusSection = 'roles' | 'gameCost' | 'playerPayment';

type RolesStepProps = {
  value: RolesStepValue;
  onChange: (value: RolesStepValue) => void;
  showValidationError?: boolean;
  validationScrollKey?: number;
  focusSection?: RolesFocusSection | null;
  scrollRef?: RefObject<ScrollView | null>;
  onFocusScrollComplete?: () => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    panel: {
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    panelError: {
      ...QUESTIONNAIRE_PANEL_ERROR_STYLE,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
  });
}

export function RolesStep({
  value,
  onChange,
  showValidationError = false,
  validationScrollKey = 0,
  focusSection = null,
  scrollRef,
  onFocusScrollComplete,
}: RolesStepProps) {
  const styles = useQuestionnaireScreenStyles();
  const localStyles = useThemedStyles(createStyles);
  const rolesRef = useRef<View>(null);
  const gameCostRef = useRef<View>(null);
  const playerPaymentRef = useRef<View>(null);
  const pendingRoleScrollRef = useRef(false);
  const pendingSessionPriceScrollRef = useRef(false);
  const pendingPlayerPaymentScrollRef = useRef(false);
  const pendingPlayerBudgetScrollRef = useRef(false);
  const sessionPriceRef = useRef<View>(null);
  const playerBudgetRef = useRef<View>(null);
  const showMasterCost = value.role === 'master' || value.role === 'both';
  const showPlayerPayment = value.role === 'player' || value.role === 'both';
  const showSessionPrice =
    showMasterCost && (value.gameCostFormat === 'paid' || value.gameCostFormat === 'both');
  const showPlayerBudget =
    showPlayerPayment && value.playerPaymentFormat === 'free_and_paid';
  const gameCostMissing = showMasterCost && value.gameCostFormat == null;
  const playerPaymentMissing = showPlayerPayment && value.playerPaymentFormat == null;
  const sessionPriceInvalid = showSessionPrice && !isSessionPriceValid(value);
  const playerBudgetInvalid = showPlayerBudget && !isPlayerBudgetValid(value);
  const roleMissing = value.role == null;

  const patch = (next: Partial<RolesStepValue>) => {
    onChange({ ...value, ...next });
  };

  const scrollToView = useCallback(
    (target: View | null) => {
      if (!scrollRef?.current || !target) {
        return false;
      }

      return scrollScrollViewToChild(scrollRef.current, target, 20);
    },
    [scrollRef],
  );

  const handleRoleChange = (role: PlayerRoleChoice) => {
    pendingRoleScrollRef.current = true;
    patch({ role });
  };

  const handleGameCostChange = (format: GameCostFormat) => {
    if (format === 'free') {
      if (value.role === 'both') {
        pendingPlayerPaymentScrollRef.current = true;
      }
      patch({
        gameCostFormat: format,
        sessionPriceKind: null,
        sessionPriceMin: '',
        sessionPriceMax: '',
      });
      return;
    }

    if (format === 'paid' || format === 'both') {
      pendingSessionPriceScrollRef.current = true;
    }

    patch({ gameCostFormat: format });
  };

  const handlePlayerPaymentChange = (format: PlayerPaymentFormat) => {
    if (format === 'free_only') {
      patch({
        playerPaymentFormat: format,
        playerBudgetKind: null,
        playerBudgetMin: '',
        playerBudgetMax: '',
      });
      return;
    }

    pendingPlayerBudgetScrollRef.current = true;
    patch({
      playerPaymentFormat: format,
      playerBudgetKind: value.playerBudgetKind ?? 'fixed',
    });
  };

  useQuestionnaireFieldFocus({
    active:
      Boolean(focusSection) &&
      !(focusSection === 'gameCost' && !showMasterCost) &&
      !(focusSection === 'playerPayment' && !showPlayerPayment),
    scroll: () => {
      const target =
        focusSection === 'gameCost'
          ? gameCostRef.current
          : focusSection === 'playerPayment'
            ? playerPaymentRef.current
            : rolesRef.current;

      if (!target || !scrollRef?.current) {
        return false;
      }

      return scrollScrollViewToChild(scrollRef.current, target, 20, true);
    },
    onComplete: onFocusScrollComplete,
  });

  useEffect(() => {
    if (!showValidationError || validationScrollKey <= 0) {
      return;
    }

    return scheduleScrollAttempts(() => {
      if (value.role == null) {
        return scrollToView(rolesRef.current);
      }

      if (gameCostMissing) {
        return scrollToView(gameCostRef.current);
      }

      if (playerPaymentMissing) {
        return scrollToView(playerPaymentRef.current);
      }

      if (sessionPriceInvalid) {
        return scrollToView(sessionPriceRef.current);
      }

      if (playerBudgetInvalid) {
        return scrollToView(playerBudgetRef.current);
      }

      return false;
    });
  }, [
    gameCostMissing,
    playerBudgetInvalid,
    playerPaymentMissing,
    scrollToView,
    sessionPriceInvalid,
    showValidationError,
    validationScrollKey,
    value.role,
  ]);

  useEffect(() => {
    if (!pendingRoleScrollRef.current) {
      return;
    }

    if (!showMasterCost && !showPlayerPayment) {
      return;
    }

    return scheduleScrollAttempts(() => {
      if (!pendingRoleScrollRef.current) {
        return true;
      }

      const target = showMasterCost
        ? gameCostRef.current
        : playerPaymentRef.current;

      if (!target || !scrollToView(target)) {
        return false;
      }

      pendingRoleScrollRef.current = false;
      return true;
    });
  }, [showMasterCost, showPlayerPayment, scrollToView, value.role]);

  useEffect(() => {
    if (!pendingSessionPriceScrollRef.current || !showSessionPrice) {
      return;
    }

    return scheduleScrollAttempts(() => {
      if (!pendingSessionPriceScrollRef.current) {
        return true;
      }

      const target = sessionPriceRef.current;
      if (!target || !scrollToView(target)) {
        return false;
      }

      pendingSessionPriceScrollRef.current = false;
      return true;
    });
  }, [showSessionPrice, scrollToView, value.gameCostFormat]);

  useEffect(() => {
    if (!pendingPlayerPaymentScrollRef.current || !showPlayerPayment) {
      return;
    }

    return scheduleScrollAttempts(() => {
      if (!pendingPlayerPaymentScrollRef.current) {
        return true;
      }

      const target = playerPaymentRef.current;
      if (!target || !scrollToView(target)) {
        return false;
      }

      pendingPlayerPaymentScrollRef.current = false;
      return true;
    });
  }, [showPlayerPayment, scrollToView, value.gameCostFormat]);

  useEffect(() => {
    if (!pendingPlayerBudgetScrollRef.current || !showPlayerBudget) {
      return;
    }

    return scheduleScrollAttempts(() => {
      if (!pendingPlayerBudgetScrollRef.current) {
        return true;
      }

      const target = playerBudgetRef.current;
      if (!target || !scrollToView(target)) {
        return false;
      }

      pendingPlayerBudgetScrollRef.current = false;
      return true;
    });
  }, [showPlayerBudget, scrollToView, value.playerPaymentFormat]);

  return (
    <View style={styles.stepBody}>
      <View>
        <Text style={styles.title}>{ROLES_STEP.title}</Text>
        <Text style={styles.subtitle}>{ROLES_STEP.subtitle}</Text>
      </View>

      <QuestionnaireHint>{ROLES_STEP.hint}</QuestionnaireHint>

      <View
        ref={rolesRef}
        collapsable={false}
        style={[
          localStyles.panel,
          showValidationError && roleMissing ? localStyles.panelError : null,
        ]}>
        {showValidationError && roleMissing ? (
          <QuestionnaireRequiredCallout message="Выберите роль" />
        ) : null}
        <View style={styles.options}>
          {ROLES_STEP.options.map((option) => (
            <QuestionnaireOption
              key={option.key}
              label={option.label}
              description={option.description}
              icon={option.icon}
              selected={value.role === option.key}
              onPress={() => handleRoleChange(option.key)}
            />
          ))}
        </View>
      </View>

      {showMasterCost ? (
        <View
          ref={gameCostRef}
          collapsable={false}
          style={[
            localStyles.panel,
            showValidationError && gameCostMissing ? localStyles.panelError : null,
          ]}>
          {showValidationError && gameCostMissing ? (
            <QuestionnaireRequiredCallout />
          ) : null}
          <Text style={localStyles.title}>{ROLES_STEP.masterCostTitle}</Text>
          <View style={localStyles.chips}>
            {ROLES_STEP.masterCostOptions.map((option) => (
              <QuestionnaireChoiceChip
                key={option.key}
                label={option.label}
                icon={option.icon}
                selected={value.gameCostFormat === option.key}
                onPress={() => handleGameCostChange(option.key)}
              />
            ))}
          </View>
          {showSessionPrice ? (
            <View ref={sessionPriceRef} collapsable={false}>
              <SessionPriceField
                kind={value.sessionPriceKind}
                min={value.sessionPriceMin}
                max={value.sessionPriceMax}
                onChange={(price) =>
                  patch({
                    sessionPriceKind: price.kind,
                    sessionPriceMin: price.min,
                    sessionPriceMax: price.max,
                  })
                }
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {showPlayerPayment ? (
        <View
          ref={playerPaymentRef}
          collapsable={false}
          style={[
            localStyles.panel,
            showValidationError && (playerPaymentMissing || playerBudgetInvalid)
              ? localStyles.panelError
              : null,
          ]}>
          {showValidationError && playerPaymentMissing ? (
            <QuestionnaireRequiredCallout />
          ) : null}
          <Text style={localStyles.title}>{ROLES_STEP.playerPaymentTitle}</Text>
          <View style={localStyles.chips}>
            {ROLES_STEP.playerPaymentOptions.map((option) => (
              <QuestionnaireChoiceChip
                key={option.key}
                label={option.label}
                icon={option.icon}
                selected={value.playerPaymentFormat === option.key}
                onPress={() => handlePlayerPaymentChange(option.key)}
              />
            ))}
          </View>
          {showPlayerBudget ? (
            <View ref={playerBudgetRef} collapsable={false}>
              <SessionPriceField
                kind={value.playerBudgetKind}
                min={value.playerBudgetMin}
                max={value.playerBudgetMax}
                title={ROLES_STEP.playerBudgetTitle}
                hint=""
                required
                showRequiredError={showValidationError && playerBudgetInvalid}
                requiredMessage="Укажите комфортную сумму за игру"
                onChange={(price) =>
                  patch({
                    playerBudgetKind: price.kind,
                    playerBudgetMin: price.min,
                    playerBudgetMax: price.max,
                  })
                }
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
