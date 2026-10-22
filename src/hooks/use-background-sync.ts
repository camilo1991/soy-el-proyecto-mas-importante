import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { pullExercises, pushOutbox } from '@/sync/sync';

/**
 * Intenta sincronizar al abrir la app, al volver a primer plano y cada 30 s.
 * Si no hay red, los cambios quedan en la cola local y se reintentan.
 */
export function useBackgroundSync(enabled: boolean) {
  const db = useSQLiteContext();
  const [pending, setPending] = useState(0);

  const run = useCallback(async () => {
    if (!enabled) return;
    try {
      await pullExercises(db);
      const r = await pushOutbox(db);
      if (r.pending >= 0) setPending(r.pending);
    } catch {
      // Sin conexión: se reintenta en el próximo ciclo.
    }
  }, [db, enabled]);

  useEffect(() => {
    run();
    const timer = setInterval(run, 30_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [run]);

  return { pending, syncNow: run };
}
