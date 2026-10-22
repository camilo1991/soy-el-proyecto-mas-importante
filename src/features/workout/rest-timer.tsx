import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { radius, space, useTheme } from '@/constants/theme';

/** Cuenta regresiva de descanso que arranca al completar una serie. */
export function RestTimer({ startedAt, seconds, onDismiss }: { startedAt: number; seconds: number; onDismiss: () => void }) {
  const t = useTheme();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, seconds - Math.floor((now - startedAt) / 1000));
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
  return (
    <Pressable onPress={onDismiss} style={[styles.box, { backgroundColor: left === 0 ? t.success : t.accent }]}
      accessibilityLabel={`Descanso, quedan ${mm} minutos ${ss} segundos. Toca para cerrar`}>
      <Text style={[styles.text, { color: t.accentText }]}>{left === 0 ? '¡A la siguiente serie!' : `Descanso ${mm}:${ss}`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, padding: space.lg, borderRadius: radius.lg, alignItems: 'center' },
  text: { fontSize: 18, fontWeight: '800' },
});
