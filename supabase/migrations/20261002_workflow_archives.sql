-- Apply manually in the Supabase SQL Editor before deploying the archive UI.
-- Archiving is an organizational marker; it does not change workflow or collaborator access.

create table public.workflow_archives (
  workflow_id uuid primary key references public.workflows(id) on delete cascade,
  archived_at timestamptz not null default now(),
  archived_by uuid not null default auth.uid() references auth.users(id)
);

alter table public.workflow_archives enable row level security;

revoke all on table public.workflow_archives from public, anon;
grant select, insert, delete on table public.workflow_archives to authenticated;

create policy "Owners can view workflow archive markers"
  on public.workflow_archives for select to authenticated
  using (
    archived_by = auth.uid()
    and exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.owner_id = auth.uid()
    )
  );

create policy "Owners can archive workflows"
  on public.workflow_archives for insert to authenticated
  with check (
    archived_by = auth.uid()
    and exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.owner_id = auth.uid()
    )
  );

create policy "Owners can restore workflows"
  on public.workflow_archives for delete to authenticated
  using (
    archived_by = auth.uid()
    and exists (
      select 1 from public.workflows w
      where w.id = workflow_id and w.owner_id = auth.uid()
    )
  );
