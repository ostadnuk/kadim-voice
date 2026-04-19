-- Kadim Voice — Supabase schema (idempotent — safe to re-run)
-- Run this in the Supabase SQL Editor.

-- ── Recordings table ─────────────────────────────────────────────────────────

create table if not exists recordings (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  -- Audio
  audio_url        text not null,
  duration_sec     integer not null,
  waveform_peaks   jsonb not null default '[]',

  -- Voice signature (Chladni pattern coefficients)
  signature_points jsonb not null default '[]',

  -- Location
  source_type      text not null check (source_type in ('exhibition', 'remote')),
  venue_id         text,
  venue_name       text,
  country          text,
  city             text,
  lat              double precision,
  lng              double precision,

  -- Consent
  consent_version  text not null default '1.0',
  mix_opt_in       boolean not null default false
);

-- Index for fast archive listing (newest first)
create index if not exists recordings_created_at_idx on recordings (created_at desc);

-- ── Row-level security ────────────────────────────────────────────────────────

alter table recordings enable row level security;

-- Drop existing policies before recreating (safe to re-run)
drop policy if exists "Public insert" on recordings;
drop policy if exists "Public read"   on recordings;

-- Anyone can insert (public art installation — no auth required)
create policy "Public insert" on recordings
  for insert to anon with check (true);

-- Anyone can read (archive is public)
create policy "Public read" on recordings
  for select to anon using (true);

-- ── Storage ───────────────────────────────────────────────────────────────────
-- Create the "audio" bucket via Dashboard: Storage → New bucket → "audio" → Public
-- Then add these storage policies via Dashboard → Storage → Policies:
--
--   INSERT policy for anon: (bucket_id = 'audio')
--   SELECT policy for anon: (bucket_id = 'audio')
