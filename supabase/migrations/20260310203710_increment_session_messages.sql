CREATE OR REPLACE FUNCTION increment_session_messages(session_id_param UUID, increment_by INT DEFAULT 2)
RETURNS void AS $$
BEGIN
  UPDATE chat_sessions
  SET message_count = message_count + increment_by,
      last_message_at = now()
  WHERE id = session_id_param;
END;
$$ LANGUAGE plpgsql;
