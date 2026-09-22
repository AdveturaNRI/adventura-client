import Toast from 'react-native-toast-message';
const DEFAULT_TITLES = {
    success: 'Готово',
    error: 'Ошибка',
    info: 'Информация',
    warning: 'Внимание',
};
function showToast(variant, options) {
    const hasCustomTitle = Boolean(options.title?.trim());
    const title = hasCustomTitle
        ? options.title
        : options.message?.trim()
            ? options.message
            : DEFAULT_TITLES[variant];
    const message = hasCustomTitle ? options.message : undefined;
    Toast.show({
        type: variant,
        text1: title,
        text2: message,
        position: options.position ?? 'top',
        visibilityTime: options.duration ?? 3500,
        props: {
            alignment: options.alignment ?? 'center',
            actionLabel: options.actionLabel,
            onAction: options.onAction,
            emphasis: options.emphasis ?? 'default',
            avatarUrl: options.avatarUrl ?? null,
            avatarName: options.avatarName ?? null,
        },
    });
}
export const toast = {
    success(message, options) {
        showToast('success', { message, ...options });
    },
    error(message, options) {
        showToast('error', { message, ...options });
    },
    info(message, options) {
        showToast('info', { message, ...options });
    },
    warning(message, options) {
        showToast('warning', { message, ...options });
    },
    hide() {
        Toast.hide();
    },
};
