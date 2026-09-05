/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { ShieldAlert } from 'lucide-react';
import Home from './pages/Home';
import Game from './pages/Game';
import GameLobby from './pages/GameLobby';
import ManageLists from './pages/ManageLists';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<string>('/');
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || '/';
      const [path, id] = hash.split('?id=');
      setCurrentRoute(path);
      if (id) setGameId(id);
    };
    
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (!supabase) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 p-8 rounded-2xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-4 tracking-tight">Supabase Required</h1>
          <p className="text-neutral-400 mb-6 leading-relaxed">
            WordBomb 2.0 uses Supabase for Realtime multiplayer, authentication, and database storage as requested.
          </p>
          <div className="bg-neutral-950 p-4 rounded-lg text-left text-sm text-neutral-300 font-mono border border-neutral-800 overflow-hidden">
            VITE_SUPABASE_URL=...<br/>
            VITE_SUPABASE_ANON_KEY=...
          </div>
          <p className="text-neutral-500 text-sm mt-6">
            Add these to your environment variables to start playing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-red-500/30">
      <main className="max-w-4xl mx-auto min-h-screen">
        {currentRoute === '/' && <Home />}
        {currentRoute === '/lobby' && <GameLobby gameId={gameId} />}
        {currentRoute === '/game' && <Game gameId={gameId} />}
        {currentRoute === '/manage' && <ManageLists />}
      </main>
    </div>
  );
}
