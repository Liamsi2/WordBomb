import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { GameState, GamePlayer } from '../types';
import { Bomb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getAvatarColor } from '../lib/utils';

export default function Game({ gameId }: { gameId: string | null }) {
  const [game, setGame] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [input, setInput] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  
  const [showExplanation, setShowExplanation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('wb_profile');
    if (stored) setProfile(JSON.parse(stored));
  }, []);

  useEffect(() => {
    // Hide explanation when question changes
    setShowExplanation(false);
  }, [game?.current_question?.word]);

  const leaveGame = async () => {
    if (!supabase || !profile || !gameId) return;
    const { data: p } = await supabase.from('game_players').select('*').eq('game_id', gameId).eq('user_id', profile.id).single();
    if (p) {
      await supabase.from('game_players').update({ hearts: 0, eliminated: true }).eq('id', p.id);
      // Let the server know to move the turn if it was my turn
      if (game?.current_player_id === profile.id) {
         await fetch('/api/validate-wordbomb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId, answer: '__FORCED_LEAVE__', expected: '__NONE__' })
         });
      }
    }
    window.location.hash = '#/';
  };

  useEffect(() => {
    if (!gameId || !supabase) return;

    const fetchGame = async () => {
      const { data: gameData } = await supabase.from('games').select('*').eq('id', gameId).single();
      const { data: playersData } = await supabase.from('game_players').select('*').eq('game_id', gameId);
      if (gameData) setGame(gameData);
      if (playersData) setPlayers(playersData);
    };
    fetchGame();

    const gameSub = supabase.channel(`game_play:${gameId}`, { config: { broadcast: { ack: false } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(payload.new as GameState);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, () => {
        fetchGame(); // Refresh players for lives/eliminations
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.input !== undefined) {
           setInput(payload.payload.input);
        }
      })
      .subscribe();
      
    channelRef.current = gameSub;

    // Fallback polling in case Realtime is not enabled in Supabase settings
    const pollInterval = setInterval(fetchGame, 1500);

    return () => {
      supabase.removeChannel(gameSub);
      clearInterval(pollInterval);
    };
  }, [gameId]);

  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (!game?.timer_state) return;
    
    let frameId: number;
    const updateTimer = () => {
      const remaining = Math.max(0, (game.timer_state! - Date.now()) / 1000);
      setTimeLeft(remaining);
      if (remaining > 0) {
        frameId = requestAnimationFrame(updateTimer);
      }
    };
    
    updateTimer();
    return () => cancelAnimationFrame(frameId);
  }, [game?.timer_state]);

  // Auto focus input when it's your turn
  useEffect(() => {
    if (game?.current_player_id === profile?.id && inputRef.current) {
      inputRef.current.focus();
    }
  }, [game?.current_player_id, profile?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || game?.current_player_id !== profile?.id) return;
    
    const isSynonymMode = game.mode === 'synonym';
    const endpoint = isSynonymMode ? '/api/validate-synonym' : '/api/validate-wordbomb';
    const body = isSynonymMode 
      ? { gameId, answer: input, word: game.current_question?.word }
      : { gameId, answer: input, expected: game.current_question?.answer };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data = await res.json();
    if (data.correct) {
      setInput('');
      // Server moves turn. If no server, we just clear it.
    } else {
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 400);
    }
  };

  if (!game || !profile) return null;

  const activePlayers = players.filter(p => !p.spectator && !p.eliminated);
  const eliminatedPlayers = players.filter(p => !p.spectator && p.eliminated);
  const spectators = players.filter(p => p.spectator);
  
  if (game.status === 'finished') {
    const winner = activePlayers.length > 0 ? activePlayers[0] : null;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-neutral-950 text-white selection:bg-red-500/30">
        <h1 className="text-6xl font-black uppercase tracking-widest text-red-500 mb-6 drop-shadow-[0_0_30px_rgba(220,38,38,0.5)]">GAME OVER</h1>
        {winner ? (
          <div className="text-center animate-in zoom-in duration-500">
            <h2 className="text-2xl font-bold text-neutral-400 uppercase tracking-widest mb-4">Winner</h2>
            <div className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center text-5xl font-black mx-auto mb-6 border-4 border-red-400 shadow-[0_0_50px_-10px_rgba(220,38,38,0.8)]">
              {winner.display_name.charAt(0)}
            </div>
            <p className="text-4xl font-black uppercase tracking-tight">{winner.display_name}</p>
          </div>
        ) : (
          <p className="text-2xl font-bold text-neutral-500">No Winner</p>
        )}
        <button 
          onClick={() => window.location.hash = '#/'}
          className="mt-12 bg-white text-black font-bold uppercase tracking-widest px-8 py-4 rounded-2xl hover:scale-105 transition-all"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const isMyTurn = game.current_player_id === profile.id;
  
  // Calculate bomb pulse speed based on time
  const isUrgent = timeLeft <= 3;
  const bombAnimation = isUrgent ? 'animate-ping duration-75' : 'animate-pulse';

  return (
    <div className="flex flex-col h-screen overflow-hidden text-white selection:bg-red-500/30">
      
      {/* Top Header */}
      <header className="p-6 flex justify-between items-center border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
        <div className="flex items-center gap-4">
          <button onClick={leaveGame} className="text-neutral-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
            Leave Game
          </button>
          <h1 className="text-xl font-black uppercase tracking-widest text-neutral-400 hidden md:block">WordBomb</h1>
        </div>
        <div className="flex gap-2">
          {activePlayers.map(p => (
            <div key={p.id} className={cn(
              "flex flex-col items-center gap-1 transition-all",
              p.user_id === game.current_player_id ? "scale-110 opacity-100" : "opacity-50 scale-90"
            )}>
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 text-white transition-all",
                getAvatarColor(p.user_id),
                p.user_id === game.current_player_id ? "border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "border-transparent opacity-50"
              )}>
                {p.display_name.charAt(0)}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">{p.display_name}</span>
              {game.mode !== 'flashcards' && (
                <div className="flex gap-0.5">
                  {Array.from({ length: game.settings?.maxHearts || 3 }).map((_, i) => (
                    <span key={i} className={cn("text-xs", i < p.hearts ? "opacity-100" : "opacity-20 grayscale")}>❤️</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </header>

      {/* Main Game Stage */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-6">
        
        {/* Background Timer Ring (Visual effect) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <div className="w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] rounded-full border-[20px] border-white" />
        </div>
        
        {/* Visual Timer Progress Bar */}
        {game.mode !== 'flashcards' && (
          <div className="absolute top-0 left-0 w-full h-2 bg-neutral-900 overflow-hidden">
             <div 
               className={cn("h-full transition-all ease-linear duration-100", isUrgent ? "bg-red-500" : "bg-white")} 
               style={{ width: `${Math.max(0, (timeLeft / (game.settings?.timerSeconds || 10)) * 100)}%` }} 
             />
          </div>
        )}

        {/* The Bomb */}
        {game.mode !== 'flashcards' && (
          <div className="relative mb-16">
            <motion.div 
              animate={isUrgent ? { scale: [1, 1.2, 1], rotate: [-5, 5, -5, 5, 0] } : { scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: isUrgent ? 0.3 : 1 }}
            >
              <Bomb className={cn("w-32 h-32 text-red-500 drop-shadow-[0_0_30px_rgba(220,38,38,0.5)]", bombAnimation)} />
            </motion.div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-2">
              <span className="text-4xl font-black font-mono text-white drop-shadow-md">
                {timeLeft.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* The Question */}
        <div className="text-center mb-12">
          <div className="text-neutral-500 font-bold uppercase tracking-widest text-sm mb-4">
            {game.mode === 'synonym' ? 'Find a synonym' : game.mode === 'flashcards' ? 'What does it mean?' : 'Translate'}
          </div>
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tight">
            {game.current_question?.word || 'FOTOSYNTESE'}
          </h2>
          
          {game.current_question?.explanation ? (
            <div className="mt-6 min-h-[40px]">
              {showExplanation ? (
                <div className="text-sm font-bold text-neutral-300 bg-neutral-900 border border-neutral-800 px-6 py-3 rounded-2xl max-w-sm mx-auto animate-in fade-in zoom-in duration-300 shadow-xl">
                  {game.current_question.explanation}
                </div>
              ) : (
                <button 
                  onClick={() => setShowExplanation(true)}
                  className="text-xs font-bold text-neutral-400 bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-full hover:bg-neutral-800 uppercase tracking-widest transition-colors"
                >
                  Show Explanation
                </button>
              )}
            </div>
          ) : (
            <div className="mt-6 min-h-[40px]"></div>
          )}
        </div>

        {/* The Input / Action Area */}
        <div className="w-full max-w-md flex flex-col items-center">
          {game.mode === 'flashcards' ? (
            <div className="w-full flex flex-col gap-4 mt-8">
              <div className="text-2xl font-black text-center text-white bg-neutral-900 border-2 border-neutral-800 p-6 rounded-2xl min-h-[90px] flex items-center justify-center break-words">
                 {input === 'reveal' ? game.current_question?.answer : '???'}
              </div>
              
              {input !== 'reveal' ? (
                <button 
                  onClick={() => setInput('reveal')}
                  className="w-full bg-white text-black hover:bg-neutral-200 p-5 rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95"
                >
                  REVEAL ANSWER
                </button>
              ) : (
                <button 
                  onClick={async () => {
                    setInput('');
                    await fetch('/api/skip-turn', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ gameId })
                    });
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95"
                >
                  NEXT WORD
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="relative w-full">
              <motion.input
                ref={inputRef}
                disabled={!isMyTurn}
                type="text"
                value={input}
                onChange={(e) => {
                  const val = e.target.value;
                  setInput(val);
                  if (isMyTurn && channelRef.current) {
                     channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { input: val } });
                  }
                }}
                placeholder={isMyTurn ? "Type your answer..." : "Waiting for other player..."}
                className={cn(
                  "w-full bg-neutral-900 border-2 text-2xl font-black uppercase text-center p-6 rounded-2xl outline-none transition-all placeholder:text-neutral-600",
                  isMyTurn ? "border-white focus:border-red-500 shadow-[0_0_30px_-5px_rgba(255,255,255,0.2)]" : "border-neutral-800 opacity-50 cursor-not-allowed"
                )}
                animate={errorShake ? { x: [-10, 10, -10, 10, 0] } : {}}
                transition={{ duration: 0.4 }}
                autoComplete="off"
                spellCheck="false"
              />
            </form>
          )}
        </div>

      </main>

      {/* Eliminated / Spectator Sidebar (Bottom on mobile) */}
      {(eliminatedPlayers.length > 0 || spectators.length > 0) && (
        <footer className="p-4 bg-neutral-950/90 border-t border-neutral-900 flex flex-wrap gap-6 justify-center text-xs font-bold uppercase tracking-widest text-neutral-500">
          {eliminatedPlayers.length > 0 && (
            <div className="flex items-center gap-2">
              <span>Eliminated:</span>
              <div className="flex gap-2">
                {eliminatedPlayers.map(p => (
                  <span key={p.id} className="text-red-500/50 line-through">{p.display_name}</span>
                ))}
              </div>
            </div>
          )}
          {spectators.length > 0 && (
            <div className="flex items-center gap-2">
              <span>Spectators:</span>
              <div className="flex gap-2">
                {spectators.map(p => (
                  <span key={p.id} className="text-neutral-400">{p.display_name}</span>
                ))}
              </div>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
