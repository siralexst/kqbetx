import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hgvimvswbzvhtuaszwqv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhndmltdnN3Ynp2aHR1YXN6d3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Njg5MDcsImV4cCI6MjA3NjI0NDkwN30.vHtdIuMKCU5Su3ZoMbVLlKKSl3Xd0zxr0lmrG1kPiXc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
