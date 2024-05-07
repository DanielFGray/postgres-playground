export const defaultFiles: Record<string, string> = {
  "9001-queries.sql": `
select * from app_public.users;

select * from app_public.orders,
lateral app_public.order_status(orders) status;
`.trim(),
  "0001-setup.sql": `
drop schema if exists app_public cascade;
drop schema if exists app_private cascade;
drop schema if exists public;
drop role if exists visitor;
create schema app_public;
create schema app_private;
create role visitor;
`.trim(),
  "0020-sessions.sql": `
create table app_private.sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);
alter table app_private.sessions enable row level security;

create index on app_private.sessions (user_id);

create function app_public.current_session_id() returns uuid as $$
  select nullif(pg_catalog.current_setting('jwt.claims.session_id', true), '')::uuid;
$$ language sql stable;

create function app_public.current_user_id() returns uuid as $$
  select user_id from app_private.sessions where session_id = app_public.current_session_id();
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;

`.trim(),
  "0030-users.sql": `
create domain app_public.url as text check(value ~ '^https?://\S+');
create type app_public.role as enum ('user', 'driver', 'admin');

create table app_public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  avatar_url app_public.url,
  role app_public.role not null default 'user',
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table app_public.users enable row level security;

alter table app_private.sessions
  add constraint fk_user_id
  foreign key (user_id)
  references app_public.users on delete cascade;

create index on app_public.users (role, id);

create policy select_own on app_public.users
  for select using (id = app_public.current_user_id());
create policy update_own on app_public.users
  for update using (id = app_public.current_user_id());
grant select on app_public.users to visitor;
grant update(username, avatar_url) on app_public.users to visitor;
`.trim(),
  "0040-menu.sql": `
create table app_public.menu (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  price int not null check(price > 0),
  photo app_public.url not null,
  tags text[] not null default '{}',
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app_public.menu enable row level security;

create index on app_public.menu (created_at desc);
create index on app_public.menu using gin (tags);

create policy select_all_as_user on app_public.menu
  for select using (visible = true);

create policy all_as_admin on app_public.menu
  for all using (exists (
    select 1 from app_public.users
    where id = app_public.current_user_id()
      and role = 'admin'
  ));

grant
  select,
  insert (name, description, price, photo, tags, visible),
  update (name, description, price, photo, tags, visible),
  delete
  on app_public.menu to visitor;
`.trim(),
  "0050-cart.sql": `
create table app_public.carts (
  user_id uuid not null default app_public.current_user_id() references app_public.users on delete cascade,
  menu_id uuid not null references app_public.menu on delete cascade,
  quantity int not null default 1 check(quantity > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, menu_id)
);

alter table app_public.carts enable row level security;

create index on app_public.carts (user_id);

create policy handle_own on app_public.carts
  for all using (user_id = app_public.current_user_id());

grant
  select,
  insert (menu_id, quantity),
  update (quantity),
  delete
  on app_public.carts to visitor;
`.trim(),
  "0060-orders.sql": `
create type app_public.order_status as enum (
  'cancelled',
  'pending',
  'confirmed',
  'preparing',
  'prepared',
  'otw',
  'delivered',
  'completed'
);

create table app_public.orders (
  id bigint primary key generated always as identity,
  user_id uuid references app_public.users on delete set null,
  details jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app_public.orders enable row level security;

create index on app_public.orders (user_id, created_at desc);

create policy select_own_or_as_admin on app_public.orders
  for select using (
    user_id = app_public.current_user_id()
    or exists (
      select 1 from app_public.users
      where role = 'admin'
        and id = app_public.current_user_id()
  ));

grant select on app_public.orders to visitor;

create table app_public.order_updates (
  id bigint primary key generated always as identity,
  order_id bigint references app_public.orders on delete cascade,
  user_id uuid references app_public.users on delete set null,
  status app_public.order_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index on app_public.order_updates (order_id, created_at desc);

create function app_private.tg__order_status__insert_with_order() returns trigger as $$
begin
  insert into app_public.order_updates (order_id, user_id) values(NEW.id, NEW.user_id);
  return NEW;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;
create trigger _500_insert_order_status
  after insert on app_public.orders
  for each row
  execute procedure app_private.tg__order_status__insert_with_order();

create function app_public.order_status(o app_public.orders) returns app_public.order_status as $$
  select status from app_public.order_updates
  where order_id = o.id
  order by created_at desc
  limit 1
$$ language sql stable;
`.trim(),
};
