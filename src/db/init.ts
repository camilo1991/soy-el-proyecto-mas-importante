import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getDatabaseKey } from '@/lib/secure-storage';

import { LOCAL_MIGRATION_V2, LOCAL_SCHEMA, LOCAL_SCHEMA_VERSION } from './schema';

export const DATABASE_NAME = 'soy-el-proyecto.db';

/** Se ejecuta al abrir la base: cifra con SQLCipher (móvil) y aplica el esquema. */
export async function initDatabase(db: SQLiteDatabase) {
  if (Platform.OS !== 'web') {
    const key = await getDatabaseKey();
    // Debe ser la primera instrucción sobre la base. La clave es hex generada por nosotros.
    await db.execAsync(`PRAGMA key = "x'${key}'"`);
  }
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) await db.execAsync(LOCAL_SCHEMA);
  if (version < 2) await db.execAsync(LOCAL_MIGRATION_V2); // vuelve a descargar el catálogo con las fichas
  if (version < LOCAL_SCHEMA_VERSION) await db.execAsync(`PRAGMA user_version = ${LOCAL_SCHEMA_VERSION}`);
}
