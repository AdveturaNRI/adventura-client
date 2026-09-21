import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FinalStepActions } from '@/components/questionnaire/FinalStepActions';
import { QuestionnaireHint } from '@/components/questionnaire/QuestionnaireHint';
import { QuestionnaireVisibilityNotice } from '@/components/questionnaire/QuestionnaireVisibilityNotice';
import { getCardFxOverhang } from '@/components/rewards/card-fx-layout';
import { UserCard } from '@/components/ui';
import type { UserCardDeckSize } from '@/components/ui/cards/UserCard';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useProfile } from '@/context/ProfileContext';
import { displayedAuraId } from '@/data/rewards/catalog';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  FINAL_STEP,
  QUESTIONNAIRE_DELETE_LABEL,
  QUESTIONNAIRE_EDIT_LABEL,
  QUESTIONNAIRE_FINISH_LABEL,
  QUESTIONNAIRE_SAVING_LABEL,
} from '@/screens/questionnaire/questionnaire.config';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import {
  DESKTOP_CONTENT_MAX_WIDTH,
  useQuestionnaireScreenStyles,
} from '@/screens/questionnaire/questionnaire-screen.styles';
import { getQuestionnaireCompletionFromDraft } from '@/utils/questionnaire-completion';
import { questionnaireDraftToUserCardProps } from '@/utils/questionnaire-draft-card';

const PREVIEW_DESKTOP_MAX_HEIGHT = 420;
const PREVIEW_DESKTOP_MIN_HEIGHT = 300;
const PREVIEW_MOBILE_MAX_HEIGHT = 520;
const PREVIEW_MOBILE_MIN_HEIGHT = 360;
const MOBILE_PHOTO_HEIGHT_RATIO = 0.54;
const MOBILE_PHOTO_MIN_HEIGHT = 148;
const MOBILE_PHOTO_ASPECT = 3 / 4;
const MOBILE_PHOTO_INSET = Spacing.md * 2;

function computeDesktopPreviewSize(maxWidth: number): UserCardDeckSize {
  const availableWidth = Math.max(320, maxWidth);
  let cardHeight = PREVIEW_DESKTOP_MAX_HEIGHT;
  let photoWidth = Math.round(cardHeight * (3 / 4));
  let bodyWidth = Math.round(photoWidth * 1.35);
  let cardWidth = photoWidth + bodyWidth;

  if (cardWidth > availableWidth) {
    const scale = availableWidth / cardWidth;
    cardHeight = Math.max(PREVIEW_DESKTOP_MIN_HEIGHT, Math.round(cardHeight * scale));
    photoWidth = Math.round(cardHeight * (3 / 4));
    bodyWidth = Math.max(160, availableWidth - photoWidth);
    cardWidth = photoWidth + bodyWidth;
  }

  return {
    width: cardWidth,
    height: cardHeight,
    photoWidth,
  };
}

function computeMobilePreviewSize(contentWidth: number): UserCardDeckSize {
  const cardWidth = Math.max(280, contentWidth);
  const cardHeight = Math.min(
    PREVIEW_MOBILE_MAX_HEIGHT,
    Math.max(PREVIEW_MOBILE_MIN_HEIGHT, Math.round(cardWidth * 1.45)),
  );
  const photoInnerWidth = cardWidth - MOBILE_PHOTO_INSET;
  let photoHeight = Math.round(photoInnerWidth / MOBILE_PHOTO_ASPECT);
  const maxPhotoHeight = Math.round(cardHeight * MOBILE_PHOTO_HEIGHT_RATIO);
  photoHeight = Math.max(MOBILE_PHOTO_MIN_HEIGHT, Math.min(photoHeight, maxPhotoHeight));

  return {
    width: cardWidth,
    height: cardHeight,
    photoWidth: photoInnerWidth,
    photoHeight,
  };
}

type FinalStepProps = {
  draft: QuestionnaireDraft;
  isSaving?: boolean;
  onContinue: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function createStyles(
  colors: ThemeColors,
  isDesktopWeb: boolean,
  overhang: { top: number; bottom: number; left: number; right: number },
) {
  const sidePad = Math.max(overhang.left, overhang.right);
  return StyleSheet.create({
    previewWrap: {
      alignItems: 'center',
      width: '100%',
      overflow: 'visible',
      paddingTop: overhang.top,
      paddingHorizontal: sidePad,
    },
    previewCard: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX_WIDTH : undefined,
      overflow: 'visible',
      marginBottom: overhang.bottom,
    },
    previewCaption: {
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
      textAlign: 'center',
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
  });
}

export function FinalStep({
  draft,
  isSaving = false,
  onContinue,
  onEdit,
  onDelete,
}: FinalStepProps) {
  const isDesktopWeb = useIsDesktopWeb();
  const { width: windowWidth } = useWindowDimensions();
  const { profile } = useProfile();
  const screenStyles = useQuestionnaireScreenStyles();
  const auraId = displayedAuraId(
    profile?.perks?.visibleBadges ?? profile?.perks?.badges ?? [],
    profile?.perks?.questionnaireAuraId,
  );
  // UserCard wraps with overlay={false} → wide FX (mugs / dragon peek).
  const overhang = getCardFxOverhang(auraId, true);
  const styles = useThemedStyles((colors) => createStyles(colors, isDesktopWeb, overhang));
  const cardProps = useMemo(
    () =>
      questionnaireDraftToUserCardProps(draft, {
        auraId: profile?.perks?.questionnaireAuraId,
        badges: profile?.perks?.visibleBadges ?? profile?.perks?.badges,
      }),
    [draft, profile?.perks],
  );
  const completion = useMemo(() => getQuestionnaireCompletionFromDraft(draft), [draft]);
  const showEdit = completion.isComplete;

  const deckSize = useMemo(() => {
    if (isDesktopWeb) {
      const contentWidth = Math.min(DESKTOP_CONTENT_MAX_WIDTH, windowWidth - Spacing.lg * 2);
      return computeDesktopPreviewSize(contentWidth);
    }

    const contentWidth = Math.max(280, windowWidth - Spacing.lg * 2);
    return computeMobilePreviewSize(contentWidth);
  }, [isDesktopWeb, windowWidth]);

  const cardLayout = isDesktopWeb ? 'deckWide' : 'deck';

  return (
    <View style={screenStyles.stepBody}>
      <View>
        <Text style={screenStyles.title}>{FINAL_STEP.title}</Text>
        <Text style={screenStyles.subtitle}>{FINAL_STEP.subtitle}</Text>
      </View>

      <QuestionnaireHint>{FINAL_STEP.hint}</QuestionnaireHint>

      <QuestionnaireVisibilityNotice completion={completion} />

      <View style={styles.previewWrap}>
        <View
          style={[
            styles.previewCard,
            {
              width: deckSize.width,
              height: deckSize.height,
              minHeight: deckSize.height,
              maxWidth: deckSize.width,
            },
          ]}>
          <UserCard
            key={cardProps.avatarUrl ?? 'no-photo'}
            {...cardProps}
            layout={cardLayout}
            deckSize={deckSize}
            size="compact"
          />
        </View>
        <Text style={styles.previewCaption}>{FINAL_STEP.previewCaption}</Text>
      </View>

      <FinalStepActions
        continueLabel={QUESTIONNAIRE_FINISH_LABEL}
        editLabel={QUESTIONNAIRE_EDIT_LABEL}
        deleteLabel={QUESTIONNAIRE_DELETE_LABEL}
        savingLabel={QUESTIONNAIRE_SAVING_LABEL}
        isSaving={isSaving}
        showEdit={showEdit}
        onContinue={onContinue}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </View>
  );
}
