import type { Config } from "tailwindcss";
import sharedPreset from "../../packages/ui/tailwind-preset";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [sharedPreset],
};

export default config;

