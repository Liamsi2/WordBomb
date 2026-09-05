import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Play, Settings2, ChevronLeft } from 'lucide-react';
import { GameState, GamePlayer } from '../types';

export default function GameLobby({ gameId }: { gameId: string | null }) {
  const [game, setGame] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [lists, setLists] = useState<any[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('wb_profile');
    if (stored) setProfile(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (!profile || !supabase) return;
    const fetchLists = async () => {
      const { data } = await supabase.from('vocabulary_lists').select('*').eq('user_id', profile.id);
      if (data) setLists(data);
    };
    fetchLists();
  }, [profile]);

  useEffect(() => {
    if (!gameId || !supabase || !profile) return;

    const fetchLobby = async () => {
      const { data: gameData } = await supabase.from('games').select('*').eq('id', gameId).single();
      const { data: playersData } = await supabase.from('game_players').select('*').eq('game_id', gameId);
      if (gameData) {
        setGame(gameData);
        // Join the game now that we know settings
        const { error } = await supabase.from('game_players').upsert({
          game_id: gameId,
          user_id: profile.id,
          display_name: profile.display_name,
          hearts: gameData.settings?.maxHearts || 3,
          eliminated: false,
          spectator: false
        }, { onConflict: 'game_id,user_id' });
        if (error && error.code !== '23505') console.error("Error joining game:", error);
      }
      if (playersData) setPlayers(playersData);
    };
    fetchLobby();

    const gameSub = supabase.channel(`game:${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(payload.new as GameState);
        if (payload.new.status === 'playing') {
          window.location.hash = `#/game?id=${gameId}`;
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, () => {
        fetchLobby(); // Refresh players
      })
      .subscribe();

    const pollInterval = setInterval(() => {
      fetchLobby();
      // Manual check for redirect during poll
      supabase.from('games').select('status').eq('id', gameId).single().then(({ data }) => {
        if (data?.status === 'playing') window.location.hash = `#/game?id=${gameId}`;
      });
    }, 2000);

    return () => {
      supabase.removeChannel(gameSub);
      clearInterval(pollInterval);
    };
  }, [gameId, profile]);

  const [errorMsg, setErrorMsg] = useState("");

  const startGame = async () => {
    if (!supabase || !gameId) return;
    
    if (game?.mode !== 'flashcards' && players.filter(p => !p.spectator).length < 2) {
      setErrorMsg("You need at least 2 players to start a multiplayer game!");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    
    // Call the edge function / Express API to start the game
    await fetch('/api/start-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId })
    });
    
    // Force redirect immediately (don't wait for Realtime in case it's disabled)
    window.location.hash = `#/game?id=${gameId}`;
  };

  if (!game) return <div className="p-10 text-center animate-pulse">Loading lobby...</div>;

  const isHost = game.host_id === profile?.id;

  return (
    <div className="flex flex-col items-center min-h-screen p-6 py-12 relative">
      <div className="absolute top-6 left-6">
        <button onClick={() => window.location.hash = '#/'} className="text-neutral-500 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-colors">
          <ChevronLeft size={16} /> Leave
        </button>
      </div>
      
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-8 text-center border-b border-neutral-800 bg-neutral-950/50">
          <h1 className="text-3xl font-black uppercase tracking-widest text-white">GAME LOBBY</h1>
          <p className="text-neutral-400 mt-2 text-sm uppercase tracking-widest">{game.mode}</p>
        </div>

        <div className="p-8 space-y-8">
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                <Users size={16} /> Players ({players.length})
              </h2>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {players.map(p => (
                <div key={p.id} className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white", getAvatarColor(p.user_id))}>
                    {p.display_name.charAt(0)}
                  </div>
                  <span className="font-bold truncate">{p.display_name}</span>
                  {p.user_id === game.host_id && <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-0.5 rounded uppercase font-black ml-auto">Host</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-neutral-950 rounded-xl p-5 border border-neutral-800">
            <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Settings2 size={16} /> Settings
            </h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Game Mode</span>
                {isHost ? (
                  <select 
                    className="bg-neutral-900 border border-neutral-700 rounded-lg p-1 text-white outline-none"
                    value={game.mode}
                    onChange={async (e) => {
                      await supabase.from('games').update({ mode: e.target.value }).eq('id', game.id);
                    }}
                  >
                    {game.mode === 'flashcards' ? (
                      <option value="flashcards">Flashcards</option>
                    ) : (
                      <>
                        <option value="wordbomb">WordBomb</option>
                        <option value="synonym">Synonym</option>
                      </>
                    )}
                  </select>
                ) : (
                  <span className="font-bold uppercase tracking-wider">{game.mode.replace('_', ' ')}</span>
                )}
              </div>
              
              {game.mode !== 'synonym' && (
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Vocabulary List</span>
                  {isHost ? (
                    <select 
                      className="bg-neutral-900 border border-neutral-700 rounded-lg p-1 text-white outline-none"
                      value={game.settings.listId || ''}
                      onChange={async (e) => {
                        const newSettings = { ...game.settings, listId: e.target.value };
                        await supabase.from('games').update({ settings: newSettings }).eq('id', game.id);
                      }}
                    >
                      <option value="">Random (No List)</option>
                      {lists.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-bold">{lists.find(l => l.id === game.settings.listId)?.name || 'Random'}</span>
                  )}
                </div>
              )}
              
              {game.mode !== 'synonym' && game.settings.listId && (
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Word Count (Limit)</span>
                  {isHost ? (
                    <select 
                      className="bg-neutral-900 border border-neutral-700 rounded-lg p-1 text-white outline-none"
                      value={game.settings.wordCount || 10}
                      onChange={async (e) => {
                        const newSettings = { ...game.settings, wordCount: parseInt(e.target.value) };
                        await supabase.from('games').update({ settings: newSettings }).eq('id', game.id);
                      }}
                    >
                      <option value="5">5 Words</option>
                      <option value="10">10 Words</option>
                      <option value="20">20 Words</option>
                      <option value="50">50 Words</option>
                      <option value="999">All Words</option>
                    </select>
                  ) : (
                    <span className="font-bold">{game.settings.wordCount === 999 ? 'All' : game.settings.wordCount || 10} / {lists.find(l => l.id === game.settings.listId)?.word_count || '?'}</span>
                  )}
                </div>
              )}
              
              {game.mode !== 'flashcards' && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Timer</span>
                    {isHost ? (
                      <select 
                        className="bg-neutral-900 border border-neutral-700 rounded-lg p-1 text-white outline-none"
                        value={game.settings.timerSeconds || 10}
                        onChange={async (e) => {
                          const newSettings = { ...game.settings, timerSeconds: parseInt(e.target.value) };
                          await supabase.from('games').update({ settings: newSettings }).eq('id', game.id);
                        }}
                      >
                        <option value="5">5s</option>
                        <option value="10">10s</option>
                        <option value="15">15s</option>
                        <option value="30">30s</option>
                      </select>
                    ) : (
                      <span className="font-bold">{game.settings.timerSeconds || 10}s</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Lives</span>
                    {isHost ? (
                      <select 
                        className="bg-neutral-900 border border-neutral-700 rounded-lg p-1 text-white outline-none"
                        value={game.settings.maxHearts || 3}
                        onChange={async (e) => {
                          const newSettings = { ...game.settings, maxHearts: parseInt(e.target.value) };
                          await supabase.from('games').update({ settings: newSettings }).eq('id', game.id);
                        }}
                      >
                        <option value="1">❤️ (1)</option>
                        <option value="2">❤️❤️ (2)</option>
                        <option value="3">❤️❤️❤️ (3)</option>
                        <option value="4">❤️❤️❤️❤️ (4)</option>
                        <option value="5">❤️❤️❤️❤️❤️ (5)</option>
                      </select>
                    ) : (
                      <span className="font-bold">{'❤️'.repeat(game.settings.maxHearts || 3)}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>

        <div className="p-8 pt-0">
          {isHost ? (
            <>
              <button
                onClick={startGame}
                className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 text-white p-5 rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(220,38,38,0.5)]"
              >
                <Play className="w-6 h-6 fill-current" />
                START GAME
              </button>
              {errorMsg && (
                <div className="text-red-500 font-bold text-center mt-4 animate-bounce">
                  {errorMsg}
                </div>
              )}
            </>
          ) : (
            <div className="w-full bg-neutral-800 text-neutral-400 p-5 rounded-2xl font-bold text-center">
              WAITING FOR HOST...
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
