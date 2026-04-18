CREATE TABLE IF NOT EXISTS public.processed_messages (
  message_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full" ON public.processed_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_processed_messages_created ON public.processed_messages (created_at);

CREATE OR REPLACE FUNCTION public.check_and_mark_processed(p_message_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_inserted BOOLEAN;
BEGIN
  INSERT INTO processed_messages (message_id)
  VALUES (p_message_id)
  ON CONFLICT (message_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  DELETE FROM processed_messages
  WHERE created_at < now() - interval '1 hour';

  RETURN v_inserted > 0;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.check_and_mark_processed(TEXT)
  TO service_role;
