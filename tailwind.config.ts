import type { Config } from 'tailwindcss';

// Token classes map to CSS variables defined in src/index.css.
// Channels are "R G B" triplets so alpha utilities work: bg-surface/70 etc.
const tok = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: tok('--primary'),
        'on-primary': tok('--on-primary'),
        'primary-container': tok('--primary-container'),
        'on-primary-container': tok('--on-primary-container'),
        secondary: tok('--secondary'),
        'secondary-container': tok('--secondary-container'),
        'on-secondary-container': tok('--on-secondary-container'),
        tertiary: tok('--tertiary'),
        error: tok('--error'),
        background: tok('--background'),
        'on-background': tok('--on-background'),
        surface: tok('--surface'),
        'on-surface': tok('--on-surface'),
        'on-surface-variant': tok('--on-surface-variant'),
        'surface-dim': tok('--surface-dim'),
        'surface-bright': tok('--surface-bright'),
        'surface-container-lowest': tok('--surface-container-lowest'),
        'surface-container-low': tok('--surface-container-low'),
        'surface-container': tok('--surface-container'),
        'surface-container-high': tok('--surface-container-high'),
        'surface-container-highest': tok('--surface-container-highest'),
        'surface-variant': tok('--surface-variant'),
        outline: tok('--outline'),
        'outline-variant': tok('--outline-variant'),
      },
      spacing: {
        base: '4px',
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '48px',
      },
      borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', full: '9999px' },
      fontFamily: {
        display: ['Geist Variable', 'sans-serif'],
        body: ['Inter Variable', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
