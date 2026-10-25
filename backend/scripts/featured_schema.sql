-- Run once in the Supabase SQL editor before using the featured-repos endpoints / scripts.
alter table repos
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_order integer,
  add column if not exists featured_tags text[] not null default '{}';

create index if not exists repos_featured_idx on repos (featured_order) where is_featured;
