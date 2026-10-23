import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)

// Com placeholders o app sobe e mostra a tela de configuração em vez de quebrar.
export const supabase = createClient(url || 'http://localhost', key || 'missing-key')
