import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text } from 'react-native';

import { space, useTheme } from '@/constants/theme';
import { PostCard, type FeedPost } from '@/features/feed/post-card';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Feed: RLS ya filtra lo que cada usuario puede ver (públicos, seguidos, sin bloqueados). */
export default function Feed() {
  const t = useTheme();
  const { session } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('posts')
      .select('id, caption, created_at, reaction_count, comment_count, summary, author:profiles!posts_author_id_fkey(username, display_name), reactions(user_id)')
      .order('created_at', { ascending: false })
      .limit(30);
    setPosts((data ?? []).map((p: any) => ({
      ...p, my_reaction: p.reactions?.some((r: { user_id: string }) => r.user_id === session?.user.id),
    })));
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const react = async (p: FeedPost) => {
    const uid = session?.user.id;
    if (!uid) return;
    if (p.my_reaction) await supabase.from('reactions').delete().match({ post_id: p.id, user_id: uid });
    else await supabase.from('reactions').insert({ post_id: p.id, user_id: uid });
    load();
  };

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.list}
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} onReact={react} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center' }}>
        Sigue a otros atletas o termina tu primer entrenamiento para llenar el feed.</Text>}
    />
  );
}

const styles = StyleSheet.create({ list: { padding: space.lg, gap: space.md } });
