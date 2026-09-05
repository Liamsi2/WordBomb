-- Supabase Schema for WordBomb 2.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT NOT NULL,
  generated_name TEXT NOT NULL,
  avatar_seed TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VOCABULARY LISTS
CREATE TABLE vocabulary_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VOCABULARY ITEMS
CREATE TABLE vocabulary_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID REFERENCES vocabulary_lists(id) ON DELETE CASCADE,
  norwegian TEXT NOT NULL,
  english TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GAMES
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mode TEXT NOT NULL, -- 'wordbomb', 'synonym', 'quick_recall'
  status TEXT NOT NULL DEFAULT 'lobby', -- 'lobby', 'playing', 'finished'
  host_id UUID REFERENCES profiles(id),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_player_id UUID REFERENCES profiles(id),
  current_question JSONB,
  timer_state FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GAME PLAYERS
CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  display_name TEXT NOT NULL,
  hearts INTEGER DEFAULT 3,
  eliminated BOOLEAN DEFAULT FALSE,
  spectator BOOLEAN DEFAULT FALSE,
  score INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);

-- SYNONYM CACHE
CREATE TABLE synonym_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word TEXT UNIQUE NOT NULL,
  synonyms JSONB NOT NULL, -- Array of strings
  source TEXT DEFAULT 'datamuse',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (simplified for this preview)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE synonym_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for game playing) and authenticated insert/update
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Vocabulary lists are public for games" ON vocabulary_lists FOR SELECT USING (true);
CREATE POLICY "Users can manage their lists" ON vocabulary_lists FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Vocabulary items are public for games" ON vocabulary_items FOR SELECT USING (true);
CREATE POLICY "Users can manage their items" ON vocabulary_items FOR ALL USING (
  EXISTS (SELECT 1 FROM vocabulary_lists WHERE id = vocabulary_items.list_id AND user_id = auth.uid())
);

CREATE POLICY "Games are viewable by everyone" ON games FOR SELECT USING (true);
CREATE POLICY "Anyone can create or update games" ON games FOR ALL USING (true);

CREATE POLICY "Game players viewable by everyone" ON game_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join games" ON game_players FOR ALL USING (true);

CREATE POLICY "Cache is publicly readable" ON synonym_cache FOR SELECT USING (true);
CREATE POLICY "Cache insertable by server" ON synonym_cache FOR ALL USING (true); -- Ideally restricted to service role
