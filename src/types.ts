export type GameMode = 'wordbomb' | 'synonym' | 'quick_recall';
export type GameStatus = 'lobby' | 'playing' | 'finished';

export interface Profile {
  id: string;
  display_name: string;
  generated_name: string;
  avatar_seed: string;
}

export interface VocabularyList {
  id: string;
  user_id: string;
  name: string;
  word_count?: number;
}

export interface VocabularyItem {
  id: string;
  list_id: string;
  norwegian: string;
  english: string;
  explanation?: string;
}

export interface GameSettings {
  listId?: string;
  wordCount?: number;
  timerSeconds?: number;
  maxHearts?: number;
  showExplanations?: boolean;
}

export interface GameState {
  id: string;
  mode: GameMode;
  status: GameStatus;
  host_id: string;
  settings: GameSettings;
  current_player_id?: string;
  current_question?: any;
  timer_state?: number;
}

export interface GamePlayer {
  id: string;
  game_id: string;
  user_id: string;
  display_name: string;
  hearts: number;
  eliminated: boolean;
  spectator: boolean;
  score: number;
}
