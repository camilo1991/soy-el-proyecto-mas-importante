import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Almacenamiento de la sesión en el Keychain (iOS) / Keystore (Android).
 * SecureStore limita cada valor a ~2 KB, así que la sesión se guarda en trozos.
 * En web se usa localStorage (el navegador no tiene un equivalente seguro).
 */
const CHUNK = 1800;
const opts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    const k = safeKey(key);
    const count = Number(await SecureStore.getItemAsync(`${k}.n`, opts));
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`, opts);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return globalThis.localStorage?.setItem(key, value);
    const k = safeKey(key);
    await this.removeItem(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), opts);
    }
    await SecureStore.setItemAsync(`${k}.n`, String(count), opts);
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(key);
    const k = safeKey(key);
    const count = Number(await SecureStore.getItemAsync(`${k}.n`, opts));
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, opts);
    await SecureStore.deleteItemAsync(`${k}.n`, opts);
  },
};

/** Clave aleatoria para cifrar la base local (SQLCipher). Se crea una vez y vive en el Keychain. */
export async function getDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync('db_key', opts);
  if (existing) return existing;
  const { getRandomBytes } = await import('expo-crypto');
  const key = Array.from(getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync('db_key', key, opts);
  return key;
}
