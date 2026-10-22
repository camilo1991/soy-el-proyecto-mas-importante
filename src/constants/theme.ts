import { useColorScheme } from 'react-native';

const palette = {
  light: {
    bg: '#FFFFFF', card: '#F2F3F5', border: '#E1E3E8', text: '#0B0C0E', muted: '#5F6470',
    accent: '#FF5A1F', accentText: '#FFFFFF', success: '#1F9D55', danger: '#D93025',
  },
  dark: {
    bg: '#0B0C0E', card: '#17191D', border: '#2A2D33', text: '#F4F5F7', muted: '#9AA0AB',
    accent: '#FF6A33', accentText: '#0B0C0E', success: '#34C26E', danger: '#FF6B5E',
  },
} as const;

export type Theme = (typeof palette)['light'] | (typeof palette)['dark'];

export function useTheme(): Theme {
  return palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
