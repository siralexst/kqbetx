<template>
  <main class="min-h-screen flex flex-col items-center justify-start p-6 text-white bg-gradient-to-b from-[#030712] to-[#0a0f1f]">
    <div class="w-full max-w-lg bg-[#0e1629]/70 backdrop-blur-xl rounded-3xl shadow-[0_0_30px_rgba(0,255,255,0.15)] p-6 mt-10 border border-cyan-500/20">
      <h1 class="text-3xl font-bold text-cyan-400 text-center mb-2">QBetX</h1>
      <p class="text-center text-gray-400 mb-6">Upload & Save JSON</p>

      <h2 class="text-lg font-semibold mb-2 text-cyan-300">📋 Lipește JSON-ul de meci</h2>
      <p class="text-sm text-gray-400 mb-4">
        Lipește mai jos <strong>JSON-ul generat în ChatGPT</strong> din pozele cu timeline-ul. <br />
        Apoi apasă <strong>Trimite în Supabase</strong>.
      </p>

      <textarea
        v-model="jsonInput"
        placeholder='{"country":"", "league":"", ... }'
        class="w-full h-64 p-3 rounded-xl bg-[#111a2f] text-white text-sm font-mono border border-cyan-500/30 focus:border-cyan-400 focus:outline-none resize-none"
      ></textarea>

      <div class="flex justify-center gap-4 mt-6">
        <button
          @click="submitToSupabase"
          :disabled="loading"
          class="px-6 py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold shadow-[0_0_15px_rgba(0,255,255,0.5)] transition disabled:opacity-50"
        >
          {{ loading ? "Se trimite..." : "Trimite în Supabase" }}
        </button>
        <button
          @click="clearInput"
          class="px-6 py-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-semibold transition"
        >
          Curăță
        </button>
      </div>

      <p v-if="message" class="text-center mt-4" :class="messageColor">
        {{ message }}
      </p>
    </div>

    <div class="flex justify-center gap-4 mt-10">
      <button class="px-6 py-2 rounded-xl bg-[#1a2238] text-gray-400 shadow-inner">📊 Stats & Patterns (curând)</button>
      <button class="px-6 py-2 rounded-xl bg-[#1a2238] text-gray-400 shadow-inner">🧠 Predictii ML (curând)</button>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { createClient } from "@supabase/supabase-js";

// 🔗 Conectare directă la Supabase
const supabaseUrl = "https://hgvimvswbzvhtuaszwqv.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhndmltdnN3Ynp2aHR1YXN6d3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Njg5MDcsImV4cCI6MjA3NjI0NDkwN30.vHtdIuMKCU5Su3ZoMbVLlKKSl3Xd0zxr0lmrG1kPiXc";
const supabase = createClient(supabaseUrl, supabaseKey);

// 🌙 State
const jsonInput = ref("");
const message = ref("");
const messageColor = ref("");
const loading = ref(false);

function clearInput() {
  jsonInput.value = "";
  message.value = "";
}

// 🚀 Trimite JSON în Supabase
async function submitToSupabase() {
  try {
    loading.value = true;
    message.value = "";

    // 🧹 Normalizează textul JSON din orice sursă (Safari, PWA, Desktop etc.)
    let cleanedInput = jsonInput.value
      .replace(/[“”]/g, '"') // smart quotes
      .replace(/[‘’]/g, "'") // smart apostrophes
      .replace(/\u200B/g, "") // zero-width space
      .replace(/\u2028/g, "") // line separator
      .replace(/\u2029/g, "") // paragraph separator
      .replace(/\r/g, "")
      .trim();

    // 🧠 Verificare simplă (lipsește acolada de început?)
    if (!cleanedInput.startsWith("{") && !cleanedInput.startsWith("[")) {
      throw new Error("⚠️ Format invalid: lipsește '{' la începutul JSON-ului.");
    }

    // 🧩 Încearcă parsarea
    const parsed = JSON.parse(cleanedInput);

    // Fallback date dacă e null/gol
    if (!parsed.date || parsed.date.trim?.() === "") {
      const today = new Date().toISOString().slice(0, 10);
      parsed.date = today;
    }

    // Validare minimală (match + events)
    if (!parsed.country || !parsed.league || !parsed.home_team || !parsed.away_team) {
      throw new Error("Câmpuri lipsă: country, league, home_team, away_team.");
    }
    if (!Array.isArray(parsed.events) || parsed.events.length === 0) {
      throw new Error("Lista de evenimente este goală.");
    }

    // 🔹 Inserare în matches
    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .insert([
        {
          country: parsed.country,
          league: parsed.league,
          season: parsed.season,
          date: parsed.date,
          home_team: parsed.home_team,
          away_team: parsed.away_team,
          score_ht: parsed.score_ht,
          score_ft: parsed.score_ft,
        },
      ])
      .select("id")
      .single();

    if (matchError) throw matchError;

    // 🔹 Inserare în events
    const events = parsed.events.map((e: any) => ({
      match_id: matchData.id,
      minute: e.minute,
      period: e.period,
      team: e.team,
      event_type: e.event_type,
    }));

    const { error: eventError } = await supabase.from("events").insert(events);
    if (eventError) throw eventError;

    message.value = "✅ Datele au fost salvate cu succes în Supabase!";
    messageColor.value = "text-green-400";
  } catch (err: any) {
    console.error(err);
    message.value = "❌ Eroare: " + (err.message || "Verifică structura JSON.");
    messageColor.value = "text-red-400";
  } finally {
    loading.value = false;
  }
}
</script>
