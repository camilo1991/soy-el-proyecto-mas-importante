import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, space, useTheme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Row = { user_id: string; sessions: number; volume_kg: number; consistency_score: number; profile: { username: string; display_name: string } | null };
type Metric = 'consistency_score' | 'volume_kg';

function weekStart(d = new Date()) {
  const day = (d.getUTCDay() + 6) % 7; // lunes = 0
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return m.toISOString().slice(0, 10);
}

/** Ranking semanal por consistencia o volumen. Los números los calcula solo el servidor. */
export default function Ranking() {
  const t = useTheme();
  const [metric, setMetric] = useState<Metric>('consistency_score');
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('weekly_stats')
      .select('user_id, sessions, volume_kg, consistency_score, profile:profiles(username, display_name)')
      .eq('week_start', weekStart()).order(metric, { ascending: false }).limit(50);
    setRows((data as unknown as Row[]) ?? []);
  }, [metric]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.tabs}>
        {([['consistency_score', 'Consistencia'], ['volume_kg', 'Volumen']] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => setMetric(k)}
            style={[styles.tab, { backgroundColor: metric === k ? t.accent : t.card }]}>
            <Text style={{ color: metric === k ? t.accentText : t.text, fontWeight: '700' }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList data={rows} keyExtractor={(r) => r.user_id} contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        ListEmptyComponent={<Text style={{ color: t.muted }}>Nadie ha entrenado esta semana todavía. ¡Sé el primero!</Text>}
        renderItem={({ item, index }) => (
          <View style={[styles.row, { backgroundColor: t.card }]}>
            <Text style={[styles.pos, { color: index < 3 ? t.accent : t.muted }]}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: '700' }}>{item.profile?.display_name ?? 'Atleta'}</Text>
              <Text style={{ color: t.muted }}>{item.sessions} sesiones</Text>
            </View>
            <Text style={{ color: t.text, fontWeight: '800' }}>
              {metric === 'volume_kg' ? `${Math.round(item.volume_kg).toLocaleString()} kg` : `${item.consistency_score}%`}
            </Text>
          </View>
        )} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: space.sm, padding: space.lg, paddingBottom: 0 },
  tab: { paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md },
  pos: { width: 28, fontSize: 18, fontWeight: '900', textAlign: 'center' },
});
