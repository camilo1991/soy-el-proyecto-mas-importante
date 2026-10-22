import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { useTheme } from '@/constants/theme';
import { useBackgroundSync } from '@/hooks/use-background-sync';
import { useAuth } from '@/lib/auth';

export default function TabsLayout() {
  const { session, loading } = useAuth();
  const t = useTheme();
  useBackgroundSync(!!session);

  if (loading) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { color: t.text },
        tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.border },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="entrenar" options={{ title: 'Entrenar' }} />
      <Tabs.Screen name="ranking" options={{ title: 'Ranking' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
