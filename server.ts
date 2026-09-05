import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = 3000;
app.use(express.json());

// Initialize Supabase admin client (if keys are available)
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

// Game Loop state
const activeTimeouts = new Map<string, NodeJS.Timeout>();

async function nextTurn(gameId: string) {
  if (!supabase) return;

  const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
  const { data: players } = await supabase.from('game_players').select('*').eq('game_id', gameId);
  
  if (!game || !players) return;

  const activePlayers = players.filter(p => !p.spectator && !p.eliminated).sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  const totalPlayers = players.filter(p => !p.spectator);
  
  if (activePlayers.length === 0) {
    // Everyone lost, game over
    await supabase.from('games').update({ status: 'finished' }).eq('id', gameId);
    if (activeTimeouts.has(gameId)) clearTimeout(activeTimeouts.get(gameId)!);
    return;
  } else if (activePlayers.length === 1 && totalPlayers.length > 1) {
    // Multiplayer game, one player remains -> Winner!
    await supabase.from('games').update({ status: 'finished' }).eq('id', gameId);
    if (activeTimeouts.has(gameId)) clearTimeout(activeTimeouts.get(gameId)!);
    return;
  }

  let nextPlayerIndex = 0;
  if (game.current_player_id) {
     const currentIndex = activePlayers.findIndex(p => p.user_id === game.current_player_id);
     if (currentIndex !== -1) {
       nextPlayerIndex = (currentIndex + 1) % activePlayers.length;
     }
  }
  const nextPlayer = activePlayers[nextPlayerIndex];

  let words: any[] = [{ norwegian: 'Hund', english: 'Dog', explanation: '' }, { norwegian: 'Katt', english: 'Cat', explanation: '' }, { norwegian: 'Fotosyntese', english: 'Photosynthesis', explanation: '' }];
  
  if (game.mode === 'synonym') {
     // For synonym mode, pick a random common English word to find synonyms for
     const seedWords = ["happy", "sad", "fast", "slow", "big", "small", "good", "bad", "hot", "cold", "angry", "calm", "smart", "stupid", "rich", "poor", "strong", "weak"];
     const randomSeed = seedWords[Math.floor(Math.random() * seedWords.length)];
     const timerMs = (game.settings.timerSeconds || 10) * 1000;
     const expiresAt = Date.now() + timerMs;
     
     await supabase.from('games').update({
        current_player_id: nextPlayer.user_id,
        current_question: { word: randomSeed, answer: '', explanation: 'Type a valid synonym' },
        timer_state: expiresAt,
        status: 'playing'
     }).eq('id', gameId);
     
     if (activeTimeouts.has(gameId)) clearTimeout(activeTimeouts.get(gameId)!);
     const timeout = setTimeout(async () => {
        const { data: p } = await supabase.from('game_players').select('*').eq('game_id', gameId).eq('user_id', nextPlayer.user_id).single();
        if (p && !p.eliminated) {
           const newHearts = Math.max(0, p.hearts - 1);
           await supabase.from('game_players').update({ hearts: newHearts, eliminated: newHearts === 0 }).eq('id', p.id);
        }
        nextTurn(gameId);
     }, timerMs);
     activeTimeouts.set(gameId, timeout);
     return;
  }

  // Standard WordBomb or QuickRecall modes
  if (game.settings?.listId) {
     const { data: listWords } = await supabase.from('vocabulary_items')
        .select('*')
        .eq('list_id', game.settings.listId)
        // If wordCount is set and not 999, we theoretically want to randomly sample, 
        // but for simplicity in SQL we'll limit. In a real app we'd fetch all and shuffle, or sample.
        .limit(game.settings.wordCount === 999 ? 1000 : (game.settings.wordCount || 10));
     
     if (listWords && listWords.length > 0) words = listWords;
  }
  
  const randomWord = words[Math.floor(Math.random() * words.length)];
  const direction = Math.random() > 0.5 ? 'no-en' : 'en-no';
  const question = {
     word: direction === 'no-en' ? randomWord.norwegian : randomWord.english,
     answer: direction === 'no-en' ? randomWord.english : randomWord.norwegian,
     explanation: randomWord.explanation
  };

  const timerMs = (game.settings.timerSeconds || 10) * 1000;
  const expiresAt = game.mode === 'flashcards' ? null : Date.now() + timerMs;

  await supabase.from('games').update({
     current_player_id: nextPlayer.user_id,
     current_question: question,
     timer_state: expiresAt,
     status: 'playing'
  }).eq('id', gameId);

  if (activeTimeouts.has(gameId)) clearTimeout(activeTimeouts.get(gameId)!);
  
  if (game.mode !== 'flashcards') {
  const timeout = setTimeout(async () => {
     // BOOM
     const { data: p } = await supabase.from('game_players').select('*').eq('game_id', gameId).eq('user_id', nextPlayer.user_id).single();
     if (p && !p.eliminated) {
        const newHearts = Math.max(0, p.hearts - 1);
        await supabase.from('game_players').update({ 
           hearts: newHearts, 
           eliminated: newHearts === 0 
        }).eq('id', p.id);
     }
     nextTurn(gameId);
  }, timerMs);
  
  activeTimeouts.set(gameId, timeout);
  }
}

// Datamuse API wrapper
async function fetchSynonyms(word: string): Promise<string[]> {
  try {
    const res = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}`);
    const data = await res.json() as {word: string}[];
    return data.map(d => d.word.toLowerCase());
  } catch (e) {
    console.error("Datamuse error:", e);
    return [];
  }
}

// Ensure synonyms are cached
async function getValidSynonyms(word: string): Promise<string[]> {
  if (!supabase) return [];
  const lowerWord = word.toLowerCase();
  
  const { data: cache } = await supabase.from('synonym_cache').select('synonyms').eq('word', lowerWord).single();
  if (cache) {
    return cache.synonyms;
  }

  const synonyms = await fetchSynonyms(lowerWord);
  if (synonyms.length > 0) {
    await supabase.from('synonym_cache').insert({ word: lowerWord, synonyms, source: 'datamuse' });
  }
  return synonyms;
}

// API Routes (Simulating Edge Functions)
app.post("/api/start-game", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  const { gameId } = req.body;
  await nextTurn(gameId);
  res.json({ success: true });
});

app.post("/api/validate-synonym", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  const { gameId, answer, word } = req.body;
  
  const validSynonyms = await getValidSynonyms(word);
  const isCorrect = validSynonyms.includes(answer.toLowerCase().trim());
  
  if (isCorrect) {
    await nextTurn(gameId);
    res.json({ correct: true });
  } else {
    res.json({ correct: false });
  }
});

app.post("/api/skip-turn", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  const { gameId } = req.body;
  await nextTurn(gameId);
  res.json({ success: true });
});

app.post("/api/validate-wordbomb", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  const { gameId, answer, expected } = req.body;
  
  const isCorrect = answer.toLowerCase().trim() === expected.toLowerCase().trim();
  
  if (isCorrect) {
    await nextTurn(gameId);
    res.json({ correct: true });
  } else {
    res.json({ correct: false });
  }
});


async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
