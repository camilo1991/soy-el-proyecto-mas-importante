-- Tutoriales de ejercicios para principiantes.
-- El contenido vive en la base (y se copia al teléfono), así funciona sin internet en el gimnasio.

alter table public.exercises
  add column difficulty text not null default 'intermedio'
    check (difficulty in ('principiante','intermedio','avanzado')),
  add column primary_muscles text[] not null default '{}',
  add column secondary_muscles text[] not null default '{}',
  add column instructions text[] not null default '{}',     -- pasos en orden
  add column common_mistakes text[] not null default '{}',
  add column safety_tip text,
  add column easier_alternative_id uuid references public.exercises on delete set null,
  add column media_url text,                                  -- imagen o animación (fase 2)
  add column video_url text,                                  -- video (fase 2)
  add column content_reviewed_by text,                        -- entrenador que validó la ficha
  add column content_reviewed_at timestamptz;

-- Ejercicios base (también están en seed.sql; se repiten aquí porque la CLI de Supabase corre el seed
-- después de las migraciones y las fichas de abajo los necesitan).
insert into public.exercises (id, owner_id, name, muscle_group, equipment) values
  ('018f0000-0000-7000-8000-000000000001', null, 'Sentadilla con barra', 'piernas', 'barra'),
  ('018f0000-0000-7000-8000-000000000002', null, 'Press de banca', 'pecho', 'barra'),
  ('018f0000-0000-7000-8000-000000000003', null, 'Peso muerto', 'espalda', 'barra'),
  ('018f0000-0000-7000-8000-000000000004', null, 'Press militar', 'hombros', 'barra'),
  ('018f0000-0000-7000-8000-000000000005', null, 'Dominadas', 'espalda', 'peso corporal'),
  ('018f0000-0000-7000-8000-000000000006', null, 'Remo con barra', 'espalda', 'barra'),
  ('018f0000-0000-7000-8000-000000000007', null, 'Hip thrust', 'glúteos', 'barra'),
  ('018f0000-0000-7000-8000-000000000008', null, 'Curl de bíceps', 'brazos', 'mancuernas')
on conflict (id) do nothing;

-- Ejercicios de nivel principiante que sirven como alternativa más fácil.
insert into public.exercises (id, owner_id, name, muscle_group, equipment, tracking_type) values
  ('018f0000-0000-7000-8000-000000000009', null, 'Sentadilla goblet', 'piernas', 'mancuerna', 'weight_reps'),
  ('018f0000-0000-7000-8000-000000000010', null, 'Flexiones', 'pecho', 'peso corporal', 'reps'),
  ('018f0000-0000-7000-8000-000000000011', null, 'Peso muerto rumano con mancuernas', 'espalda', 'mancuernas', 'weight_reps'),
  ('018f0000-0000-7000-8000-000000000012', null, 'Press de hombros con mancuernas sentado', 'hombros', 'mancuernas', 'weight_reps'),
  ('018f0000-0000-7000-8000-000000000013', null, 'Jalón al pecho', 'espalda', 'polea', 'weight_reps'),
  ('018f0000-0000-7000-8000-000000000014', null, 'Remo con mancuerna a una mano', 'espalda', 'mancuerna', 'weight_reps'),
  ('018f0000-0000-7000-8000-000000000015', null, 'Puente de glúteo', 'glúteos', 'peso corporal', 'reps'),
  ('018f0000-0000-7000-8000-000000000016', null, 'Plancha', 'core', 'peso corporal', 'time')
on conflict (id) do nothing;

-- Fichas. Contenido general de técnica: debe revisarlo un entrenador certificado antes del lanzamiento.
create temp table fichas (id uuid, difficulty text, prim text[], sec text[], steps text[], mistakes text[], tip text, alt uuid);
insert into fichas values
('018f0000-0000-7000-8000-000000000001','intermedio','{cuádriceps,glúteos}','{isquiotibiales,core,espalda baja}',
 '{"Coloca la barra sobre la parte alta de la espalda, no sobre el cuello.","Pies a la anchura de los hombros, puntas un poco hacia afuera.","Toma aire, aprieta el abdomen y baja llevando la cadera atrás y abajo.","Baja hasta que los muslos queden al menos paralelos al suelo, con las rodillas siguiendo la dirección de los pies.","Empuja el suelo con todo el pie para subir, manteniendo el pecho arriba."}',
 '{"Rodillas que se van hacia adentro al subir.","Levantar los talones del suelo.","Redondear la espalda baja al final de la bajada."}',
 'Entrena dentro de un rack con los seguros a la altura adecuada por si no puedes subir.','018f0000-0000-7000-8000-000000000009'),
('018f0000-0000-7000-8000-000000000002','intermedio','{pecho}','{tríceps,hombro anterior}',
 '{"Acuéstate con los ojos bajo la barra y los pies firmes en el suelo.","Junta las escápulas y mantenlas así durante toda la serie.","Agarra la barra un poco más ancho que los hombros, muñecas rectas.","Baja controlado hasta tocar la parte baja del pecho, codos a unos 45° del cuerpo.","Empuja hacia arriba y un poco hacia atrás hasta extender los brazos."}',
 '{"Abrir los codos a 90° del cuerpo.","Rebotar la barra en el pecho.","Levantar la cadera del banco."}',
 'Usa los seguros del banco o pide a alguien que te asista en series pesadas.','018f0000-0000-7000-8000-000000000010'),
('018f0000-0000-7000-8000-000000000003','avanzado','{isquiotibiales,glúteos,espalda baja}','{trapecio,antebrazos,core}',
 '{"Barra sobre la mitad del pie, pies a la anchura de la cadera.","Agarra la barra justo por fuera de las piernas.","Baja la cadera hasta que las espinillas toquen la barra, pecho arriba, espalda recta.","Toma aire, aprieta el abdomen y empuja el suelo con las piernas.","Sube la barra pegada al cuerpo y termina de pie, sin echarte hacia atrás."}',
 '{"Redondear la espalda.","Alejar la barra del cuerpo.","Tirar con los brazos en lugar de empujar con las piernas."}',
 'Empieza con poco peso hasta dominar la técnica; si sientes dolor en la espalda baja, para.','018f0000-0000-7000-8000-000000000011'),
('018f0000-0000-7000-8000-000000000004','intermedio','{hombro anterior}','{tríceps,core}',
 '{"De pie, barra apoyada en la parte alta del pecho, agarre un poco más ancho que los hombros.","Aprieta glúteos y abdomen para no arquear la espalda.","Empuja la barra hacia arriba apartando la cara ligeramente.","Termina con la barra sobre la cabeza y los brazos extendidos.","Baja controlado hasta el pecho."}',
 '{"Arquear mucho la espalda baja.","Empujar la barra hacia adelante en vez de hacia arriba."}',
 'Si arqueas la espalda para subir el peso, baja la carga.','018f0000-0000-7000-8000-000000000012'),
('018f0000-0000-7000-8000-000000000005','avanzado','{dorsales}','{bíceps,espalda media}',
 '{"Cuélgate de la barra con agarre un poco más ancho que los hombros.","Lleva los hombros hacia abajo, lejos de las orejas.","Tira llevando los codos hacia las costillas hasta pasar la barbilla sobre la barra.","Baja controlado hasta extender los brazos."}',
 '{"Balancearse para subir.","No bajar del todo.","Encoger los hombros hacia las orejas."}',
 'Si aún no puedes hacer una, usa una banda elástica o el jalón al pecho.','018f0000-0000-7000-8000-000000000013'),
('018f0000-0000-7000-8000-000000000006','intermedio','{espalda media,dorsales}','{bíceps,espalda baja}',
 '{"Con la barra en las manos, inclina el torso hacia adelante desde la cadera, espalda recta.","Rodillas un poco flexionadas, barra colgando bajo los hombros.","Tira de la barra hacia el abdomen juntando las escápulas.","Baja controlado sin perder la postura."}',
 '{"Usar impulso con el torso.","Redondear la espalda."}',
 'Mantén el abdomen apretado para proteger la espalda baja.','018f0000-0000-7000-8000-000000000014'),
('018f0000-0000-7000-8000-000000000007','intermedio','{glúteos}','{isquiotibiales,core}',
 '{"Apoya la parte alta de la espalda en un banco, barra sobre la cadera (usa una almohadilla).","Pies firmes en el suelo, rodillas a 90° arriba.","Empuja con los talones y sube la cadera hasta alinearla con el torso.","Aprieta los glúteos un segundo arriba y baja controlado."}',
 '{"Arquear la espalda baja en lugar de subir con los glúteos.","Pies demasiado lejos o demasiado cerca."}',
 'Usa una almohadilla para que la barra no lastime la cadera.','018f0000-0000-7000-8000-000000000015'),
('018f0000-0000-7000-8000-000000000008','principiante','{bíceps}','{antebrazos}',
 '{"De pie, una mancuerna en cada mano, palmas hacia adelante.","Codos pegados al cuerpo.","Sube las mancuernas doblando los codos sin mover los hombros.","Baja lento hasta extender los brazos."}',
 '{"Balancear el cuerpo para subir el peso.","Separar los codos del cuerpo."}',
 'Elige un peso que puedas controlar en la bajada.',null),
('018f0000-0000-7000-8000-000000000009','principiante','{cuádriceps,glúteos}','{core}',
 '{"Sostén una mancuerna vertical pegada al pecho.","Pies a la anchura de los hombros.","Baja llevando la cadera atrás, codos entre las rodillas.","Sube empujando con todo el pie."}',
 '{"Inclinar el torso demasiado hacia adelante.","Rodillas hacia adentro."}',
 'Es la mejor forma de aprender la sentadilla antes de usar barra.',null),
('018f0000-0000-7000-8000-000000000010','principiante','{pecho}','{tríceps,hombro anterior,core}',
 '{"Manos en el suelo un poco más anchas que los hombros.","Cuerpo recto de la cabeza a los talones, abdomen apretado.","Baja el pecho hasta casi tocar el suelo, codos a unos 45°.","Empuja hasta extender los brazos."}',
 '{"Dejar caer la cadera.","Abrir los codos a los lados."}',
 'Si aún no puedes, apoya las manos en un banco o las rodillas en el suelo.',null),
('018f0000-0000-7000-8000-000000000011','principiante','{isquiotibiales,glúteos}','{espalda baja}',
 '{"De pie, mancuernas delante de los muslos, rodillas un poco flexionadas.","Lleva la cadera hacia atrás y baja las mancuernas pegadas a las piernas.","Baja hasta sentir estiramiento atrás de los muslos, espalda recta.","Sube empujando la cadera hacia adelante."}',
 '{"Redondear la espalda.","Doblar demasiado las rodillas."}',
 'Baja solo hasta donde puedas mantener la espalda recta.',null),
('018f0000-0000-7000-8000-000000000012','principiante','{hombro anterior}','{tríceps}',
 '{"Sentado en un banco con respaldo, mancuernas a la altura de los hombros.","Empuja hacia arriba hasta extender los brazos.","Baja controlado hasta la altura de las orejas."}',
 '{"Arquear la espalda despegándola del respaldo."}',
 'El respaldo protege tu espalda: mantenla apoyada.',null),
('018f0000-0000-7000-8000-000000000013','principiante','{dorsales}','{bíceps}',
 '{"Siéntate con los muslos bajo los soportes.","Agarra la barra un poco más ancho que los hombros.","Tira de la barra hacia la parte alta del pecho llevando los codos abajo.","Sube controlado hasta extender los brazos."}',
 '{"Echarse muy hacia atrás.","Tirar la barra detrás de la nuca."}',
 'Prepara el cuerpo para las dominadas.',null),
('018f0000-0000-7000-8000-000000000014','principiante','{espalda media,dorsales}','{bíceps}',
 '{"Apoya una rodilla y una mano en un banco, espalda recta.","Mancuerna colgando con el otro brazo.","Tira de la mancuerna hacia la cadera.","Baja controlado y cambia de lado al terminar."}',
 '{"Girar el torso para subir el peso."}',
 'Apoyarte en el banco protege tu espalda baja.',null),
('018f0000-0000-7000-8000-000000000015','principiante','{glúteos}','{isquiotibiales}',
 '{"Acostado boca arriba, rodillas dobladas, pies en el suelo.","Empuja con los talones y sube la cadera.","Aprieta los glúteos arriba un segundo.","Baja lento."}',
 '{"Arquear la espalda baja."}',
 'Ideal para aprender a activar los glúteos.',null),
('018f0000-0000-7000-8000-000000000016','principiante','{core}','{hombros,glúteos}',
 '{"Apoya antebrazos y puntas de los pies en el suelo.","Codos bajo los hombros.","Cuerpo recto de la cabeza a los talones, abdomen y glúteos apretados.","Mantén la posición respirando con normalidad."}',
 '{"Dejar caer la cadera.","Subir demasiado la cadera.","Contener la respiración."}',
 'Si es muy difícil, apoya las rodillas.',null);

update public.exercises e set
  difficulty = f.difficulty, primary_muscles = f.prim, secondary_muscles = f.sec,
  instructions = f.steps, common_mistakes = f.mistakes, safety_tip = f.tip,
  easier_alternative_id = f.alt
from fichas f where e.id = f.id;

drop table fichas;
