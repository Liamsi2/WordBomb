import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Bomb, Settings, User, Users, Play, Plus } from 'lucide-react';
import { cn, getAvatarColor } from '../lib/utils';

export default function Home() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const initProfile = async () => {
      let p;
      const stored = localStorage.getItem('wb_profile');
      if (stored) {
        p = JSON.parse(stored);
      } else {
        let nextNum = Math.floor(Math.random() * 9000) + 1000;
        if (supabase) {
           const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
           if (count !== null) nextNum = count + 1;
        }
        p = {
          id: crypto.randomUUID(),
          display_name: `g-${nextNum}`,
          generated_name: `g-${nextNum}`,
          avatar_seed: Math.random().toString(36).substring(7),
        };
        localStorage.setItem('wb_profile', JSON.stringify(p));
      }
      setProfile(p);

      if (supabase) {
        const { error } = await supabase.from('profiles').upsert({
          id: p.id,
          display_name: p.display_name,
          generated_name: p.generated_name || p.display_name,
          avatar_seed: p.avatar_seed
        });
        if (error) console.error("Error upserting profile:", error);
      }
    };
    initProfile();
  }, []);

  const handleJoinGame = async () => {
    if (!supabase) return;
    
    // Find a lobby or playing game to join
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .neq('status', 'finished')
      .neq('mode', 'flashcards')
      .limit(1);

    if (games && games.length > 0) {
      window.location.hash = `#/lobby?id=${games[0].id}`;
    } else {
      // Create a new game
      const { data: newGame, error } = await supabase
        .from('games')
        .insert({
          mode: 'wordbomb',
          status: 'lobby',
          host_id: profile.id,
          settings: { wordCount: 10, timerSeconds: 10, maxHearts: 3 }
        })
        .select()
        .single();
      
      if (error) {
        console.error("Error creating game:", error);
        alert("Failed to create game. If you are the database owner, make sure to run the updated /fix-schema.sql to allow anonymous users to play!");
      }

      if (newGame) {
        window.location.hash = `#/lobby?id=${newGame.id}`;
      }
    }
  };

  const handleSinglePlayer = async () => {
    if (!supabase) return;
    const { data: newGame, error } = await supabase
      .from('games')
      .insert({
        mode: 'flashcards',
        status: 'lobby',
        host_id: profile.id,
        settings: { wordCount: 10, timerSeconds: 10, maxHearts: 3 }
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error creating solo game:", error);
      alert("Failed to create game.");
    }

    if (newGame) {
      window.location.hash = `#/lobby?id=${newGame.id}`;
    }
  };

  if (!profile) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      
      <div className="mb-12 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="relative">
          <Bomb className="w-24 h-24 text-red-500 animate-pulse" />
          <div className="absolute top-0 right-0 w-4 h-4 bg-orange-400 rounded-full animate-ping" />
        </div>
        <h1 className="text-5xl font-black mt-6 tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-500">
          WordBomb <span className="text-red-500">2.0</span>
        </h1>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={handleJoinGame}
          className="w-full group relative flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 text-white p-5 rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(220,38,38,0.5)]"
        >
          <Users className="w-6 h-6" />
          JOIN A GAME
        </button>

        <button
          onClick={handleSinglePlayer}
          className="w-full flex items-center justify-center gap-3 bg-neutral-800 hover:bg-neutral-700 text-white p-5 rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95"
        >
          <User className="w-6 h-6" />
          SINGLE PLAYER
        </button>

        <button
          onClick={() => window.location.hash = '#/manage'}
          className="w-full flex items-center justify-center gap-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 p-4 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95"
        >
          <Settings className="w-5 h-5" />
          MANAGE LISTS
        </button>
      </div>

      <div className="mt-16 flex items-center gap-4 bg-neutral-900 border border-neutral-800 rounded-full p-2 pr-6">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-white", getAvatarColor(profile.avatar_seed))}>
          {profile.display_name.charAt(0)}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Playing As</span>
          <span className="font-bold">{profile.display_name}</span>
        </div>
      </div>

    </div>
  );
}
