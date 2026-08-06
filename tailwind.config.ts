import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic surface colors — driven by CSS variables so warm/dark
        // themes switch without rebuilding Tailwind.
        background: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-raised': 'var(--raised)',
        'surface-hover': 'var(--hover, var(--raised))',
        border: 'var(--border)',
        line: 'var(--line)',

        // Text hierarchy
        foreground: 'var(--text)',
        'foreground-sub': 'var(--sub)',
        'foreground-muted': 'var(--muted)',
        'foreground-dim': 'var(--dim)',

        // Semantic status colors
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        info: 'var(--blue, #60a5fa)',

        // Accent
        accent: 'var(--accent, #818cf8)',
        'accent-muted': 'var(--accent-muted, rgba(129, 140, 248, 0.15))',

        // Legacy t-* aliases — kept temporarily for the finance/ components
        // that still reference them. Remove once those are migrated/removed.
        t: {
          bg:      'var(--bg)',
          surface: 'var(--surface)',
          raised:  'var(--raised)',
          hover:   'var(--raised)',
          border:  'var(--border)',
          line:    'var(--line)',
          text:    'var(--text)',
          sub:     'var(--sub)',
          muted:   'var(--muted)',
          dim:     'var(--dim)',
          green:   'var(--success)',
          'green-bg': 'rgba(6, 214, 160, 0.08)',
          red:     'var(--error)',
          'red-bg': 'rgba(239, 68, 68, 0.08)',
          amber:   'var(--warning)',
          blue:    'var(--blue, #60a5fa)',
          'blue-bg': 'rgba(96, 165, 250, 0.08)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: '9999px',
      },
      animation: {
        'slide-up':   'slideUp 0.25s ease-out forwards',
        'fade-in':    'fadeIn 0.2s ease-out forwards',
        'count-up':   'countUp 0.5s ease-out forwards',
        'fill-bar':   'fillBar 1s ease-out forwards',
        'slide-in-right': 'slideInRight 0.2s ease-out forwards',
      },
      keyframes: {
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        countUp: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fillBar: {
          '0%':   { width: '0%' },
          '100%': { width: 'var(--fill-width)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
