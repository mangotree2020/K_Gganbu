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
          teal: '#0D9488',
        },
        bm: {
          blue: { 50: '#0EA5E9', 40: '#0284C7', 30: '#0369A1', 90: '#E0F2FE', 95: '#F0F9FF' },
          coral: { 50: '#F97316', 40: '#EA580C', 30: '#C2410C', 90: '#FFEDD5', 95: '#FFF7ED' },
          teal: { 40: '#0D9488', 30: '#0F766E', 90: '#CCFBF1', 95: '#F0FDFA' },
          amber: { 50: '#F59E0B', 90: '#FEF3C7' },
          cruise: '#1D4ED8',
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
        '2xl': '18px',
        '3xl': '22px',
        '4xl': '32px',
      },
    },
  },
  plugins: [],
}
