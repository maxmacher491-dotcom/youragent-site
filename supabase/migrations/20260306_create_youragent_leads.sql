create table if not exists public.youragent_leads (
  id bigint generated always as identity primary key,
  source text,
  name text,
  email text,
  company text,
  message text,
  reply text,
  lang text,
  page text,
  mode text,
  industry text,
  desired_solution text,
  urgency text,
  contact_intent text,
  lead_score text,
  created_at timestamptz default now()
);
