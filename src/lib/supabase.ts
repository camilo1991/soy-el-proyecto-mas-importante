import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { secureStorage } from './secure-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example a .env');
}

if (url && !url.startsWith('https://') && !__DEV__) {
  throw new Error('Supabase debe usarse solo por HTTPS en producción');
}

export const supabase = createClient(url ?? 'https://placeholder.supabase.co', anonKey ?? 'placeholder', {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});
