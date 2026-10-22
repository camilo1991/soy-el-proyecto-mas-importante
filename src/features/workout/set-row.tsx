import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { radius, space, useTheme } from '@/constants/theme';
import type { SetRow as SetRowData } from '@/db/workouts';

type Props = { set: SetRowData; index: number; onChange: (s: SetRowData) => void; onComplete: (s: SetRowData) => void };

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/** Una fila = una serie. Peso, reps y RPE con teclado numérico y check de un toque. */
export function SetRow({ set, index, onChange, onComplete }: Props) {
  const t = useTheme();
  const [weight, setWeight] = useState(set.weight_kg?.toString() ?? '');
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [rpe, setRpe] = useState(set.rpe?.toString() ?? '');
  const done = !!set.completed_at;

  const commit = () => {
    const w = num(weight), r = num(reps), p = num(rpe);
    onChange({
      ...set,
      weight_kg: w != null && w >= 0 && w <= 1000 ? w : null,
      reps: r != null && r >= 0 && r <= 500 ? Math.round(r) : null,
      rpe: p != null && p >= 1 && p <= 10 ? p : null,
    });
  };

  const toggle = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete({ ...set, weight_kg: num(weight), reps: num(reps), rpe: num(rpe),
      completed_at: done ? null : new Date().toISOString() });
  };

  const input = [styles.input, { color: t.text, backgroundColor: t.bg, borderColor: t.border }];
  return (
    <View style={[styles.row, done && { backgroundColor: `${t.success}22` }]}>
      <Text style={[styles.idx, { color: t.muted }]}>{set.set_type === 'warmup' ? 'C' : index + 1}</Text>
      <TextInput style={input} value={weight} onChangeText={setWeight} onBlur={commit}
        keyboardType="decimal-pad" placeholder="kg" placeholderTextColor={t.muted} accessibilityLabel="Peso en kg" />
      <TextInput style={input} value={reps} onChangeText={setReps} onBlur={commit}
        keyboardType="number-pad" placeholder="reps" placeholderTextColor={t.muted} accessibilityLabel="Repeticiones" />
      <TextInput style={[input, styles.rpe]} value={rpe} onChangeText={setRpe} onBlur={commit}
        keyboardType="decimal-pad" placeholder="RPE" placeholderTextColor={t.muted} accessibilityLabel="RPE" />
      <Pressable onPress={toggle} accessibilityRole="checkbox" accessibilityState={{ checked: done }}
        style={[styles.check, { borderColor: done ? t.success : t.border, backgroundColor: done ? t.success : 'transparent' }]}>
        <Text style={{ color: done ? '#fff' : t.muted, fontWeight: '800' }}>✓</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs, paddingHorizontal: space.xs, borderRadius: radius.sm },
  idx: { width: 20, textAlign: 'center', fontWeight: '700' },
  input: { flex: 1, height: 40, borderWidth: 1, borderRadius: radius.sm, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  rpe: { flex: 0.8 },
  check: { width: 40, height: 40, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
