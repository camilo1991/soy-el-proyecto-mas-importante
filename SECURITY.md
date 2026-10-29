# Seguridad

Regla base: **el teléfono nunca es de confianza**. Toda autorización vive en PostgreSQL (Row Level Security) y los números que importan (PRs, volumen, ranking, contadores) los calcula solo el servidor.

## Controles implementados

| Riesgo | Control | Dónde |
| --- | --- | --- |
| Un usuario lee datos de otro | RLS activada en las 23 tablas; visibilidad pública / seguidores / privada; bloqueos | `supabase/migrations/0002_security_rls.sql` |
| Acceso sin sesión | El rol `anon` no tiene permisos sobre ninguna tabla | `0002` |
| Trampas en el ranking o contadores | Columnas `reaction_count`, `comment_count`, `summary`, `total_volume_kg`, `clone_count` no editables por el cliente; `weekly_stats` y `personal_records` sin política de escritura | `0002`, `0003` |
| Valores absurdos | `CHECK` en peso (≤ 1000 kg), reps (≤ 500), RPE (1–10), longitudes de texto | `0001` |
| Apropiarse de datos ajenos | Políticas `with check (owner_id = auth.uid())`; probado con upsert malicioso | `supabase/tests/rls_test.sql` |
| Robo del teléfono | Base local cifrada (SQLCipher) con clave aleatoria en Keychain/Keystore; sesión en SecureStore, solo este dispositivo | `src/db/init.ts`, `src/lib/secure-storage.ts` |
| Teléfono compartido | Cerrar sesión borra los datos locales | `src/app/(tabs)/perfil.tsx` |
| Enumeración de cuentas | Mensajes de error genéricos en el login | `src/app/login.tsx` |
| Robo de token en web | Flujo PKCE; cabeceras HSTS, `X-Frame-Options`, `nosniff`, `Permissions-Policy` | `src/lib/supabase.ts`, `vercel.json` |
| Derecho a borrar | Borrar cuenta y todos los datos desde la app (exigido por Apple y Google) | `delete_my_account()` en `0003` |
| Dependencias vulnerables | Dependabot semanal y `audit-ci` en CI (falla con vulnerabilidades altas; excepciones justificadas en `audit-ci.jsonc`) | `.github/`, `audit-ci.jsonc` |
| Secretos en el repositorio | `.env` ignorado; solo la *anon key* (pública por diseño) va en la app | `.gitignore`, `.env.example` |

## Pendientes antes de lanzar

- [ ] Activar en Supabase: confirmación de correo, contraseña mínima de 12 caracteres, protección contra contraseñas filtradas, CAPTCHA en registro, MFA opcional.
- [ ] Sign in with Apple y Google.
- [ ] Storage privado con URLs firmadas y borrado de metadatos EXIF (GPS) en fotos.
- [ ] Zonas de privacidad para mapas (ocultar inicio y fin de rutas).
- [ ] Límite de peticiones y moderación de texto/imágenes (Edge Function).
- [ ] Verificación de edad mínima y consentimiento explícito para datos de salud.
- [ ] Política de privacidad revisada por un abogado (Ley 1581 de 2012 en Colombia; RGPD si hay usuarios en Europa).
- [ ] Revisión con OWASP MASVS antes de publicar en tiendas.
- [ ] Fichas de ejercicios revisadas por un entrenador certificado (`content_reviewed_by`).
- [ ] Confirmar el origen de las fotos de `assets/exercises` o reemplazarlas por fotos propias (ver `assets/exercises/FUENTE.md`).

## Reportar una vulnerabilidad

Escribe al dueño del repositorio de forma privada. No abras un issue público.
