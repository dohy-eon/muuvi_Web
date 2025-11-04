/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          50: "#f0f2f4",
          100: "#e4e7e9",
          200: "#d7dbde",
          300: "#c7cbcf",
          400: "#a8adb3",
          500: "#8c9197",
          600: "#6d7278",
          700: "#505459",
          800: "#333538",
          900: "#1a1a1c",
        },
        primary: {
          100: "#f1f0fa",
          200: "#dedbf5",
          300: "#c4c1ed",
          400: "#a9a6e2",
          500: "#8f8cd5",
          600: "#7573c0",
          700: "#5c5aa8",
          800: "#44438a",
          900: "#2e2c6a",
        },
        secondary: "#7a8dd6",
        tertiary: "#63579d",
        white: "#ffffff",
      },
    },
  },
  plugins: [],
}