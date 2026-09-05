import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { VocabularyList, VocabularyItem } from '../types';
import { Plus, Trash2, Edit2, ChevronLeft, Save, X } from 'lucide-react';

export default function ManageLists() {
  const [lists, setLists] = useState<VocabularyList[]>([]);
  const [selectedList, setSelectedList] = useState<VocabularyList | null>(null);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // New list form
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState('');

  // New item form
  const [norwegian, setNorwegian] = useState('');
  const [english, setEnglish] = useState('');
  const [explanation, setExplanation] = useState('');

  // Bulk add state
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('wb_profile');
    if (stored) setProfile(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (!profile || !supabase) return;
    
    const fetchLists = async () => {
      const { data } = await supabase.from('vocabulary_lists').select('*').eq('user_id', profile.id);
      if (data) setLists(data);
      setLoading(false);
    };
    
    fetchLists();
  }, [profile]);

  useEffect(() => {
    if (!selectedList || !supabase) return;

    const fetchItems = async () => {
      const { data } = await supabase.from('vocabulary_items').select('*').eq('list_id', selectedList.id);
      if (data) setItems(data);
    };
    fetchItems();
  }, [selectedList]);

  const createList = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!supabase || !profile) return;
    if (!newListName.trim()) return;
    
    const { data, error } = await supabase.from('vocabulary_lists').insert({
      user_id: profile.id,
      name: newListName.trim()
    }).select().single();
    
    if (error) {
      console.error("Error creating list:", error);
      alert("Failed to create list."); // Keep simple alert for errors as fallback, though could be custom too
    }
    if (data) {
      setLists([...lists, data]);
      setNewListName('');
      setShowNewListForm(false);
    }
  };

  const deleteList = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Replacing window.confirm with a simple double-click requirement or just deleting directly
    // For a smoother UX without modals, let's just delete it directly or rely on a custom confirm state. 
    // To keep it simple, we'll just delete it. In a real app we'd add an inline confirmation.
    if (!supabase) return;
    await supabase.from('vocabulary_lists').delete().eq('id', id);
    setLists(lists.filter(l => l.id !== id));
    if (selectedList?.id === id) setSelectedList(null);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedList || !norwegian || !english) return;

    const { data } = await supabase.from('vocabulary_items').insert({
      list_id: selectedList.id,
      norwegian,
      english,
      explanation
    }).select().single();

    if (data) {
      setItems([...items, data]);
      setNorwegian('');
      setEnglish('');
      setExplanation('');
      
      // Update count locally
      setLists(lists.map(l => l.id === selectedList.id ? { ...l, word_count: (l.word_count || 0) + 1 } : l));
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedList || !bulkText.trim()) return;

    const entries = bulkText.split(';').map(e => e.trim()).filter(e => e.length > 0);
    const newItems = entries.map(entry => {
      const parts = entry.split(',').map(p => p.trim());
      return {
        list_id: selectedList.id,
        norwegian: parts[0] || 'Unknown',
        english: parts[1] || 'Unknown',
        explanation: parts.slice(2).join(', ') || ''
      };
    });

    if (newItems.length === 0) return;

    const { data, error } = await supabase.from('vocabulary_items').insert(newItems).select();
    
    if (error) {
      console.error("Bulk add error:", error);
      alert("Failed to bulk add words.");
    } else if (data) {
      setItems([...items, ...data]);
      setBulkText('');
      setIsBulkMode(false);
      
      // Update count locally
      setLists(lists.map(l => l.id === selectedList.id ? { ...l, word_count: (l.word_count || 0) + data.length } : l));
    }
  };

  const deleteItem = async (id: string) => {
    if (!supabase) return;
    await supabase.from('vocabulary_items').delete().eq('id', id);
    setItems(items.filter(i => i.id !== id));
    setLists(lists.map(l => l.id === selectedList.id ? { ...l, word_count: Math.max(0, (l.word_count || 0) - 1) } : l));
  };

  if (selectedList) {
    return (
      <div className="p-6 py-12 max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-4">
          <div>
            <button onClick={() => setSelectedList(null)} className="text-neutral-500 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-widest mb-4">
              <ChevronLeft size={16} /> Back to Lists
            </button>
            <h1 className="text-4xl font-black uppercase tracking-tight text-white">{selectedList.name}</h1>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-8">
          
          <div className="md:col-span-1">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold uppercase tracking-widest text-sm text-neutral-500">Add Words</h2>
                <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                  <button onClick={() => setIsBulkMode(false)} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${!isBulkMode ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'}`}>Single</button>
                  <button onClick={() => setIsBulkMode(true)} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${isBulkMode ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'}`}>Bulk</button>
                </div>
              </div>

              {!isBulkMode ? (
                <form onSubmit={addItem} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-400 mb-2">Norwegian</label>
                    <input required value={norwegian} onChange={e=>setNorwegian(e.target.value)} type="text" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-white outline-none focus:border-red-500" placeholder="e.g. Fotosyntese" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-400 mb-2">English</label>
                    <input required value={english} onChange={e=>setEnglish(e.target.value)} type="text" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-white outline-none focus:border-red-500" placeholder="e.g. Photosynthesis" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-400 mb-2">Explanation (Optional)</label>
                    <textarea value={explanation} onChange={e=>setExplanation(e.target.value)} rows={3} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-white outline-none focus:border-red-500 resize-none" placeholder="Brief definition..." />
                  </div>
                  <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                    <Plus size={18} /> Add Word
                  </button>
                </form>
              ) : (
                <form onSubmit={handleBulkAdd} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-400 mb-2">Paste Format:</label>
                    <div className="text-xs text-neutral-500 mb-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800 font-mono leading-relaxed">
                      Norwegian, English, Explanation;<br/>
                      Word2, Translation2;
                    </div>
                    <textarea 
                      required 
                      value={bulkText} 
                      onChange={e=>setBulkText(e.target.value)} 
                      rows={6} 
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-white outline-none focus:border-red-500 resize-none font-mono text-sm leading-relaxed" 
                      placeholder="Fotosyntese, Photosynthesis, A process plants use; &#10;lys, light, a thing the sun makes;" 
                    />
                  </div>
                  <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                    <Plus size={18} /> Import Words
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <h2 className="font-bold uppercase tracking-widest text-sm text-neutral-500 mb-6">Words in List ({items.length})</h2>
            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="text-center p-8 border border-neutral-800 rounded-2xl text-neutral-500 font-bold border-dashed">
                  No words yet. Add your first word on the left!
                </div>
              ) : (
                items.map(item => (
                  <div key={item.id} className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex gap-4 group">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-neutral-500 mb-1">Norwegian</div>
                        <div className="font-bold text-white">{item.norwegian}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-neutral-500 mb-1">English</div>
                        <div className="font-bold text-white">{item.english}</div>
                      </div>
                      {item.explanation && (
                        <div className="col-span-2 mt-2">
                          <div className="text-[10px] font-bold uppercase text-neutral-500 mb-1">Explanation</div>
                          <div className="text-sm text-neutral-300">{item.explanation}</div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-950 rounded-lg self-start transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="p-6 py-12 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-12">
        <div>
          <button onClick={() => window.location.hash = '#/'} className="text-neutral-500 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-widest mb-4">
            <ChevronLeft size={16} /> Back to Home
          </button>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white">Your Lists</h1>
        </div>
        <button 
          onClick={() => setShowNewListForm(true)}
          className="bg-white text-black p-3 rounded-xl font-bold hover:bg-neutral-200 transition-colors flex items-center gap-2"
        >
          <Plus size={20} /> <span className="hidden sm:inline">Create List</span>
        </button>
      </header>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-neutral-900 rounded-2xl w-full"></div>
          <div className="h-20 bg-neutral-900 rounded-2xl w-full"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {showNewListForm && (
            <form onSubmit={createList} className="bg-neutral-900 border border-red-500/50 p-5 rounded-2xl flex items-center gap-4">
              <input 
                autoFocus
                type="text" 
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                placeholder="List Name (e.g. Spanish Basics)"
                className="flex-1 bg-transparent border-none outline-none text-white font-bold text-xl placeholder:text-neutral-600"
              />
              <button type="button" onClick={() => setShowNewListForm(false)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
              <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-500 transition-colors">
                Save
              </button>
            </form>
          )}
          
          {lists.length === 0 && !showNewListForm ? (
            <div className="text-center p-12 bg-neutral-900 border border-neutral-800 rounded-3xl">
              <p className="text-neutral-400 font-bold">You don't have any lists yet.</p>
              <button onClick={() => setShowNewListForm(true)} className="mt-4 text-white underline font-bold">Create your first list</button>
            </div>
          ) : (
            lists.map(list => (
              <div key={list.id} onClick={() => setSelectedList(list)} className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl flex items-center justify-between group hover:border-neutral-700 transition-colors cursor-pointer">
                <div>
                  <h3 className="font-bold text-xl text-white">{list.name}</h3>
                  <p className="text-sm text-neutral-500 font-bold uppercase tracking-widest mt-1">
                    {list.word_count || 0} Words
                  </p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => deleteList(list.id, e)} className="p-3 bg-red-950 text-red-500 hover:bg-red-900 rounded-xl transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
