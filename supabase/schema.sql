create extension if not exists pgcrypto;

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  nonce uuid not null unique,
  vault_address text not null,
  owner_wallet text not null,
  mode text not null default 'standard' check (mode in ('standard','red_team')),
  status text not null check (status in (
    'PENDING','EXECUTED','BLOCKED_ONCHAIN','BLOCKED_PREFLIGHT',
    'REJECTED_BY_AI','NEEDS_RECIPIENT_APPROVAL','FAILED_INFRA')),
  canonical_json text not null,   -- TEXT exacto: jsonb reordena claves y rompería el hash
  decision_hash char(64) not null check (decision_hash ~ '^[0-9a-f]{64}$'),
  recipient_address text,
  amount_base_units numeric(20,0) check (amount_base_units >= 0),  -- cabe un u64; nunca float
  tx_signature text unique,
  error_code integer,
  error_name text,
  sim_logs jsonb,                 -- informativo, no participa del hash
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_logs_vault_created_idx on audit_logs (vault_address, created_at desc);

create function public.audit_logs_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'audit_logs es append-only';
  end if;
  if new.canonical_json is distinct from old.canonical_json
     or new.decision_hash is distinct from old.decision_hash
     or new.nonce is distinct from old.nonce
     or new.vault_address is distinct from old.vault_address then
    raise exception 'audit_logs: los campos de evidencia son inmutables';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger audit_logs_guard_trg before update or delete on audit_logs
  for each row execute function audit_logs_guard();

create table auth_nonces (
  nonce text primary key,
  wallet text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

alter table audit_logs enable row level security;
alter table auth_nonces enable row level security;
-- Sin policies: solo el backend (service role) accede. El frontend lee vía API.
