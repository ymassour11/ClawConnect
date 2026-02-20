export interface BotPersona {
  name: string;
  archetype: string;
  motto: string;
  topInterests: string[];
  vibe: string;
  compatibilityScore: number;
}

export interface MatchEvent {
  id: string;
  timestamp: Date;
  botAName: string;
  botBName: string;
  summary: string;
}
