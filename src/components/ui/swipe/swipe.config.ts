import { type ThemeColors } from '@/constants/theme';

export type SwipeDirection = 'left' | 'right';

export type SwipeBlockSpec = {
  direction: SwipeDirection;
  gesture: string;
  reveals: string;
  defaultColor: string;
  exampleLabel: string;
};

export function getSwipeSpecs(colors: ThemeColors): SwipeBlockSpec[] {
  return [
    {
      direction: 'right',
      gesture: 'свайп вправо',
      reveals: 'левое действие',
      defaultColor: colors.primary,
      exampleLabel: 'Закрепить',
    },
    {
      direction: 'left',
      gesture: 'свайп влево',
      reveals: 'правое действие',
      defaultColor: colors.destructive,
      exampleLabel: 'Удалить',
    },
  ];
}
