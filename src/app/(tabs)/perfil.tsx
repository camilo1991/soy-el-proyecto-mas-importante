import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { radius, space, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { pickAndUploadAvatar } from '@/lib/avatar';
import { supabase } from '@/lib/supabase';
import { pendingCount, pushOutbox } from '@/sync/sync';

type Profile = { username: string; display_name: string; bio: string | null; avatar_url: string | null };

const USERNAME = /^[a-z0-9_]{3,20}$/;

export default function Perfil() {
  const t = useTheme();
  const db = useSQLiteContext();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [pending, setPending] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from('profiles').select('username, display_name, bio, avatar_url').eq('id', uid).single();
    if (data) setProfile(data);
  }, [uid]);

  useEffect(() => { pendingCount(db).then(setPending); load(); }, [db, load]);

  const save = async () => {
    if (!draft || !uid) return;
    const username = draft.username.trim().toLowerCase();
    if (!USERNAME.test(username)) { setMsg('El usuario debe tener de 3 a 20 letras minúsculas, números o _.'); return; }
    if (!draft.display_name.trim()) { setMsg('Escribe tu nombre.'); return; }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      username, display_name: draft.display_name.trim().slice(0, 60), bio: draft.bio?.trim().slice(0, 280) || null,
    }).eq('id', uid);
    setBusy(false);
    if (error) { setMsg(error.code === '23505' ? 'Ese nombre de usuario ya está en uso.' : 'No se pudo guardar. Inténtalo de nuevo.'); return; }
    setDraft(null); setMsg('Perfil actualizado.'); load();
  };

  const changePhoto = async () => {
    if (!uid) return;
    try {
      setBusy(true);
      const url = await pickAndUploadAvatar(uid);
      if (url) {
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid);
        setMsg('Foto actualizada.'); load();
      }
    } catch {
      setMsg('No se pudo subir la foto. Revisa tu conexión.');
    } finally { setBusy(false); }
  };

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

  const input = [styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }];
  const initial = (profile?.display_name || session?.user.email || '?').charAt(0).toUpperCase();

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={changePhoto} disabled={busy} accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil">
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty, { backgroundColor: t.card, borderColor: t.border }]}>
              <Text style={{ color: t.muted, fontSize: 32, fontWeight: '800' }}>{initial}</Text>
            </View>
          )}
          <Text style={[styles.changePhoto, { color: t.accent }]}>Cambiar foto</Text>
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: '900' }}>{profile?.display_name ?? '…'}</Text>
          <Text style={{ color: t.muted }}>@{profile?.username}</Text>
          {profile?.bio ? <Text style={{ color: t.text, marginTop: space.xs }}>{profile.bio}</Text> : null}
        </View>
      </View>

      {draft ? (
        <View style={styles.form}>
          <Text style={[styles.label, { color: t.muted }]}>Nombre</Text>
          <TextInput style={input} value={draft.display_name} maxLength={60}
            onChangeText={(v) => setDraft({ ...draft, display_name: v })} />
          <Text style={[styles.label, { color: t.muted }]}>Usuario</Text>
          <TextInput style={input} value={draft.username} maxLength={20} autoCapitalize="none"
            onChangeText={(v) => setDraft({ ...draft, username: v })} />
          <Text style={[styles.label, { color: t.muted }]}>Descripción ({(draft.bio ?? '').length}/280)</Text>
          <TextInput style={[input, styles.bio]} value={draft.bio ?? ''} maxLength={280} multiline
            placeholder="Ej.: Entreno fuerza 4 días por semana. Meta: 100 kg en sentadilla."
            placeholderTextColor={t.muted} onChangeText={(v) => setDraft({ ...draft, bio: v })} />
          <Button title="Guardar" disabled={busy} onPress={save} />
          <Button title="Cancelar" variant="ghost" onPress={() => { setDraft(null); setMsg(null); }} />
        </View>
      ) : (
        <Button title="Editar perfil" variant="ghost" disabled={!profile} onPress={() => { setMsg(null); setDraft(profile); }} />
      )}
      {msg ? <Text style={{ color: t.muted }}>{msg}</Text> : null}

      <View style={[styles.divider, { backgroundColor: t.border }]} />
      <Text style={{ color: t.muted }}>{session?.user.email}</Text>
      <Text style={{ color: t.muted }}>
        {pending === 0 ? 'Todo sincronizado' : `${pending} cambios pendientes de subir`}
      </Text>
      <Button title="Sincronizar ahora" variant="ghost" onPress={sync} />
      <Button title="Cerrar sesión" variant="ghost" onPress={signOut} />
      <Button title="Borrar mi cuenta" variant="danger" onPress={deleteAccount} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: space.xl, gap: space.md },
  header: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  changePhoto: { textAlign: 'center', fontSize: 12, fontWeight: '700', marginTop: space.xs },
  form: { gap: space.sm },
  label: { fontSize: 12, fontWeight: '700' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16 },
  bio: { minHeight: 88, paddingTop: space.md, textAlignVertical: 'top' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: space.sm },
});
