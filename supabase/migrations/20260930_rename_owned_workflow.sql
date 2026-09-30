create or replace function public.rename_owned_workflow(
  p_workflow_id uuid,
  p_new_title text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_owner uuid;
  latest_version_number integer;
  latest_semantic_workflow jsonb;
  latest_presentation_state jsonb;
  next_version_number integer;
  normalized_title text;
  updated_timestamp timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  normalized_title := btrim(p_new_title);
  if normalized_title is null or char_length(normalized_title) < 1 or char_length(normalized_title) > 100 then
    raise exception 'Workflow title must be between 1 and 100 characters' using errcode = '22023';
  end if;

  select owner_id into current_owner
  from public.workflows
  where id = p_workflow_id
  for update;

  if not found or current_owner <> auth.uid() then
    raise exception 'Workflow not found or not owned by the current user' using errcode = '42501';
  end if;

  select version_number, semantic_workflow, presentation_state
  into latest_version_number, latest_semantic_workflow, latest_presentation_state
  from public.workflow_versions
  where workflow_id = p_workflow_id
  order by version_number desc
  limit 1;

  if not found then
    raise exception 'Workflow has no saved version' using errcode = 'P0002';
  end if;

  next_version_number := latest_version_number + 1;
  latest_semantic_workflow := jsonb_set(latest_semantic_workflow, '{title}', to_jsonb(normalized_title), true);

  insert into public.workflow_versions (
    workflow_id,
    version_number,
    created_by,
    semantic_workflow,
    presentation_state,
    change_summary
  ) values (
    p_workflow_id,
    next_version_number,
    auth.uid(),
    latest_semantic_workflow,
    latest_presentation_state,
    left('Renamed to: ' || normalized_title, 100)
  );

  update public.workflows
  set title = normalized_title,
      updated_at = now()
  where id = p_workflow_id
  returning updated_at into updated_timestamp;

  return jsonb_build_object(
    'version_number', next_version_number,
    'updated_at', updated_timestamp
  );
end;
$$;

revoke all on function public.rename_owned_workflow(uuid, text) from public;
revoke all on function public.rename_owned_workflow(uuid, text) from anon;
grant execute on function public.rename_owned_workflow(uuid, text) to authenticated;
