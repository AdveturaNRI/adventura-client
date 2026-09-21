export function getToastSpecs(colors) {
    return [
        {
            variant: 'success',
            label: 'Успех',
            description: 'Подтверждение действия или успешный результат',
            icon: 'checkmark-circle',
            accentColor: colors.success,
        },
        {
            variant: 'error',
            label: 'Ошибка',
            description: 'Сбой операции или валидации',
            icon: 'close-circle',
            accentColor: colors.destructive,
        },
        {
            variant: 'info',
            label: 'Информация',
            description: 'Нейтральное уведомление',
            icon: 'information-circle',
            accentColor: colors.primary,
        },
        {
            variant: 'warning',
            label: 'Внимание',
            description: 'Предупреждение, требующее внимания',
            icon: 'warning',
            accentColor: '#FF9F0A',
        },
    ];
}
