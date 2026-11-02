interface ImportMetaEnv {
  /** Supabase project URL and publishable key: public by design and protected by RLS. Without them there is no login. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
