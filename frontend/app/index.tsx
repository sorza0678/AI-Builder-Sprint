import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { hasCompletedOnboarding } from '@/src/utils/onboarding-storage';

type InitialRoute = '/home' | '/onboarding';

export default function Index() {
  const [initialRoute, setInitialRoute] = useState<InitialRoute | null>(null);

  useEffect(() => {
    let active = true;

    hasCompletedOnboarding()
      .then((completed) => {
        if (active) {
          setInitialRoute(completed ? '/home' : '/onboarding');
        }
      })
      .catch(() => {
        if (active) {
          setInitialRoute('/onboarding');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (!initialRoute) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#8656C2" />
      </View>
    );
  }

  return <Redirect href={initialRoute} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
