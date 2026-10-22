-- Ejercicios del sistema (owner_id null). Ampliar según el catálogo final.
insert into public.exercises (id, owner_id, name, muscle_group, equipment) values
  ('018f0000-0000-7000-8000-000000000001', null, 'Sentadilla con barra', 'piernas', 'barra'),
  ('018f0000-0000-7000-8000-000000000002', null, 'Press de banca', 'pecho', 'barra'),
  ('018f0000-0000-7000-8000-000000000003', null, 'Peso muerto', 'espalda', 'barra'),
  ('018f0000-0000-7000-8000-000000000004', null, 'Press militar', 'hombros', 'barra'),
  ('018f0000-0000-7000-8000-000000000005', null, 'Dominadas', 'espalda', 'peso corporal'),
  ('018f0000-0000-7000-8000-000000000006', null, 'Remo con barra', 'espalda', 'barra'),
  ('018f0000-0000-7000-8000-000000000007', null, 'Hip thrust', 'glúteos', 'barra'),
  ('018f0000-0000-7000-8000-000000000008', null, 'Curl de bíceps', 'brazos', 'mancuernas')
on conflict do nothing;
