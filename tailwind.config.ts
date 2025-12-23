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
        // Folio Design System
        sage: {
          DEFAULT: '#A8D5BA',  // Primary Sage Green
          dark: '#6B9080',     // Forest Sage
          light: '#D4F4DD',    // Mint Glow
        },
        peach: {
          DEFAULT: '#F4A261',  // Warm Peach (Accent)
          dark: '#E76F51',     // Burnt Orange
        },
        folio: {
          bg: {
            light: '#F9FBF8',  // Warm White
            dark: '#1A1F1E',   // Deep Charcoal
          },
          text: {
            primary: {
              light: '#000000',
              dark: '#FAFAFA',
            },
            secondary: {
              light: '#6B7280',
              dark: '#9CA3AF',
            },
          },
        },
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      animation: {
        'count-up': 'countUp 1s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'scale-tap': 'scaleTap 0.15s ease-out',
        'liquid-fill': 'liquidFill 1.5s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'glow': 'glow 0.3s ease-out',
        'confetti': 'confetti 0.5s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleTap: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        liquidFill: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--fill-width)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 0 0 rgba(168, 213, 186, 0.4)' },
          '100%': { boxShadow: '0 0 20px 5px rgba(168, 213, 186, 0.2)' },
        },
        confetti: {
          '0%': { transform: 'scale(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(360deg)', opacity: '0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
