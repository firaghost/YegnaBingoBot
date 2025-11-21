-- Add avatar_url column to users table for storing profile avatars
alter table users
  add column if not exists avatar_url text;
