import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      // -- design tokens ---------------------------------------------------
      colors: {
        // base surfaces
        bg: {
          DEFAULT: "hsl(var(--bg))",
          subtle: "hsl(var(--bg-subtle))",
          elevated: "hsl(var(--bg-elevated))",
        },
        ink: {
          DEFAULT: "hsl(var(--ink))",
          dim: "hsl(var(--ink-dim))",
          mute: "hsl(var(--ink-mute))",
        },
        line: "hsl(var(--line))",
        // accents (agri-tech palette: harvest amber, leaf, deep field)
        leaf: { DEFAULT: "hsl(var(--leaf))", soft: "hsl(var(--leaf-soft))" },
        amber: { DEFAULT: "hsl(var(--amber))", soft: "hsl(var(--amber-soft))" },
        rust: { DEFAULT: "hsl(var(--rust))", soft: "hsl(var(--rust-soft))" },
        plum: { DEFAULT: "hsl(var(--plum))", soft: "hsl(var(--plum-soft))" },
        sky: { DEFAULT: "hsl(var(--sky))", soft: "hsl(var(--sky-soft))" },
        // semantic
        ring: "hsl(var(--ring))",
        // shadcn compat
        border: "hsl(var(--line))",
        input: "hsl(var(--line))",
        background: "hsl(var(--bg))",
        foreground: "hsl(var(--ink))",
        primary: { DEFAULT: "hsl(var(--leaf))", foreground: "hsl(var(--bg))" },
        secondary: { DEFAULT: "hsl(var(--bg-elevated))", foreground: "hsl(var(--ink))" },
        muted: { DEFAULT: "hsl(var(--bg-subtle))", foreground: "hsl(var(--ink-dim))" },
        accent: { DEFAULT: "hsl(var(--amber))", foreground: "hsl(var(--bg))" },
        destructive: { DEFAULT: "hsl(var(--rust))", foreground: "hsl(var(--bg))" },
        card: { DEFAULT: "hsl(var(--bg-elevated))", foreground: "hsl(var(--ink))" },
        popover: { DEFAULT: "hsl(var(--bg-elevated))", foreground: "hsl(var(--ink))" },
      },
      fontFamily: {
        // Body: IBM Plex Sans — strong Cyrillic, slight industrial voice.
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        // Display: Fraunces — variable serif tuned for headlines & editorial.
        display: ['"Fraunces"', '"IBM Plex Serif"', "ui-serif", "Georgia", "serif"],
        // Mono: tabular figures and IDs.
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        glass: "0 1px 0 0 hsl(var(--line) / 0.6), 0 8px 24px -8px hsl(0 0% 0% / 0.6)",
        glow: "0 0 0 1px hsl(var(--leaf) / 0.4), 0 8px 32px -4px hsl(var(--leaf) / 0.25)",
        amber: "0 0 0 1px hsl(var(--amber) / 0.4), 0 8px 32px -4px hsl(var(--amber) / 0.25)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-ring": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.6" },
          "50%": { transform: "scale(1.05)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out",
        shimmer: "shimmer 6s linear infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      backgroundImage: {
        "noise":
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='1' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.08 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        "grid-line":
          "linear-gradient(hsl(var(--line)/0.4) 1px,transparent 1px), linear-gradient(90deg,hsl(var(--line)/0.4) 1px,transparent 1px)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
