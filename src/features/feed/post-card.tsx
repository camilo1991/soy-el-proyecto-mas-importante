import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, space, useTheme } from '@/constants/theme';

export type FeedPost = {
  id: string;
  caption: string | null;
  created_at: string;
  reaction_count: number;
  comment_count: number;
  summary: { volume_kg?: number; duration_min?: number; exercises?: string[]; prs?: { exercise: string; est_1rm: number }[] } | null;
  author: { username: string; display_name: string } | null;
  my_reaction?: boolean;
};

/** Tarjeta del feed: quién, volumen, duración, ejercicios destacados y PRs superados. */
export function PostCard({ post, onReact }: { post: FeedPost; onReact: (p: FeedPost) => void }) {
  const t = useTheme();
  const s = post.summary ?? {};
  const prs = s.prs ?? [];
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.author, { color: t.text }]}>{post.author?.display_name ?? 'Atleta'}</Text>
      <Text style={{ color: t.muted }}>@{post.author?.username} · {new Date(post.created_at).toLocaleDateString()}</Text>
      {post.caption ? <Text style={[styles.caption, { color: t.text }]}>{post.caption}</Text> : null}

      <View style={styles.stats}>
        <Stat label="Volumen" value={`${Math.round(s.volume_kg ?? 0).toLocaleString()} kg`} />
        <Stat label="Duración" value={`${s.duration_min ?? 0} min`} />
        <Stat label="Ejercicios" value={String(s.exercises?.length ?? 0)} />
      </View>

      {s.exercises?.length ? (
        <Text style={{ color: t.muted }} numberOfLines={2}>{s.exercises.join(' · ')}</Text>
      ) : null}

      {prs.map((pr) => (
        <Text key={pr.exercise} style={[styles.pr, { color: t.accent }]}>
          Nuevo PR · {pr.exercise}: {pr.est_1rm} kg (1RM estimado)
        </Text>
      ))}

      <View style={styles.actions}>
        <Pressable onPress={() => onReact(post)} accessibilityRole="button"
          accessibilityLabel={post.my_reaction ? 'Quitar apoyo' : 'Dar apoyo'}>
          <Text style={{ color: post.my_reaction ? t.accent : t.text, fontWeight: '700' }}>
            Fuerza · {post.reaction_count}
          </Text>
        </Pressable>
        <Text style={{ color: t.muted }}>Comentarios · {post.comment_count}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space.sm },
  author: { fontSize: 16, fontWeight: '800' },
  caption: { fontSize: 15 },
  stats: { flexDirection: 'row', gap: space.lg, marginVertical: space.xs },
  stat: { flex: 1 },
  pr: { fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
});
