import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { radius, space, useTheme } from '@/constants/theme';

type Props = PressableProps & { title: string; variant?: 'primary' | 'ghost' | 'danger' };

export function Button({ title, variant = 'primary', style, ...rest }: Props) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : 'transparent';
  const color = variant === 'primary' ? t.accentText : variant === 'danger' ? t.danger : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      style={(s) => [styles.base, { backgroundColor: bg, borderColor: t.border, opacity: s.pressed ? 0.7 : 1 },
        typeof style === 'function' ? style(s) : style]}
      {...rest}>
      <Text style={[styles.label, { color }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '700' },
});
