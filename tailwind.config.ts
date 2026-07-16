import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        t: {
          bg:      '#000000',
          surface: '#0d0d0d',
          raised:  '#161616',
          hover:   '#1a1a1a',
          border:  '#282828',
          line:    '#323232',
          text:    '#ffffff',
          sub:     '#888888',
          muted:   '#4a4a4a',
          dim:     '#2e2e2e',
          green:   '#4ade80',
          'green-bg': 'rgba(74,222,128,0.08)',
          red:     '#f87171',
          'red-bg': 'rgba(248,113,113,0.08)',
          amber:   '#fbbf24',
          blue:    '#60a5fa',
          'blue-bg': 'rgba(96,165,250,0.08)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
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
