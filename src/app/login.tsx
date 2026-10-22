import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { radius, space, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const t = useTheme();
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/" />;

  const run = async (mode: 'in' | 'up') => {
    setBusy(true);
    setMsg(null);
    const { error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    // Mensaje genérico: no revelar si el correo existe o no.
    if (error) setMsg('No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo.');
    else if (mode === 'up') setMsg('Te enviamos un correo para confirmar tu cuenta.');
  };

  const input = [styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }];
  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <Text style={[styles.title, { color: t.text }]}>Soy el proyecto más importante</Text>
      <Text style={{ color: t.muted, marginBottom: space.lg }}>Registra, comparte y supera tus marcas.</Text>
      <TextInput style={input} placeholder="Correo" placeholderTextColor={t.muted} autoCapitalize="none"
        autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={input} placeholder="Contraseña (mín. 12 caracteres)" placeholderTextColor={t.muted}
        secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} />
      <Button title="Entrar" disabled={busy} onPress={() => run('in')} />
      <Button title="Crear cuenta" variant="ghost" disabled={busy || password.length < 12} onPress={() => run('up')} />
      {msg ? <Text style={{ color: t.muted, marginTop: space.md }}>{msg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.md },
  title: { fontSize: 28, fontWeight: '900' },
  input: { height: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16 },
});
