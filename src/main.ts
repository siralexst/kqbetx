import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";

createApp(App).mount("#app");

// PWA SW
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/src-sw.js").catch(() => {});
  });
}
