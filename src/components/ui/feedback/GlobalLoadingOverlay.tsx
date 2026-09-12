import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { LoadingOverlay } from '@/components/ui/feedback/LoadingOverlay';
import { subscribeLoading } from '@/services/api/loading-tracker';

export function GlobalLoadingOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeLoading(setVisible), []);

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
