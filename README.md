# Soy el proyecto más importante

Red social fitness: registro ultrarrápido de series (estilo Heavy/Symmetry), feed de rendimiento (estilo Strava), hábitos, suplementación y recuperación. Un solo código para **Android, iOS, Huawei AppGallery y Web**, y funciona **sin conexión** en el gimnasio.

## Stack

| Capa | Herramienta |
| --- | --- |
| App | Expo SDK 58 (React Native) + TypeScript + Expo Router |
| Base local | SQLite cifrada con SQLCipher (`expo-sqlite`) |
| Sincronización | Cola `outbox` propia (`src/sync/sync.ts`), lista para migrar a PowerSync si crece |
| Backend | Supabase: PostgreSQL + Row Level Security, Auth, Storage, funciones SQL |
| CI | GitHub Actions: tipos, build web, `npm audit` y pruebas de seguridad de la base |

## Estructura

```
src/
  app/                 Pantallas (Expo Router)
    login.tsx
    (tabs)/            Feed, Entrenar, Ranking, Perfil
  db/                  SQLite local: esquema, cifrado, repositorio de entrenamientos
  sync/                Subida ordenada de cambios y descarga del catálogo
  features/            Componentes por dominio (workout, feed)
  lib/                 Supabase, sesión segura, IDs UUID v7
supabase/
  migrations/          0001 esquema · 0002 seguridad RLS · 0003 lógica del servidor
  seed.sql             Ejercicios base
  tests/               Pruebas de RLS que corren en CI
```

## Puesta en marcha

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En el SQL Editor de Supabase ejecuta, en orden, `supabase/migrations/0001…`, `0002…`, `0003…` y `supabase/seed.sql`
   (o usa la CLI: `npx supabase link` y `npx supabase db push`).
3. Copia `.env.example` a `.env` y pon la URL y la *anon key* del proyecto.
4. `npm install`
5. `npm run web` para probar en el navegador. Para el teléfono hace falta un *development build*
   (SQLCipher es código nativo): `npx eas-cli@latest build --profile development`.

## Cómo funciona el modo sin conexión

1. Cada serie se guarda en SQLite y se encola en `outbox` en la misma transacción.
2. Los IDs se generan en el teléfono (UUID v7), así no chocan al subir.
3. Cada 30 s, al abrir la app y al volver a primer plano se sube la cola en orden. Si falla, se detiene y reintenta.
4. Al terminar el entrenamiento se llama a `finish_workout` en el servidor, que calcula volumen, PRs y ranking y publica el post. El cliente no puede falsear esos números.

## Publicación en tiendas

| Tienda | Comando |
| --- | --- |
| Google Play / App Store | `npx eas-cli@latest build --profile production` y `eas submit` |
| Huawei AppGallery | `npx eas-cli@latest build --profile huawei --platform android` y subir el APK en AppGallery Connect |
| Web | `npx expo export --platform web` (Vercel lee `vercel.json`) |

Pendiente para Huawei: notificaciones con Huawei Push Kit en el perfil `huawei` (los teléfonos Huawei recientes no tienen servicios de Google).

## Seguridad

Ver [SECURITY.md](SECURITY.md).
