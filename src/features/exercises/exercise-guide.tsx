import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { radius, space, useTheme } from '@/constants/theme';

import { EXERCISE_IMAGES } from './exercise-images';

type Row = {
  id: string; name: string; muscle_group: string; equipment: string | null; difficulty: string;
  primary_muscles: string; secondary_muscles: string; instructions: string; common_mistakes: string;
  safety_tip: string | null; easier_alternative_id: string | null; alt_name: string | null;
};

const list = (json: string): string[] => { try { return JSON.parse(json) ?? []; } catch { return []; } };

export const DIFFICULTY_LABEL: Record<string, string> = {
  principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado',
};

/** Ficha "¿Cómo se hace?": fotos, pasos, errores comunes y alternativa más fácil. Funciona sin internet. */
export function ExerciseGuide({ exerciseId, onClose, onPickAlternative }: {
  exerciseId: string | null; onClose: () => void; onPickAlternative?: (id: string) => void;
}) {
  const t = useTheme();
  const db = useSQLiteContext();
  const [ex, setEx] = useState<Row | null>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!exerciseId) { setEx(null); return; }
    db.getFirstAsync<Row>(
      `SELECT e.*, a.name AS alt_name FROM exercises e
       LEFT JOIN exercises a ON a.id = e.easier_alternative_id WHERE e.id = ?`, exerciseId).then(setEx);
  }, [db, exerciseId]);

  // Alterna las dos fotos (inicio y final del movimiento) como una animación simple.
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % 2), 1200);
    return () => clearInterval(id);
  }, []);

  const images = exerciseId ? EXERCISE_IMAGES[exerciseId] : undefined;
  const steps = ex ? list(ex.instructions) : [];
  const mistakes = ex ? list(ex.common_mistakes) : [];
  const muscles = ex ? [...list(ex.primary_muscles), ...list(ex.secondary_muscles)] : [];

  return (
    <Modal visible={!!exerciseId} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.root}>
        {ex ? (
          <>
            <Text style={[styles.title, { color: t.text }]}>{ex.name}</Text>
            <View style={styles.badges}>
              <Badge text={DIFFICULTY_LABEL[ex.difficulty] ?? ex.difficulty} />
              {ex.equipment ? <Badge text={ex.equipment} /> : null}
            </View>

            {images ? (
              <Image source={images[frame]} style={[styles.photo, { backgroundColor: t.card }]} contentFit="cover"
                accessibilityLabel={`${ex.name}: ${frame === 0 ? 'posición inicial' : 'posición final'}`} />
            ) : null}

            {muscles.length ? <Section title="Músculos que trabaja"><Text style={{ color: t.text }}>{muscles.join(' · ')}</Text></Section> : null}

            {steps.length ? (
              <Section title="Cómo se hace">
                {steps.map((s, i) => (
                  <View key={i} style={styles.step}>
                    <Text style={[styles.num, { color: t.accent }]}>{i + 1}</Text>
                    <Text style={[styles.body, { color: t.text }]}>{s}</Text>
                  </View>
                ))}
              </Section>
            ) : (
              <Text style={{ color: t.muted }}>Aún no hay ficha para este ejercicio.</Text>
            )}

            {mistakes.length ? (
              <Section title="Errores comunes">
                {mistakes.map((m, i) => <Text key={i} style={[styles.body, { color: t.text }]}>✕ {m}</Text>)}
              </Section>
            ) : null}

            {ex.safety_tip ? (
              <View style={[styles.tip, { backgroundColor: `${t.accent}1A`, borderColor: t.accent }]}>
                <Text style={{ color: t.text, fontWeight: '700' }}>Consejo de seguridad</Text>
                <Text style={[styles.body, { color: t.text }]}>{ex.safety_tip}</Text>
              </View>
            ) : null}

            {ex.easier_alternative_id && ex.alt_name ? (
              <Section title="¿Muy difícil todavía?">
                <Text style={{ color: t.text }}>Empieza con: <Text style={{ fontWeight: '800' }}>{ex.alt_name}</Text></Text>
                {onPickAlternative ? (
                  <Button title={`Usar ${ex.alt_name}`} variant="ghost"
                    onPress={() => onPickAlternative(ex.easier_alternative_id!)} />
                ) : null}
              </Section>
            ) : null}
          </>
        ) : null}
        <Button title="Cerrar" onPress={onClose} />
        <Text style={[styles.disclaimer, { color: t.muted }]}>
          Guía general. Si tienes una lesión o dudas, consulta a un profesional.
        </Text>
      </ScrollView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.h2, { color: t.text }]}>{title}</Text>
      {children}
    </View>
  );
}

export function Badge({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: space.lg, paddingTop: space.xl * 2, gap: space.md },
  title: { fontSize: 26, fontWeight: '900' },
  badges: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  badge: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  photo: { width: '100%', aspectRatio: 3 / 2, borderRadius: radius.lg },
  section: { gap: space.sm },
  h2: { fontSize: 17, fontWeight: '800' },
  step: { flexDirection: 'row', gap: space.sm },
  num: { width: 18, fontWeight: '900', fontSize: 16 },
  body: { flex: 1, fontSize: 15, lineHeight: 22 },
  tip: { padding: space.md, borderRadius: radius.md, borderWidth: 1, gap: space.xs },
  disclaimer: { fontSize: 12, textAlign: 'center' },
});
