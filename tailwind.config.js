export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        primary: "#00F0FF",
        midnight: "#0b0f1a",
        glass: "rgba(255,255,255,0.06)"
      },
      boxShadow: {
        neon: "0 0 20px rgba(0,240,255,.35), 0 0 40px rgba(0,240,255,.15)"
      },
      backdropBlur: { xs: "2px" }
    }
  },
  plugins: []
};
