import colors from "tailwindcss/colors";
// import typography from '@tailwindcss/typography';
// import forms from '@tailwindcss/forms';
// import patterns from '@danielfgray/tw-heropatterns'

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{html,js,ts,jsx,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        primary: colors.zinc,
        gray: colors.neutral,
      },
    },
  },
  plugins: [
    // typography,
    // forms({ strategy: 'class' }),
    // patterns,
  ],
};
