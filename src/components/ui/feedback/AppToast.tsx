import { useMemo } from 'react';
import Toast, { type ToastConfig } from 'react-native-toast-message';

import { ToastBanner } from '@/components/ui/feedback/ToastBanner';
import { NotificationToastListener } from '@/components/navigation/NotificationToastListener';

export function AppToast() {
  const config = useMemo<ToastConfig>(
    () => ({
      success: (props) => <ToastBanner {...props} variant="success" />,
      error: (props) => <ToastBanner {...props} variant="error" />,
      info: (props) => <ToastBanner {...props} variant="info" />,
      warning: (props) => <ToastBanner {...props} variant="warning" />,
    }),
    [],
  );

  return (
    <>
      <NotificationToastListener />
      <Toast
        config={config}
        topOffset={72}
        bottomOffset={40}
        // Library default wrapper is white — keep it transparent so our banner owns the fill.
        // High z-index: stack screens / questionnaire must not cover toasts on web.
        style={{
          backgroundColor: 'transparent',
          shadowOpacity: 0,
          zIndex: 100000,
          elevation: 100000,
        }}
      />
    </>
  );
}
