CREATE TABLE public.codex_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Nouveau jeu',
  prompt text NOT NULL DEFAULT '',
  html text NOT NULL DEFAULT '',
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.codex_projects TO authenticated;
GRANT ALL ON public.codex_projects TO service_role;
ALTER TABLE public.codex_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own codex projects" ON public.codex_projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_codex_projects_updated_at BEFORE UPDATE ON public.codex_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX codex_projects_user_updated_idx ON public.codex_projects(user_id, updated_at DESC);