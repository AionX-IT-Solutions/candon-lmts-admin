-- Officials: professional title written before the name (e.g. "Atty.", "Dr.", "Engr.")
alter table public.officials
  add column if not exists title text collate "C";
