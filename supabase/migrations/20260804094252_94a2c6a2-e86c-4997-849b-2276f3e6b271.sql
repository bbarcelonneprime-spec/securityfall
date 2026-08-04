CREATE TABLE public.alex_tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Anonyme',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  emoji TEXT NOT NULL DEFAULT '✨',
  system_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'alex-base-1',
  starter TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT false,
  installs INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alex_tools TO authenticated;
GRANT ALL ON public.alex_tools TO service_role;

ALTER TABLE public.alex_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tools" ON public.alex_tools
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone signed in can view published tools" ON public.alex_tools
  FOR SELECT TO authenticated
  USING (is_public = true);

CREATE INDEX alex_tools_public_idx ON public.alex_tools (is_public, installs DESC);
CREATE INDEX alex_tools_user_idx ON public.alex_tools (user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_alex_tools_updated_at BEFORE UPDATE ON public.alex_tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.increment_tool_installs(_tool_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.alex_tools SET installs = installs + 1 WHERE id = _tool_id AND is_public = true;
$$;

GRANT EXECUTE ON FUNCTION public.increment_tool_installs(UUID) TO authenticated;