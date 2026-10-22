import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { space, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { pendingCount, pushOutbox } from '@/sync/sync';

export default function Perfil() {
  const t = useTheme();
  const db = useSQLiteContext();
  const { session } = useAuth();
  const [pending, setPending] = useState(0);

  useEffect(() => { pendingCount(db).then(setPending); }, [db]);

  const sync = async () => setPending((await pushOutbox(db)).pending);

  // Al cerrar sesión se borran los datos locales (por si el teléfono es compartido).
  const signOut = async () => {
    await pushOutbox(db).catch(() => {});
    await db.execAsync('DELETE FROM sets; DELETE FROM workout_exercises; DELETE FROM workouts; DELETE FROM outbox;');
    await supabase.auth.signOut();
  };

  // Exigido por Apple y Google: borrar la cuenta desde la app.
  const deleteAccount = () => {
    const go = async () => {
      await supabase.rpc('delete_my_account');
      await db.execAsync('DELETE FROM sets; DELETE FROM workout_exercises; DELETE FROM workouts; DELETE FROM outbox;');
      await supabase.auth.signOut();
    };
    if (Platform.OS === 'web') { if (globalThis.confirm?.('¿Borrar tu cuenta y todos tus datos? No se puede deshacer.')) go(); return; }
    Alert.alert('Borrar cuenta', 'Se borrarán tu cuenta y todos tus datos. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{session?.user.email}</Text>
      <Text style={{ color: t.muted }}>
        {pending === 0 ? 'Todo sincronizado' : `${pending} cambios pendientes de subir`}
      </Text>
      <Button title="Sincronizar ahora" variant="ghost" onPress={sync} />
      <Button title="Cerrar sesión" variant="ghost" onPress={signOut} />
      <Button title="Borrar mi cuenta" variant="danger" onPress={deleteAccount} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, padding: space.xl, gap: space.md } });
