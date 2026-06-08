/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0EA5E9',
          orange: '#F97316',
        },
        primary: {
          DEFAULT: '#0EA5E9',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#F1F5F9',
          foreground: '#0F172A',
        },
        background: '#FFFFFF',
        foreground: '#0F172A',
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#64748B',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        border: '#E2E8F0',
        input: '#E2E8F0',
        ring: '#0EA5E9',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },
        accent: {
          DEFAULT: '#F1F5F9',
          foreground: '#0F172A',
        },
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '4px',
        '4xl': '32px',
      },
    },
  },
  plugins: [],
}
