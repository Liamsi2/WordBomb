// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Synonym Validation Edge Function started")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    } })
  }

  try {
    const { word, answer, gameId } = await req.json()
    
    // Create a Supabase client with the Auth context of the logged in user.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Using service role to interact with cache / avoid RLS blocks for internal server ops
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const cleanWord = word.toLowerCase().trim()
    const cleanAnswer = answer.toLowerCase().trim()

    // 1. Check cache
    let { data: cache } = await supabaseAdmin
      .from('synonym_cache')
      .select('synonyms')
      .eq('word', cleanWord)
      .single()

    let validSynonyms: string[] = []

    if (cache) {
      validSynonyms = cache.synonyms
    } else {
      // 2. Fetch from external API if not cached
      const res = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(cleanWord)}`)
      const data = await res.json()
      validSynonyms = data.map((d: any) => d.word.toLowerCase())

      // 3. Store in cache
      if (validSynonyms.length > 0) {
        await supabaseAdmin.from('synonym_cache').insert({
          word: cleanWord,
          synonyms: validSynonyms,
          source: 'datamuse'
        })
      }
    }

    // 4. Validate
    const isCorrect = validSynonyms.includes(cleanAnswer)

    // Optional: If correct, update the game state server-side so clients can't spoof it
    if (isCorrect && gameId) {
      // Pass bomb logic here
    }

    return new Response(
      JSON.stringify({ correct: isCorrect, word: cleanWord }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' },
      status: 400,
    })
  }
})
