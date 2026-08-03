/**
 * Tailwind CSS configuration
 */

import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    // Shared UI ships as source, so its classes must be scanned too.
    '../../packages/lao/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── LAO brand tokens ──────────────────────────────────────────────
        // Derived from the master logo. See /brand/colors/palette.md.
        // Use these rather than hardcoding hex or reaching for slate-*.
        brand: {
          blue: '#1E6FEB', // primary action
          sky: '#22B4F5',
          magenta: '#E8256B',
          orange: '#F5911E',
          purple: '#7B33D6',
          green: '#1FA85C', // success only
          yellow: '#F5C518',
        },
        ink: {
          DEFAULT: '#12225C', // headings — the "ACADEMY" navy
          body: '#2C3660',
          muted: '#6B7495',
          faint: '#9AA1B8', // decorative only, fails AA for text
        },
        surface: {
          DEFAULT: '#FFFFFF', // the page background. Not grey.
          raised: '#FFFFFF',
          sunken: '#F7F8FB',
        },
        hairline: {
          DEFAULT: '#E8EAF0',
          strong: '#D3D8E4',
        },
        // The four journey stages, from the logo lockup.
        stage: {
          learn: '#1E88E5',
          build: '#22A85A',
          launch: '#7B3FE4',
          earn: '#F57C20',
        },
        success: '#1FA85C',
        warning: '#F5911E',
        danger: '#D92D40',

        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        // See /brand/brand-guidelines.md §4
        card: '12px',
        control: '10px',
      },
      boxShadow: {
        // One soft elevation. Use a border or this shadow, never both.
        soft: '0 1px 2px rgba(18,34,92,.04), 0 4px 16px rgba(18,34,92,.06)',
      },
      maxWidth: {
        // Prose caps at a readable measure — see /brand/typography.
        prose: '68ch',
      },
      backgroundImage: {
        // The brand rule: a 2px hairline, at most once per page.
        'brand-rule':
          'linear-gradient(90deg, #22B4F5, #1E6FEB, #7B33D6, #E8256B, #F5911E)',
      },
    },
  },
  plugins: [],
};

export default config;
