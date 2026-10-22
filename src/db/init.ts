import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getDatabaseKey } from '@/lib/secure-storage';

import { LOCAL_SCHEMA, LOCAL_SCHEMA_VERSION } from './schema';

export const DATABASE_NAME = 'soy-el-proyecto.db';

/** Se ejecuta al abrir la base: cifra con SQLCipher (móvil) y aplica el esquema. */
export async function initDatabase(db: SQLiteDatabase) {
  if (Platform.OS !== 'web') {
    const key = await getDatabaseKey();
    // Debe ser la primera instrucción sobre la base. La clave es hex generada por nosotros.
    await db.execAsync(`PRAGMA key = "x'${key}'"`);
  }
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) < LOCAL_SCHEMA_VERSION) {
    await db.execAsync(LOCAL_SCHEMA);
    await db.execAsync(`PRAGMA user_version = ${LOCAL_SCHEMA_VERSION}`);
  }
}
