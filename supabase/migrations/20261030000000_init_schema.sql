-- ==============================================================================
-- System Design: ระบบค้นหาและเปรียบเทียบประกันรถยนต์ภายในทีม (InsureDesk)
-- Initial Database Migration
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Profiles & Roles (RBAC)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(user_id) on delete cascade,
    role text not null check (role in ('viewer', 'editor', 'reviewer', 'admin')),
    created_at timestamptz not null default now(),
    unique(user_id, role)
);

-- Helper security functions
create or replace function public.is_active_user(user_id_param uuid)
returns boolean as $$
    select exists (
        select 1 from public.profiles
        where user_id = user_id_param and is_active = true
    );
$$ language sql security definer;

create or replace function public.has_role(user_id_param uuid, role_param text)
returns boolean as $$
    select exists (
        select 1 from public.user_roles ur
        join public.profiles p on p.user_id = ur.user_id
        where ur.user_id = user_id_param 
          and p.is_active = true
          and (ur.role = role_param or ur.role = 'admin')
    );
$$ language sql security definer;

-- ------------------------------------------------------------------------------
-- 2. Insurers & Vehicle Models
-- ------------------------------------------------------------------------------
create table if not exists public.insurers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    contact_channels text,
    website text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid references public.profiles(user_id),
    updated_by uuid references public.profiles(user_id)
);

create table if not exists public.vehicle_models (
    id uuid primary key default gen_random_uuid(),
    brand text not null,
    model text not null,
    variant text,
    powertrain text check (powertrain in ('ICE', 'HEV', 'PHEV', 'BEV', 'other', null)),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 3. Insurance Plans & Plan Versions
-- ------------------------------------------------------------------------------
create table if not exists public.plans (
    id uuid primary key default gen_random_uuid(),
    insurer_id uuid not null references public.insurers(id) on delete restrict,
    name text not null,
    insurance_type text not null check (insurance_type in ('ชั้น 1', 'ชั้น 2+', 'ชั้น 3+', 'ชั้น 2', 'ชั้น 3')),
    is_archived boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid references public.profiles(user_id),
    updated_by uuid references public.profiles(user_id)
);

create table if not exists public.plan_versions (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid not null references public.plans(id) on delete cascade,
    version_no integer not null check (version_no > 0),
    workflow_status text not null default 'draft' check (workflow_status in ('draft', 'in_review', 'published', 'archived')),
    effective_from date,
    effective_to date,
    verified_at timestamptz,
    verified_by uuid references public.profiles(user_id),
    review_due_at date,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid references public.profiles(user_id),
    updated_by uuid references public.profiles(user_id),
    constraint uq_plan_version unique (plan_id, version_no),
    constraint chk_version_dates check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

-- ------------------------------------------------------------------------------
-- 4. Eligibility Rules & Price Options
-- ------------------------------------------------------------------------------
create table if not exists public.eligibility_rules (
    id uuid primary key default gen_random_uuid(),
    plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
    scope_type text not null default 'specific_model' check (scope_type in ('specific_model', 'all_models', 'unknown')),
    vehicle_model_id uuid references public.vehicle_models(id) on delete set null,
    min_age integer check (min_age is null or min_age >= 0),
    max_age integer check (max_age is null or max_age >= 0),
    age_basis text check (age_basis in ('registration_year', 'manufacture_year', null)),
    usage_type text check (usage_type in ('private', 'commercial', 'all', null)),
    inspection_required boolean,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid references public.profiles(user_id),
    updated_by uuid references public.profiles(user_id),
    constraint chk_eligibility_age check (min_age is null or max_age is null or max_age >= min_age)
);

create table if not exists public.price_options (
    id uuid primary key default gen_random_uuid(),
    eligibility_rule_id uuid not null references public.eligibility_rules(id) on delete cascade,
    label text not null,
    repair_type text not null check (repair_type in ('dealer', 'garage')),
    price_type text not null default 'fixed_for_conditions' check (price_type in ('starting', 'indicative', 'fixed_for_conditions', 'unknown')),
    net_premium numeric(12, 2) check (net_premium is null or net_premium >= 0),
    tax_stamp numeric(12, 2) check (tax_stamp is null or tax_stamp >= 0),
    premium_total numeric(12, 2) check (premium_total is null or premium_total >= 0),
    compulsory_included text not null default 'unspecified' check (compulsory_included in ('included', 'excluded', 'unspecified')),
    sum_insured_min numeric(12, 2) check (sum_insured_min is null or sum_insured_min >= 0),
    sum_insured_max numeric(12, 2) check (sum_insured_max is null or sum_insured_max >= 0),
    deductible_amount numeric(12, 2) check (deductible_amount is null or deductible_amount >= 0) default 0,
    deductible_terms text,
    driver_conditions text,
    valid_from date,
    valid_to date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid references public.profiles(user_id),
    updated_by uuid references public.profiles(user_id),
    constraint chk_sum_insured_range check (sum_insured_min is null or sum_insured_max is null or sum_insured_max >= sum_insured_min),
    constraint chk_price_dates check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

-- ------------------------------------------------------------------------------
-- 5. Coverages & Overrides
-- ------------------------------------------------------------------------------
create table if not exists public.coverage_types (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name text not null,
    category text not null, -- own_damage, third_party, additional, assist
    sort_order integer not null default 0
);

create table if not exists public.version_coverages (
    id uuid primary key default gen_random_uuid(),
    plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
    coverage_type_id uuid not null references public.coverage_types(id) on delete cascade,
    status text not null default 'unknown' check (status in ('covered', 'not_covered', 'optional', 'unknown')),
    limit_amount numeric(14, 2) check (limit_amount is null or limit_amount >= 0),
    limit_basis text, -- 'ต่อครั้ง', 'ต่อคน', 'ตามทุนประกัน', etc.
    deductible_amount numeric(12, 2) check (deductible_amount is null or deductible_amount >= 0),
    terms text,
    exclusions text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(plan_version_id, coverage_type_id)
);

create table if not exists public.option_coverage_overrides (
    id uuid primary key default gen_random_uuid(),
    price_option_id uuid not null references public.price_options(id) on delete cascade,
    coverage_type_id uuid not null references public.coverage_types(id) on delete cascade,
    status text not null check (status in ('covered', 'not_covered', 'optional', 'unknown')),
    limit_amount numeric(14, 2) check (limit_amount is null or limit_amount >= 0),
    limit_basis text,
    deductible_amount numeric(12, 2) check (deductible_amount is null or deductible_amount >= 0),
    terms text,
    exclusions text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(price_option_id, coverage_type_id)
);

-- ------------------------------------------------------------------------------
-- 6. Source Documents & Audit Logs
-- ------------------------------------------------------------------------------
create table if not exists public.source_documents (
    id uuid primary key default gen_random_uuid(),
    plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
    source_type text not null default 'rate_sheet' check (source_type in ('policy_schedule', 'rate_sheet', 'brochure', 'endorsement', 'other')),
    storage_path text not null,
    source_url text,
    title text not null,
    file_size integer,
    mime_type text,
    page_reference text,
    received_at date,
    created_at timestamptz not null default now(),
    created_by uuid references public.profiles(user_id)
);

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references public.profiles(user_id),
    action text not null, -- 'create', 'update', 'submit_review', 'publish', 'archive', 'reject'
    entity_type text not null, -- 'plan_version', 'insurer', 'user_role', 'price_option'
    entity_id uuid not null,
    before_data jsonb,
    after_data jsonb,
    reason text,
    created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 7. Indexes for Query Performance
-- ------------------------------------------------------------------------------
create index if not exists idx_plans_insurer on public.plans(insurer_id);
create index if not exists idx_plan_versions_status on public.plan_versions(workflow_status, effective_from, effective_to);
create index if not exists idx_eligibility_rules_version on public.eligibility_rules(plan_version_id);
create index if not exists idx_eligibility_rules_vehicle on public.eligibility_rules(vehicle_model_id);
create index if not exists idx_price_options_rule on public.price_options(eligibility_rule_id);
create index if not exists idx_price_options_premium on public.price_options(premium_total);
create index if not exists idx_price_options_sum on public.price_options(sum_insured_min, sum_insured_max);
create index if not exists idx_version_coverages_ver on public.version_coverages(plan_version_id);
create index if not exists idx_version_coverages_type on public.version_coverages(coverage_type_id);
create index if not exists idx_source_docs_version on public.source_documents(plan_version_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

-- ------------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.insurers enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.coverage_types enable row level security;
alter table public.plans enable row level security;
alter table public.plan_versions enable row level security;
alter table public.eligibility_rules enable row level security;
alter table public.price_options enable row level security;
alter table public.version_coverages enable row level security;
alter table public.option_coverage_overrides enable row level security;
alter table public.source_documents enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: Active users can read all active profiles. Admin can manage.
create policy "Active users can view profiles" on public.profiles
    for select using (public.is_active_user(auth.uid()));

create policy "Admins can manage profiles" on public.profiles
    for all using (public.has_role(auth.uid(), 'admin'));

-- User Roles: Read by active users, manage by admin only
create policy "Active users can view roles" on public.user_roles
    for select using (public.is_active_user(auth.uid()));

create policy "Admins can manage roles" on public.user_roles
    for all using (public.has_role(auth.uid(), 'admin'));

-- Master data: Insurers, Vehicle Models, Coverage Types
create policy "Active users can view insurers" on public.insurers
    for select using (public.is_active_user(auth.uid()));

create policy "Editors and admins can manage insurers" on public.insurers
    for all using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

create policy "Active users can view vehicles" on public.vehicle_models
    for select using (public.is_active_user(auth.uid()));

create policy "Editors and admins can manage vehicles" on public.vehicle_models
    for all using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

create policy "Active users can view coverage types" on public.coverage_types
    for select using (public.is_active_user(auth.uid()));

-- Plans:
create policy "Active users can view non-archived plans" on public.plans
    for select using (public.is_active_user(auth.uid()));

create policy "Editors and admins can manage plans" on public.plans
    for all using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

-- Plan Versions:
-- Published versions viewable by any active user.
-- Drafts/reviews viewable by editor, reviewer, admin.
create policy "View plan versions by role" on public.plan_versions
    for select using (
        public.is_active_user(auth.uid()) and (
            workflow_status = 'published' or
            public.has_role(auth.uid(), 'editor') or
            public.has_role(auth.uid(), 'reviewer') or
            public.has_role(auth.uid(), 'admin')
        )
    );

create policy "Editors can insert draft plan versions" on public.plan_versions
    for insert with check (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

create policy "Editors can update draft versions" on public.plan_versions
    for update using (
        (public.has_role(auth.uid(), 'editor') and workflow_status = 'draft') or
        public.has_role(auth.uid(), 'reviewer') or
        public.has_role(auth.uid(), 'admin')
    );

-- Child tables: Eligibility, Prices, Coverages, Documents
create policy "View eligibility rules" on public.eligibility_rules
    for select using (
        exists (
            select 1 from public.plan_versions pv
            where pv.id = eligibility_rules.plan_version_id
              and (
                  pv.workflow_status = 'published' or
                  public.has_role(auth.uid(), 'editor') or
                  public.has_role(auth.uid(), 'reviewer') or
                  public.has_role(auth.uid(), 'admin')
              )
        )
    );

create policy "Manage eligibility rules" on public.eligibility_rules
    for all using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

create policy "View price options" on public.price_options
    for select using (
        exists (
            select 1 from public.eligibility_rules er
            join public.plan_versions pv on pv.id = er.plan_version_id
            where er.id = price_options.eligibility_rule_id
              and (
                  pv.workflow_status = 'published' or
                  public.has_role(auth.uid(), 'editor') or
                  public.has_role(auth.uid(), 'reviewer') or
                  public.has_role(auth.uid(), 'admin')
              )
        )
    );

create policy "Manage price options" on public.price_options
    for all using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

create policy "View version coverages" on public.version_coverages
    for select using (
        exists (
            select 1 from public.plan_versions pv
            where pv.id = version_coverages.plan_version_id
              and (
                  pv.workflow_status = 'published' or
                  public.has_role(auth.uid(), 'editor') or
                  public.has_role(auth.uid(), 'reviewer') or
                  public.has_role(auth.uid(), 'admin')
              )
        )
    );

create policy "Manage version coverages" on public.version_coverages
    for all using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

create policy "View overrides" on public.option_coverage_overrides
    for select using (
        exists (
            select 1 from public.price_options po
            join public.eligibility_rules er on er.id = po.eligibility_rule_id
            join public.plan_versions pv on pv.id = er.plan_version_id
            where po.id = option_coverage_overrides.price_option_id
              and (
                  pv.workflow_status = 'published' or
                  public.has_role(auth.uid(), 'editor') or
                  public.has_role(auth.uid(), 'reviewer') or
                  public.has_role(auth.uid(), 'admin')
              )
        )
    );

create policy "Manage overrides" on public.option_coverage_overrides
    for all using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

create policy "View source documents" on public.source_documents
    for select using (
        exists (
            select 1 from public.plan_versions pv
            where pv.id = source_documents.plan_version_id
              and (
                  pv.workflow_status = 'published' or
                  public.has_role(auth.uid(), 'editor') or
                  public.has_role(auth.uid(), 'reviewer') or
                  public.has_role(auth.uid(), 'admin')
              )
        )
    );

create policy "Manage source documents" on public.source_documents
    for all using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

-- Audit logs: Read by Reviewers and Admins only, insert by system/authenticated
create policy "Reviewers and Admins can view audit logs" on public.audit_logs
    for select using (public.has_role(auth.uid(), 'reviewer') or public.has_role(auth.uid(), 'admin'));

create policy "System and editors can append audit logs" on public.audit_logs
    for insert with check (public.is_active_user(auth.uid()));
