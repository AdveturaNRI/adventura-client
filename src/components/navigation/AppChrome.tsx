import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { MainDesktopHeader } from '@/components/navigation/MainDesktopHeader';
import { MainDesktopSidebar } from '@/components/navigation/MainDesktopSidebar';
import { MobileAppMenuProvider } from '@/components/navigation/MobileAppMenuContext';

/** Desktop sidebar + header and the mobile menu; screens render their own mobile header. */
export function AppChrome({ children }: { children: ReactNode }) {
  const isDesktopWeb = useIsDesktopWeb();
  const showSidebar = useIsDesktopSidebarVisible();

  return (
    <MobileAppMenuProvider>
      <View style={styles.root}>
        <View style={showSidebar ? styles.desktopShell : styles.root}>
          {showSidebar ? <MainDesktopSidebar /> : null}
          <View style={styles.root}>
            {isDesktopWeb ? <MainDesktopHeader /> : null}
            <View style={styles.root}>{children}</View>
          </View>
        </View>
      </View>
    </MobileAppMenuProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  desktopShell: {
    flex: 1,
    flexDirection: 'row',
  },
});
