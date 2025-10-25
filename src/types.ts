export type IngestEvent = {
  minute: number;
  period?: "1H" | "2H" | "ET" | "PEN";
  team: "home" | "away";
  event_type: "goal" | "penalty" | "own_goal" | "yellow" | "red" | "sub_in" | "sub_out" | "corner" | "offside";
  player_name?: string;
  player_in?: string;
  player_out?: string;
  assist?: string;
  score_after?: string;
  raw_text?: string;
};

export type IngestPayload = {
  country: string;
  country_code?: string;
  league: string;
  season: string;
  date?: string; // "YYYY-MM-DD"
  home_team: string;
  away_team: string;
  score_ht?: string; // "0-0"
  score_ft?: string; // "0-3"
  stats?: {
    shots_home?: number; shots_away?: number;
    corners_home?: number; corners_away?: number;
    possession_home?: number; possession_away?: number;
  };
  events: IngestEvent[];
  features_ht?: Record<string, any>; // opțional
};
