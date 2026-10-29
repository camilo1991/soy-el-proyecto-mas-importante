import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { radius, space, useTheme } from '@/constants/theme';
import {
  addExercise, addSet, finishWorkout, getActiveWorkoutId, loadWorkout, startWorkout, updateSet, volumeOf,
  type SetRow as SetData, type WorkoutExerciseView,
} from '@/db/workouts';
import { Badge, DIFFICULTY_LABEL, ExerciseGuide } from '@/features/exercises/exercise-guide';
import { RestTimer } from '@/features/workout/rest-timer';
import { SetRow } from '@/features/workout/set-row';
import { useAuth } from '@/lib/auth';
import { pushOutbox } from '@/sync/sync';

const REST_SECONDS = 120;

/** Registro de entrenamiento. Funciona 100 % sin conexión: todo va a SQLite y se sube después. */
export default function Entrenar() {
  const t = useTheme();
  const db = useSQLiteContext();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [view, setView] = useState<WorkoutExerciseView[]>([]);
  const [picker, setPicker] = useState(false);
  const [rest, setRest] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [guide, setGuide] = useState<string | null>(null);

  const refresh = useCallback(async (id: string | null) => {
    setView(id ? await loadWorkout(db, id) : []);
  }, [db]);

  useEffect(() => {
    getActiveWorkoutId(db, uid).then((id) => { setWorkoutId(id); refresh(id); });
  }, [db, uid, refresh]);

  const start = async () => { const id = await startWorkout(db, uid); setWorkoutId(id); refresh(id); };

  const onChange = async (s: SetData) => { await updateSet(db, s); refresh(workoutId); };
  const onComplete = async (s: SetData) => {
    await updateSet(db, s);
    if (s.completed_at) setRest(Date.now());
    refresh(workoutId);
  };

  const finish = async () => {
    if (!workoutId) return;
    await finishWorkout(db, workoutId, caption.trim() || null);
    setWorkoutId(null); setView([]); setCaption(''); setRest(null);
    pushOutbox(db).catch(() => {}); // si no hay red, se sube al reconectar
  };

  if (!workoutId) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={[styles.h1, { color: t.text }]}>¿Listo para entrenar?</Text>
        <Text style={{ color: t.muted, textAlign: 'center' }}>Funciona sin internet. Se sincroniza solo al reconectar.</Text>
        <Button title="Empezar entrenamiento" onPress={start} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text style={{ color: t.muted }}>Volumen: {Math.round(volumeOf(view)).toLocaleString()} kg</Text>
        {view.map((ex) => (
          <View key={ex.id} style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={styles.exHeader}>
              <Text style={[styles.exName, { color: t.text }]}>{ex.name}</Text>
              <Pressable onPress={() => setGuide(ex.exercise_id)} accessibilityRole="button" hitSlop={8}>
                <Text style={{ color: t.accent, fontWeight: '700' }}>¿Cómo se hace?</Text>
              </Pressable>
            </View>
            <View style={styles.header}>
              {['#', 'kg', 'reps', 'RPE', ''].map((h, i) => (
                <Text key={i} style={[styles.headerCell, { color: t.muted }, i === 0 && { flex: 0, width: 20 }, i === 4 && { flex: 0, width: 40 }]}>{h}</Text>
              ))}
            </View>
            {ex.sets.map((s, i) => (
              <SetRow key={s.id} set={s} index={i} onChange={onChange} onComplete={onComplete} />
            ))}
            <Button title="+ Serie" variant="ghost" onPress={async () => { await addSet(db, ex.id); refresh(workoutId); }} />
          </View>
        ))}
        <Button title="+ Ejercicio" variant="ghost" onPress={() => setPicker(true)} />
        <TextInput style={[styles.caption, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
          placeholder="¿Cómo te fue? (opcional, se publica en el feed)" placeholderTextColor={t.muted}
          value={caption} onChangeText={setCaption} maxLength={2000} multiline />
        <Button title="Terminar y publicar" onPress={finish} />
      </ScrollView>

      {rest ? <RestTimer startedAt={rest} seconds={REST_SECONDS} onDismiss={() => setRest(null)} /> : null}

      <ExerciseGuide exerciseId={guide} onClose={() => setGuide(null)} />

      <ExercisePicker visible={picker} onClose={() => setPicker(false)}
        onPick={async (exerciseId) => { setPicker(false); await addExercise(db, workoutId, exerciseId); refresh(workoutId); }} />
    </View>
  );
}

function ExercisePicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const t = useTheme();
  const db = useSQLiteContext();
  const [q, setQ] = useState('');
  const [beginner, setBeginner] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);
  const [items, setItems] = useState<{ id: string; name: string; muscle_group: string; difficulty: string }[]>([]);

  useEffect(() => {
    if (!visible) return;
    db.getAllAsync<{ id: string; name: string; muscle_group: string; difficulty: string }>(
      `SELECT id, name, muscle_group, difficulty FROM exercises
       WHERE deleted_at IS NULL AND name LIKE ? AND (? = 0 OR difficulty = 'principiante')
       ORDER BY CASE difficulty WHEN 'principiante' THEN 0 WHEN 'intermedio' THEN 1 ELSE 2 END, name LIMIT 100`,
      `%${q}%`, beginner ? 1 : 0).then(setItems);
  }, [db, q, beginner, visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.bg, padding: space.lg, paddingTop: space.xl * 2, gap: space.md }}>
        <TextInput autoFocus style={[styles.caption, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
          placeholder="Buscar ejercicio" placeholderTextColor={t.muted} value={q} onChangeText={setQ} />
        <Pressable onPress={() => setBeginner((b) => !b)} accessibilityRole="switch" accessibilityState={{ checked: beginner }}
          style={[styles.filter, { backgroundColor: beginner ? t.accent : t.card }]}>
          <Text style={{ color: beginner ? t.accentText : t.text, fontWeight: '700' }}>Solo para principiantes</Text>
        </Pressable>
        <FlatList data={items} keyExtractor={(e) => e.id}
          ListEmptyComponent={<Text style={{ color: t.muted }}>Sin ejercicios aún. Conéctate una vez para descargar el catálogo.</Text>}
          renderItem={({ item }) => (
            <View style={styles.pickRow}>
              <Pressable onPress={() => onPick(item.id)} style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: t.text, fontWeight: '700' }}>{item.name}</Text>
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <Text style={{ color: t.muted }}>{item.muscle_group}</Text>
                  <Badge text={DIFFICULTY_LABEL[item.difficulty] ?? item.difficulty} />
                </View>
              </Pressable>
              <Pressable onPress={() => setGuide(item.id)} hitSlop={8} accessibilityRole="button"
                accessibilityLabel={`Ver cómo se hace ${item.name}`}>
                <Text style={{ color: t.accent, fontWeight: '700' }}>Ver guía</Text>
              </Pressable>
            </View>
          )} />
        <Button title="Cancelar" variant="ghost" onPress={onClose} />
      </View>
      <ExerciseGuide exerciseId={guide} onClose={() => setGuide(null)}
        onPickAlternative={(id) => { setGuide(null); onPick(id); }} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl, gap: space.lg },
  h1: { fontSize: 24, fontWeight: '900' },
  list: { padding: space.lg, gap: space.md, paddingBottom: 120 },
  card: { padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space.xs },
  exName: { flex: 1, fontSize: 17, fontWeight: '800', marginBottom: space.xs },
  header: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xs },
  headerCell: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  caption: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, padding: space.md, fontSize: 16 },
  pickRow: { paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  filter: { alignSelf: 'flex-start', paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.lg },
});
