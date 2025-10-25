<script setup lang="ts">
import { ref } from "vue";
import { z } from "zod";
import { supabase } from "./supabase";
import type { IngestPayload, IngestEvent } from "./types";

const rawJson = ref("");
const busy = ref(false);
const toast = ref<{type:"ok"|"err", msg:string}|null>(null);

// Zod validator (minimal)
const EventZ = z.object({
  minute: z.number().int().nonnegative(),
  period: z.enum(["1H","2H","ET","PEN"]).optional(),
  team: z.enum(["home","away"]),
  event_type: z.enum(["goal","penalty","own_goal","yellow","red","sub_in","sub_out","corner","offside"]),
  player_name: z.string().optional(),
  player_in: z.string().optional(),
  player_out: z.string().optional(),
  assist: z.string().optional(),
  score_after: z.string().optional(),
  raw_text: z.string().optional()
});
const PayloadZ = z.object({
  country: z.string().min(2),
  country_code: z.string().optional(),
  league: z.string().min(2),
  season: z.string().min(4),
  date: z.string().optional(),
  home_team: z.string().min(1),
  away_team: z.string().min(1),
  score_ht: z.string().optional(),
  score_ft: z.string().optional(),
  stats: z.object({
    shots_home: z.number().optional(),
    shots_away: z.number().optional(),
    corners_home: z.number().optional(),
    corners_away: z.number().optional(),
    possession_home: z.number().optional(),
    possession_away: z.number().optional()
  }).optional(),
  events: z.array(EventZ),
  features_ht: z.record(z.any()).optional()
});

function countBy(events: IngestEvent[], team: "home" | "away", type: string) {
  return events.filter(e => e.team === team && e.event_type === type).length;
}

async function upsertCountry(name: string, code?: string) {
  const { data } = await supabase
    .from("countries").select("id").eq("name", name).maybeSingle();
  if (data) return data.id;

  const { data: ins, error } = await supabase
    .from("countries").insert([{ name, code: code ?? name.slice(0,3).toUpperCase() }]).select("id").single();
  if (error) throw error;
  return ins.id;
}

async function upsertLeague(country_id: number, name: string, season: string) {
  const { data } = await supabase
    .from("leagues").select("id")
    .eq("country_id", country_id).eq("name", name).eq("season", season)
    .maybeSingle();
  if (data) return data.id;

  const { data: ins, error } = await supabase
    .from("leagues").insert([{ country_id, name, season }]).select("id").single();
  if (error) throw error;
  return ins.id;
}

async function ingest() {
  toast.value = null;
  busy.value = true;
  try {
    const parsed = PayloadZ.parse(JSON.parse(rawJson.value)) as IngestPayload;

    // 1) Country & League
    const countryId = await upsertCountry(parsed.country, parsed.country_code);
    const leagueId = await upsertLeague(countryId, parsed.league, parsed.season);

    // 2) Derived counts from events (robuste când OCR nu are agregate)
    const goals_home = countBy(parsed.events, "home", "goal") + countBy(parsed.events, "home", "penalty") + countBy(parsed.events, "home", "own_goal");
    const goals_away = countBy(parsed.events, "away", "goal") + countBy(parsed.events, "away", "penalty") + countBy(parsed.events, "away", "own_goal");
    const yellow_home = countBy(parsed.events, "home", "yellow");
    const yellow_away = countBy(parsed.events, "away", "yellow");
    const red_home = countBy(parsed.events, "home", "red");
    const red_away = countBy(parsed.events, "away", "red");

    // 3) Insert match
    const matchRow: any = {
      league_id: leagueId,
      date: parsed.date ?? null,
      country: parsed.country,
      league: parsed.league,
      home_team: parsed.home_team,
      away_team: parsed.away_team,
      score_ht: parsed.score_ht ?? null,
      score_ft: parsed.score_ft ?? null,
      goals_home, goals_away,
      yellow_home, yellow_away,
      red_home, red_away,
      shots_home: parsed.stats?.shots_home ?? 0,
      shots_away: parsed.stats?.shots_away ?? 0,
      corners_home: parsed.stats?.corners_home ?? 0,
      corners_away: parsed.stats?.corners_away ?? 0,
      possession_home: parsed.stats?.possession_home ?? null,
      possession_away: parsed.stats?.possession_away ?? null,
      events_json: parsed.events
    };

    const { data: matchIns, error: matchErr } = await supabase
      .from("matches").insert([matchRow]).select("id").single();
    if (matchErr) throw matchErr;
    const match_id = matchIns.id as number;

    // 4) Insert events (batch)
    if (parsed.events?.length) {
      const eventsPayload = parsed.events.map(e => ({
        match_id,
        minute: e.minute,
        period: e.period ?? (e.minute <= 45 ? "1H" : "2H"),
        team: e.team,
        event_type: e.event_type,
        player_name: e.player_name ?? null,
        player_in: e.player_in ?? null,
        player_out: e.player_out ?? null,
        assist: e.assist ?? null,
        score_after: e.score_after ?? null,
        raw_text: e.raw_text ?? null
      }));
      const { error: evErr } = await supabase.from("events").insert(eventsPayload);
      if (evErr) throw evErr;
    }

    // 5) Optional features_ht
    if (parsed.features_ht && Object.keys(parsed.features_ht).length) {
      const { error: fErr } = await supabase
        .from("features_ht").insert([{ match_id, ...parsed.features_ht }]);
      if (fErr) throw fErr;
    }

    toast.value = { type: "ok", msg: "Date salvate în Supabase. GG! 🎉" };
    rawJson.value = "";
  } catch (e: any) {
    console.error(e);
    toast.value = { type: "err", msg: e?.message ?? "Eroare necunoscută." };
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen pb-20 md:pb-0">
    <!-- Header -->
    <header class="sticky top-0 z-20 backdrop-blur-md bg-black/30 border-b border-white/10">
      <div class="mx-auto max-w-xl px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center shadow-neon">⚡</div>
          <div>
            <h1 class="text-xl font-semibold tracking-wide">QBetX</h1>
            <p class="text-xs text-white/60 -mt-1">Upload & Save JSON</p>
          </div>
        </div>
        <span class="text-primary/90 text-sm">PWA</span>
      </div>
    </header>

    <!-- Content -->
    <section class="mx-auto max-w-xl px-4 pt-6 space-y-6">
      <!-- Card -->
      <div class="card">
        <h2 class="text-lg font-medium mb-3">📤 Lipește JSON-ul de meci</h2>
        <p class="text-white/70 text-sm mb-4">
          Lipește mai jos JSON-ul generat în ChatGPT din pozele cu timeline-ul. Apoi apasă <b>Trimite în Supabase</b>.
        </p>
        <textarea class="input min-h-[260px] font-mono text-sm" v-model="rawJson" placeholder='{
  "country": "England",
  "league": "Premier League",
  "season": "2024-2025",
  "date": "2025-05-18",
  "home_team": "Nottingham Forest",
  "away_team": "Chelsea",
  "score_ht": "0-0",
  "score_ft": "0-3",
  "events": [
    { "minute": 49, "team": "away", "event_type": "goal", "player_name": "Josh Acheampong", "assist": "Pedro Neto", "score_after": "0-1" },
    { "minute": 52, "team": "away", "event_type": "goal", "player_name": "Pedro Neto", "assist": "Reece James", "score_after": "0-2" },
    { "minute": 80, "team": "home", "event_type": "yellow", "player_name": "Ibrahim Sangaré" },
    { "minute": 90, "team": "away", "event_type": "goal", "player_name": "Reece James", "score_after": "0-3" }
  ]
}'></textarea>

        <div class="mt-4 flex gap-3">
          <button class="btn" :disabled="busy" @click="ingest">
            <span v-if="!busy">Trimite în Supabase</span>
            <span v-else>Se salvează…</span>
          </button>
          <button class="btn border-white/20" :disabled="busy" @click="rawJson = ''">Curăță</button>
        </div>
      </div>

      <!-- Roadmap / Disabled tabs preview -->
      <div class="grid grid-cols-2 gap-4">
        <div class="card opacity-70">
          <div class="text-white/70 text-sm">📊 Stats & Patterns (curând)</div>
        </div>
        <div class="card opacity-70">
          <div class="text-white/70 text-sm">🧠 Predictii ML (curând)</div>
        </div>
      </div>
    </section>

    <!-- Toast -->
    <transition name="fade">
      <div v-if="toast" class="fixed bottom-5 inset-x-0 mx-auto max-w-xs glass rounded-2xl px-4 py-3 border"
           :class="toast.type==='ok' ? 'border-emerald-400/50 shadow-neon' : 'border-rose-400/50 shadow-neon'">
        <p class="text-center text-sm">{{ toast.msg }}</p>
      </div>
    </transition>
  </main>
</template>

<style scoped>
.fade-enter-active,.fade-leave-active { transition: opacity .25s }
.fade-enter-from,.fade-leave-to { opacity: 0 }
</style>
