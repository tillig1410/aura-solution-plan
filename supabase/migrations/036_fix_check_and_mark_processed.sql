CREATE OR REPLACE FUNCTION public.check_and_mark_processed(p_message_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO processed_messages (message_id)
  VALUES (p_message_id)
  ON CONFLICT (message_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM processed_messages
  WHERE created_at < now() - interval '1 hour';

  RETURN v_count > 0;
END;
$func$;
