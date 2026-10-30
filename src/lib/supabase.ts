import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para jugar Palabras clave.",
    );
  }

  client ??= createClient(url, anonKey);
  return client;
}

export async function ensureAnonymousSession() {
  const supabase = getSupabaseClient();
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user.id) return sessionData.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(
      `No se pudo iniciar una sesión anónima. Activa Anonymous Sign-Ins en Supabase. ${error.message}`,
    );
  }
  if (!data.user) throw new Error("Supabase no devolvió la sesión del dispositivo.");
  return data.user.id;
}
