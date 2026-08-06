ALTER TABLE public.alex_tools
  ADD COLUMN IF NOT EXISTS app_html TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agent_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS changelog JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS screenshots JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.alex_installs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES public.alex_tools(id) ON DELETE CASCADE,
  installed_version TEXT NOT NULL DEFAULT '1.0.0',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, tool_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alex_installs TO authenticated;
GRANT ALL ON public.alex_installs TO service_role;
ALTER TABLE public.alex_installs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own installs" ON public.alex_installs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_alex_installs_updated_at BEFORE UPDATE ON public.alex_installs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.alex_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES public.alex_tools(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Anonyme',
  rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, tool_id),
  CONSTRAINT alex_reviews_rating_range CHECK (rating >= 1 AND rating <= 5)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alex_reviews TO authenticated;
GRANT ALL ON public.alex_reviews TO service_role;
ALTER TABLE public.alex_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can read reviews" ON public.alex_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own reviews" ON public.alex_reviews FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_alex_reviews_updated_at BEFORE UPDATE ON public.alex_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();