import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { LoadingOverlay } from '@/components/ui/feedback/LoadingOverlay';
import { subscribeLoading } from '@/services/api/loading-tracker';

/** Ignore brief spikes so background/fast mutations don't flash the modal. */
const SHOW_AFTER_MS = 400;

export function GlobalLoadingOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = subscribeLoading((isLoading) => {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
      }

      if (!isLoading) {
        setVisible(false);
        return;
      }

      showTimer = setTimeout(() => {
        showTimer = null;
        setVisible(true);
      }, SHOW_AFTER_MS);
    });

    return () => {
      if (showTimer) {
        clearTimeout(showTimer);
      }
      unsubscribe();
    };
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.backdrop} />
        <View style={styles.content}>
          <LoadingOverlay label="Загрузка..." />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
