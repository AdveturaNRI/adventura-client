import { Text, View } from 'react-native';

import { QuestionnaireHint } from '@/components/questionnaire/QuestionnaireHint';
import { QuestionnaireOption } from '@/components/questionnaire/QuestionnaireOption';
import { ROLES_STEP } from '@/screens/questionnaire/questionnaire.config';
import type { PlayerRoleChoice } from '@/screens/questionnaire/types';
import { useQuestionnaireScreenStyles } from '@/screens/questionnaire/questionnaire-screen.styles';

type RolesStepProps = {
  value: PlayerRoleChoice | null;
  onChange: (value: PlayerRoleChoice) => void;
};

export function RolesStep({ value, onChange }: RolesStepProps) {
  const styles = useQuestionnaireScreenStyles();

  return (
    <View style={styles.stepBody}>
      <View>
        <Text style={styles.title}>{ROLES_STEP.title}</Text>
        <Text style={styles.subtitle}>{ROLES_STEP.subtitle}</Text>
      </View>

      <QuestionnaireHint>{ROLES_STEP.hint}</QuestionnaireHint>

      <View style={styles.options}>
        {ROLES_STEP.options.map((option) => (
          <QuestionnaireOption
            key={option.key}
            label={option.label}
            description={option.description}
            icon={option.icon}
            selected={value === option.key}
            onPress={() => onChange(option.key)}
          />
        ))}
      </View>
    </View>
  );
}
