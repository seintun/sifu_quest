-- Rollback: drop the atomic memory file upsert function.
-- This migration reverses 20260318000000_atomic_memory_upsert.sql

DROP FUNCTION IF EXISTS upsert_memory_file_atomic(UUID, TEXT, TEXT, TEXT);
