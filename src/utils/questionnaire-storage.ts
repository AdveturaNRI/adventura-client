import AsyncStorage from '@react-native-async-storage/async-storage';

import type { QuestionnaireDraft } from '@/screens/questionnaire/types';

const QUESTIONNAIRE_DRAFT_KEY_PREFIX = '@adventura/questionnaire-draft';

export type StoredQuestionnaire = {
  draft: QuestionnaireDraft;
  stepIndex: number;
  updatedAt: string;
};

function getStorageKey(userId: string) {
  return `${QUESTIONNAIRE_DRAFT_KEY_PREFIX}:${userId}`;
}

export async function loadQuestionnaireDraft(
  userId: string,
): Promise<StoredQuestionnaire | null> {
  const raw = await AsyncStorage.getItem(getStorageKey(userId));
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as StoredQuestionnaire;
}

export async function saveQuestionnaireDraft(
  userId: string,
  draft: QuestionnaireDraft,
  stepIndex: number,
): Promise<StoredQuestionnaire> {
  const stored: StoredQuestionnaire = {
    draft,
    stepIndex,
    updatedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(stored));
  return stored;
}

export async function clearQuestionnaireDraft(userId: string): Promise<void> {
  await AsyncStorage.removeItem(getStorageKey(userId));
}
