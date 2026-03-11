-- Function to safely extract x-app-env from PostgREST headers
CREATE OR REPLACE FUNCTION public.get_app_env()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  headers_str text;
  headers_json json;
BEGIN
  headers_str := current_setting('request.headers', true);
  IF headers_str IS NULL OR headers_str = '' THEN
    RETURN 'unknown';
  END IF;
  
  BEGIN
    headers_json := headers_str::json;
    RETURN COALESCE(headers_json->>'x-app-env', 'unknown');
  EXCEPTION WHEN OTHERS THEN
    RETURN 'unknown';
  END;
END;
$$;

-- Dynamically add source_env to all tables in the public schema
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS source_env TEXT DEFAULT public.get_app_env();', t_name);
    END LOOP;
END $$;
