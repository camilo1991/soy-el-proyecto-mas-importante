import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { DATABASE_NAME, initDatabase } from '@/db/init';
import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase}>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SQLiteProvider>
  );
}
