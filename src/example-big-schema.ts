export default function getWorkspace() {
  return {
    defaultLayout: {
      editors: [
        {
          uri: "/example.md",
          viewColumn: 1,
        },
      ],
      layout: {
        editors: {
          orientation: 0,
          groups: [{ size: 1 }],
        },
      },
    },
    files: {
      "/example.md": `
some seed data

\`\`\`sql
with make_user(id) as (
  select id from app_private
    .really_create_user('dfg', 'test@test.com', true, 'dfg', null)
)
insert into app_public.posts (user_id, title, body, tags)
  values ((select id from make_user), 'Hello world', 'This is a test post', '{test}')
  returning *;
\`\`\`

a query

\`\`\`sql
select
  posts.id,
  posts.tags,
  posts.title,
  score,
  popularity,
  current_user_voted,
  json_build_object(
    'id', u.id,
    'name', u.name,
    'username', u.username,
    'avatar_url', u.avatar_url,
    'role', role
  ) as user,
  posts.created_at,
  posts.updated_at
from
  app_public.posts
  join app_public.users u on posts.user_id = u.id,
  lateral app_public.posts_score(posts) as score,
  lateral app_public.posts_popularity(posts) as popularity,
  lateral app_public.posts_current_user_voted(posts) as current_user_voted;
\`\`\`

some more text
`.trim(),
      "/00010-setup.sql": `
drop schema if exists app_public cascade;
drop schema if exists app_hidden cascade;
drop schema if exists app_private cascade;
drop owned by appname_visitor cascade;
drop role if exists appname_visitor;

create role appname_visitor;

/*
 * The \`public\` *schema* contains things like PostgreSQL extensions. We
 * deliberately do not install application logic into the public schema
 * (instead storing it to app_public/app_hidden/app_private as appropriate),
 * but none the less we don't want untrusted roles to be able to install or
 * modify things into the public schema.
 *
 * The \`public\` *role* is automatically inherited by all other roles; we only
 * want specific roles to be able to access our database so we must revoke
 * access to the \`public\` role.
 */

revoke all on schema public from public;

alter default privileges revoke all on sequences from public;
alter default privileges revoke all on functions from public;

-- https://www.graphile.org/postgraphile/namespaces/#advice

create schema app_public;
create schema app_hidden;
create schema app_private;

-- The 'visitor' role (used by PostGraphile to represent an end user) may
-- access the public, app_public and app_hidden schemas (but _NOT_ the
-- app_private schema).

grant usage on schema public, app_public, app_hidden to appname_visitor;

-- We want the \`visitor\` role to be able to insert rows (\`serial\` data type
-- creates sequences, so we need to grant access to that).

alter default privileges in schema public, app_public, app_hidden
  grant usage, select on sequences to appname_visitor;

-- And the \`visitor\` role should be able to call functions too.

alter default privileges in schema public, app_public, app_hidden
  grant execute on functions to appname_visitor;

/*
 * These triggers are commonly used across many tables.
 */

-- This trigger is used to queue a job to inform a user that a significant
-- security change has been made to their account (e.g. adding a new email
-- address, linking a new social login).

create function app_private.tg__add_audit_job() returns trigger as $$
declare
  v_user_id uuid;
  v_type text = TG_ARGV[0];
  v_user_id_attribute text = TG_ARGV[1];
  v_extra_attribute1 text = TG_ARGV[2];
  v_extra_attribute2 text = TG_ARGV[3];
  v_extra_attribute3 text = TG_ARGV[4];
  v_extra1 text;
  v_extra2 text;
  v_extra3 text;
begin
  if v_user_id_attribute is null then
    raise exception 'Invalid tg__add_audit_job call';
  end if;

  execute 'select ($1.' || quote_ident(v_user_id_attribute) || ')::uuid'
    using (case when TG_OP = 'INSERT' then NEW else OLD end)
    into v_user_id;

  if v_extra_attribute1 is not null then
    execute 'select ($1.' || quote_ident(v_extra_attribute1) || ')::text'
      using (case when TG_OP = 'DELETE' then OLD else NEW end)
      into v_extra1;
  end if;
  if v_extra_attribute2 is not null then
    execute 'select ($1.' || quote_ident(v_extra_attribute2) || ')::text'
      using (case when TG_OP = 'DELETE' then OLD else NEW end)
      into v_extra2;
  end if;
  if v_extra_attribute3 is not null then
    execute 'select ($1.' || quote_ident(v_extra_attribute3) || ')::text'
      using (case when TG_OP = 'DELETE' then OLD else NEW end)
      into v_extra3;
  end if;

  return NEW;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

/*
 * This trigger is used on tables with created_at and updated_at to ensure that
 * these timestamps are kept valid (namely: \`created_at\` cannot be changed, and
 * \`updated_at\` must be monotonically increasing).
 */

create function app_private.tg__timestamps() returns trigger as $$
begin
  NEW.created_at = (case when TG_OP = 'INSERT' then NOW() else OLD.created_at end);
  NEW.updated_at = (case when TG_OP = 'UPDATE' and OLD.updated_at >= NOW() then OLD.updated_at + interval '1 millisecond' else NOW() end);
  return NEW;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;

/*
 * This trigger is useful for adding realtime features to our GraphQL schema
 * with minimal effort in the database. It's a very generic trigger function;
 * you're intended to pass three arguments when you call it:
 *
 * 1. The "event" name to include, this is an arbitrary string.
 * 2. The "topic" template that we'll be publishing the event to. A \`$1\` in
 *    this may be added as a placeholder which will be replaced by the
 *    "subject" value.
 * 3. The "subject" column, we'll read the value of this column from the NEW
 *    (for insert/update) or OLD (for delete) record and include it in the
 *    event payload.
 *
 * A PostgreSQL \`NOTIFY\` will be issued to the topic (or "channel") generated
 * from arguments 2 and 3, the body of the notification will be a stringified
 * JSON object containing \`event\`, \`sub\` (the subject specified by argument 3)
 * and \`id\` (the record id).
 *
 * Example:
 *
 *     create trigger _500_gql_update
 *       after update on app_public.users
 *       for each row
 *       execute procedure app_public.tg__graphql_subscription(
 *         'userChanged', -- the "event" string, useful for the client to know what happened
 *         'graphql:user:$1', -- the "topic" the event will be published to, as a template
 *         'id' -- If specified, \`$1\` above will be replaced with NEW.id or OLD.id from the trigger.
 *       );
 */

create function app_public.tg__graphql_subscription() returns trigger as $$
declare
  v_process_new bool = (TG_OP = 'INSERT' OR TG_OP = 'UPDATE');
  v_process_old bool = (TG_OP = 'UPDATE' OR TG_OP = 'DELETE');
  v_event text = TG_ARGV[0];
  v_topic_template text = TG_ARGV[1];
  v_attribute text = TG_ARGV[2];
  v_record record;
  v_sub text;
  v_topic text;
  v_i int = 0;
  v_last_topic text;
begin
  for v_i in 0..1 loop
    if (v_i = 0) and v_process_new is true then
      v_record = new;
    elsif (v_i = 1) and v_process_old is true then
      v_record = old;
    else
      continue;
    end if;
     if v_attribute is not null then
      execute 'select $1.' || quote_ident(v_attribute)
        using v_record
        into v_sub;
    end if;
    if v_sub is not null then
      v_topic = replace(v_topic_template, '$1', v_sub);
    else
      v_topic = v_topic_template;
    end if;
    if v_topic is distinct from v_last_topic then
      -- This if statement prevents us from triggering the same notification twice
      v_last_topic = v_topic;
      perform pg_notify(v_topic, json_build_object(
        'event', v_event,
        'subject', v_sub,
        'id', v_record.id
      )::text);
    end if;
  end loop;
  return v_record;
end;
$$ language plpgsql volatile;
`.trim(),
      "/00020-user-auth.sql": `
/*
 * This table is used (only) by \`connect-pg-simple\` (see \`installSession.ts\`)
 * to track cookie session information at the webserver (\`express\`) level if
 * you don't have a redis server. If you're using redis everywhere (including
 * development) then you don't need this table.
 *
 * Do not confuse this with the \`app_private.sessions\` table.
 */

create table app_private.connect_pg_simple_sessions (
  sid varchar not null,
  sess json not null,
  expire timestamp not null
);
alter table app_private.connect_pg_simple_sessions
  enable row level security;
alter table app_private.connect_pg_simple_sessions
  add constraint session_pkey primary key (sid) not deferrable initially immediate;

/*
 * The sessions table is used to track who is logged in, if there are any
 * restrictions on that session, when it was last active (so we know if it's
 * still valid), etc.
 *
 * In Starter we only have an extremely limited implementation of this, but you
 * could add things like "last_auth_at" to it so that you could track when they
 * last officially authenticated; that way if you have particularly dangerous
 * actions you could require them to log back in to allow them to perform those
 * actions. (GitHub does this when you attempt to change the settings on a
 * repository, for example.)
 *
 * The primary key is a cryptographically secure random uuid; the value of this
 * primary key should be secret, and only shared with the user themself. We
 * currently wrap this session in a webserver-level session (either using
 * redis, or using \`connect-pg-simple\` which uses the
 * \`connect_pg_simple_sessions\` table which we defined previously) so that we
 * don't even send the raw session id to the end user, but you might want to
 * consider exposing it for things such as mobile apps or command line
 * utilities that may not want to implement cookies to maintain a cookie
 * session.
 */

create table app_private.sessions (
  uuid uuid not null default gen_random_uuid() primary key,
  user_id uuid not null,
  -- You could add access restriction columns here if you want, e.g. for OAuth scopes.
  created_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);
alter table app_private.sessions
  enable row level security;

-- To allow us to efficiently see what sessions are open for a particular user.

create index on app_private.sessions (user_id);

/*
 * This function is responsible for reading the \`jwt.claims.session_id\`
 * transaction setting (set from the \`pgSettings\` function within
 * \`installPostGraphile.ts\`). Defining this inside a function means we can
 * modify it in future to allow additional ways of defining the session.
 */

-- Note we have this in \`app_public\` but it doesn't show up in the GraphQL
-- schema because we've used \`postgraphile.tags.jsonc\` to omit it. We could
-- have put it in app_hidden to get the same effect more easily, but it's often
-- useful to un-omit it to ease debugging auth issues.

create function app_public.current_session_id() returns uuid as $$
  select nullif(pg_catalog.current_setting('jwt.claims.session_id', true), '')::uuid;
$$ language sql stable;


/*
 * We can figure out who the current user is by looking up their session in the
 * sessions table using the \`current_session_id()\` function.
 *
 * A less secure but more performant version of this function might contain only:
 *
 *   select nullif(pg_catalog.current_setting('jwt.claims.user_id', true), '')::uuid;
 *
 * The increased security of this implementation is because even if someone gets
 * the ability to run SQL within this transaction they cannot impersonate
 * another user without knowing their session_id (which should be closely
 * guarded).
 *
 * The below implementation is more secure than simply indicating the user_id
 * directly: even if an SQL injection vulnerability were to allow a user to set
 * their \`jwt.claims.session_id\` to another value, it would take them many
 * millennia to be able to correctly guess someone else's session id (since it's
 * a cryptographically secure random value that is kept secret). This makes
 * impersonating another user virtually impossible.
 */

create function app_public.current_user_id() returns uuid as $$
  select user_id from app_private.sessions where uuid = app_public.current_session_id();
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;

/*
 * The users table stores (unsurprisingly) the users of our application. You'll
 * notice that it does NOT contain private information such as the user's
 * password or their email address; that's because the users table is seen as
 * public - anyone who can "see" the user can see this information.
 *
 * The author sees \`role\` and \`is_verified\` as public information; if you
 * disagree then you should relocate these attributes to another table, such as
 * \`user_secrets\`.
 */

create type app_public.user_role as enum ('user', 'admin');

create table app_public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check(length(username) >= 2 and length(username) <= 24 and username ~ '^[a-zA-Z]([_]?[a-zA-Z0-9])+$'),
  name text,
  avatar_url text check(avatar_url ~ '^https?://[^/]+'),
  role app_public.user_role not null default 'user',
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table app_public.users
  enable row level security;

-- We couldn't implement this relationship on the sessions table until the users table existed!

alter table app_private.sessions
  add constraint sessions_user_id_fkey
  foreign key ("user_id") references app_public.users on delete cascade;

-- Users are publicly visible, like on GitHub, Twitter, Facebook, Trello, etc.

create policy select_all on app_public.users
  for select using (true);

-- You can only update yourself.

create policy update_self on app_public.users
  for update using (id = app_public.current_user_id());
grant select on app_public.users to appname_visitor;

-- NOTE: \`insert\` is not granted, because we'll handle that separately

grant update(username, name, avatar_url) on app_public.users to appname_visitor;

-- NOTE: \`delete\` is not granted, because we require confirmation via request_account_deletion/confirm_account_deletion

create trigger _100_timestamps
  before insert or update on app_public.users
  for each row
  execute procedure app_private.tg__timestamps();

/**********/

-- Returns the current user; this is a "custom query" function; see:
-- https://www.graphile.org/postgraphile/custom-queries/
-- So this will be queryable via GraphQL as \`{ currentUser { ... } }\`

create function app_public.current_user() returns app_public.users as $$
  select users.* from app_public.users where id = app_public.current_user_id();
$$ language sql stable;

/**********/

-- The users table contains all the public information, but we need somewhere
-- to store private information. In fact, this data is so private that we don't
-- want the user themselves to be able to see it - things like the bcrypted
-- password hash, timestamps of recent login attempts (to allow us to
-- auto-protect user accounts that are under attack), etc.

create table app_private.user_secrets (
  user_id uuid not null primary key references app_public.users on delete cascade,
  password_hash text,
  last_login_at timestamptz not null default now(),
  failed_password_attempts int not null default 0,
  first_failed_password_attempt timestamptz,
  reset_password_token text,
  reset_password_token_generated timestamptz,
  failed_reset_password_attempts int not null default 0,
  first_failed_reset_password_attempt timestamptz,
  delete_account_token text,
  delete_account_token_generated timestamptz
);
alter table app_private.user_secrets
  enable row level security;

/*
 * When we insert into \`users\` we _always_ want there to be a matching
 * \`user_secrets\` entry, so we have a trigger to enforce this:
 */

create function app_private.tg_user_secrets__insert_with_user() returns trigger as $$
begin
  insert into app_private.user_secrets(user_id) values(NEW.id);
  return NEW;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;
create trigger _500_insert_secrets
  after insert on app_public.users
  for each row
  execute procedure app_private.tg_user_secrets__insert_with_user();

/*
 * Because you can register with username/password or using OAuth (social
 * login), we need a way to tell the user whether or not they have a
 * password. This is to help the UI display the right interface: change
 * password or set password.
 */

create function app_public.users_has_password(u app_public.users) returns boolean as $$
  select (password_hash is not null) from app_private.user_secrets where user_secrets.user_id = u.id and u.id = app_public.current_user_id();
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;

/*
 * When the user validates their email address we want the UI to be notified
 * immediately, so we'll issue a notification to the \`graphql:user:*\` topic
 * which GraphQL users can subscribe to via the \`currentUserUpdated\`
 * subscription field.
 */

create trigger _500_gql_update
  after update on app_public.users
  for each row
  execute procedure app_public.tg__graphql_subscription(
    'userChanged', -- the "event" string, useful for the client to know what happened
    'graphql:user:$1', -- the "topic" the event will be published to, as a template
    'id' -- If specified, \`$1\` above will be replaced with NEW.id or OLD.id from the trigger.
  );

/*
 * A user may have more than one email address; this is useful when letting the
 * user change their email so that they can verify the new one before deleting
 * the old one, but is also generally useful as they might want to use
 * different emails to log in versus where to send notifications. Therefore we
 * track user emails in a separate table.
 */

create table app_public.user_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default app_public.current_user_id() references app_public.users on delete cascade,
  email text not null check (email ~ '[^@]+@[^@]+\.[^@]+'),
  is_verified boolean not null default false,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Each user can only have an email once.
  constraint user_emails_user_id_email_key unique(user_id, email),
  -- An unverified email cannot be set as the primary email.
  constraint user_emails_must_be_verified_to_be_primary check(is_primary is false or is_verified is true)
);
alter table app_public.user_emails
  enable row level security;

-- Once an email is verified, it may only be used by one user. (We can't
-- enforce this before an email is verified otherwise it could be used to
-- prevent a legitimate user from signing up.)

create unique index uniq_user_emails_verified_email on app_public.user_emails(email) where (is_verified is true);

-- Only one primary email per user.

create unique index uniq_user_emails_primary_email on app_public.user_emails (user_id) where (is_primary is true);

-- Allow efficient retrieval of all the emails owned by a particular user.

create index idx_user_emails_user on app_public.user_emails (user_id);

-- For the user settings page sorting

create index idx_user_emails_primary on app_public.user_emails (is_primary, user_id);

-- Keep created_at and updated_at up to date.

create trigger _100_timestamps
  before insert or update on app_public.user_emails
  for each row
  execute procedure app_private.tg__timestamps();

-- When an email address is added to a user, notify them (in case their account was compromised).

create trigger _500_audit_added
  after insert on app_public.user_emails
  for each row
  execute procedure app_private.tg__add_audit_job(
    'added_email',
    'user_id',
    'id',
    'email'
  );

-- When an email address is removed from a user, notify them (in case their account was compromised).

create trigger _500_audit_removed
  after delete on app_public.user_emails
  for each row
  execute procedure app_private.tg__add_audit_job(
    'removed_email',
    'user_id',
    'id',
    'email'
  );

-- You can't verify an email address that someone else has already verified. (Email is taken.)

create function app_public.tg_user_emails__forbid_if_verified() returns trigger as $$
begin
  if exists(select 1 from app_public.user_emails where email = NEW.email and is_verified is true) then
    raise exception 'An account using that email address has already been created.' using errcode='EMTKN';
  end if;
  return NEW;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;
create trigger _200_forbid_existing_email before insert on app_public.user_emails for each row execute procedure app_public.tg_user_emails__forbid_if_verified();

-- Users may only manage their own emails.

create policy select_own on app_public.user_emails
  for select using (user_id = app_public.current_user_id());
create policy insert_own on app_public.user_emails
  for insert with check (user_id = app_public.current_user_id());

-- NOTE: we don't allow emails to be updated, instead add a new email and delete the old one.

create policy delete_own on app_public.user_emails
  for delete using (user_id = app_public.current_user_id());

grant select on app_public.user_emails to appname_visitor;
grant insert (email) on app_public.user_emails to appname_visitor;

-- No update

grant delete on app_public.user_emails to appname_visitor;

-- Prevent deleting the user's last email, otherwise they can't access password reset/etc.

create function app_public.tg_user_emails__prevent_delete_last_email() returns trigger as $$
begin
  if exists (
    with remaining as (
      select user_emails.user_id
      from app_public.user_emails
      inner join deleted
      on user_emails.user_id = deleted.user_id
      -- Don't delete last verified email
      where (user_emails.is_verified is true or not exists (
        select 1
        from deleted d2
        where d2.user_id = user_emails.user_id
        and d2.is_verified is true
      ))
      order by user_emails.id asc

      /*
       * Lock this table to prevent race conditions; see:
       * https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/
       */
      for update of user_emails
    )
    select 1
    from app_public.users
    where id in (
      select user_id from deleted
      except
      select user_id from remaining
    )
  )
  then
    raise exception 'You must have at least one (verified) email address' using errcode = 'CDLEA';
  end if;

  return null;
end;
$$ language plpgsql
  -- Security definer is required for 'FOR UPDATE OF' since we don't grant UPDATE privileges.
  security definer
  set search_path = pg_catalog, public, pg_temp;

-- Note this check runs AFTER the email was deleted. If the user was deleted
-- then their emails will also be deleted (thanks to the foreign key on delete
-- cascade) and this is desirable; we only want to prevent the deletion if
-- the user still exists so we check after the statement completes.

create trigger _500_prevent_delete_last
  after delete on app_public.user_emails
  referencing old table as deleted
  for each statement
  execute procedure app_public.tg_user_emails__prevent_delete_last_email();

/**********/

/*
 * Just like with users and user_secrets, there are secrets for emails that we
 * don't want the user to be able to see - for example the verification token.
 * Like with user_secrets we automatically create a record in this table
 * whenever a record is added to user_emails.
 */

create table app_private.user_email_secrets (
  user_email_id uuid primary key references app_public.user_emails on delete cascade,
  verification_token text,
  verification_email_sent_at timestamptz,
  password_reset_email_sent_at timestamptz
);
alter table app_private.user_email_secrets
  enable row level security;

create function app_private.tg_user_email_secrets__insert_with_user_email() returns trigger as $$
declare
  v_verification_token text;
begin
  if NEW.is_verified is false then
    v_verification_token = encode(gen_random_bytes(8), 'hex');
  end if;
  insert into app_private.user_email_secrets(user_email_id, verification_token) values(NEW.id, v_verification_token);
  return NEW;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;
create trigger _500_insert_secrets
  after insert on app_public.user_emails
  for each row
  execute procedure app_private.tg_user_email_secrets__insert_with_user_email();

/**********/

/*
 * When the user receives the email verification message it will contain the
 * token; this function is responsible for checking the token and marking the
 * email as verified if it matches. Note it is a \`SECURITY DEFINER\` function,
 * which means it runs with the security of the user that defined the function
 * (which is the database owner) - i.e. it can do anything the database owner
 * can do. This means we have to be very careful what we put in the function,
 * and make sure that it checks that the user is allowed to do what they're
 * trying to do - in this case, we do that check by ensuring the token matches.
 */

create function app_public.verify_email(user_email_id uuid, token text) returns boolean as $$
begin
  update app_public.user_emails
  set
    is_verified = true,
    is_primary = is_primary or not exists(
      select 1 from app_public.user_emails other_email where other_email.user_id = user_emails.user_id and other_email.is_primary is true
    )
  where id = user_email_id
  and exists(
    select 1 from app_private.user_email_secrets where user_email_secrets.user_email_id = user_emails.id and verification_token = token
  );
  return found;
end;
$$ language plpgsql strict volatile security definer set search_path to pg_catalog, public, pg_temp;

/*
 * When the users first email address is verified we will mark their account as
 * verified, which can unlock additional features that were gated behind an
 * \`isVerified\` check.
 */

create function app_public.tg_user_emails__verify_account_on_verified() returns trigger as $$
begin
  update app_public.users set is_verified = true where id = new.user_id and is_verified is false;
  return new;
end;
$$ language plpgsql strict volatile security definer set search_path to pg_catalog, public, pg_temp;

create trigger _500_verify_account_on_verified
  after insert or update of is_verified
  on app_public.user_emails
  for each row
  when (new.is_verified is true)
  execute procedure app_public.tg_user_emails__verify_account_on_verified();

/*
 * In addition to logging in with username/email and password, users may use
 * other authentication methods, such as "social login" (OAuth) with GitHub,
 * Twitter, Facebook, etc. We store details of these logins to the
 * user_authentications and user_authentication_secrets tables.
 *
 * The user is allowed to delete entries in this table (which will unlink them
 * from that service), but adding records to the table requires elevated
 * privileges (it's managed by the \`installPassportStrategy.ts\` middleware,
 * which calls out to the \`app_private.link_or_register_user\` database
 * function).
 */

create table app_public.user_authentications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_public.users on delete cascade,
  service text not null,
  identifier text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uniq_user_authentications unique(service, identifier)
);

alter table app_public.user_authentications
  enable row level security;

-- Make it efficient to find all the authentications for a particular user.

create index on app_public.user_authentications(user_id);

-- Keep created_at and updated_at up to date.

create trigger _100_timestamps
  before insert or update on app_public.user_authentications
  for each row
  execute procedure app_private.tg__timestamps();

-- Users may view and delete their social logins.

create policy select_own on app_public.user_authentications
  for select using (user_id = app_public.current_user_id());
create policy delete_own on app_public.user_authentications
  for delete using (user_id = app_public.current_user_id());

-- TODO: on delete, check this isn't the last one, or that they have a verified
-- email address or password. For now we're not worrying about that since all
-- the OAuth providers we use verify the email address.

-- Notify the user if a social login is removed.

create trigger _500_audit_removed
  after delete on app_public.user_authentications
  for each row
  execute procedure app_private.tg__add_audit_job(
    'unlinked_account',
    'user_id',
    'service',
    'identifier'
  );

-- NOTE: we don't need to notify when a linked account is added here because
-- that's handled in the link_or_register_user function.

grant select on app_public.user_authentications to appname_visitor;
grant delete on app_public.user_authentications to appname_visitor;

/**********/

-- This table contains secret information for each user_authentication; could
-- be things like access tokens, refresh tokens, profile information. Whatever
-- the passport strategy deems necessary.

create table app_private.user_authentication_secrets (
  user_authentication_id uuid not null primary key references app_public.user_authentications on delete cascade,
  details jsonb not null default '{}'::jsonb
);
alter table app_private.user_authentication_secrets
  enable row level security;

-- NOTE: user_authentication_secrets doesn't need an auto-inserter as we handle
-- that everywhere that can create a user_authentication row.

/*
 * This function handles logging in a user with their username (or email
 * address) and password.
 *
 * Note that it is not in app_public; this function is intended to be called
 * with elevated privileges (namely from \`PassportLoginPlugin.ts\`). The reason
 * for this is because we want to be able to track failed login attempts (to
 * help protect user accounts). If this were callable by a user, they could
 * roll back the transaction when a login fails and no failed attempts would be
 * logged, effectively giving them infinite retries. We want to disallow this,
 * so we only let code call into \`login\` that we trust to not roll back the
 * transaction afterwards.
 */

create function app_private.login(username text, password text) returns app_private.sessions as $$
declare
  v_user app_public.users;
  v_user_secret app_private.user_secrets;
  v_login_attempt_window_duration interval = interval '5 minutes';
  v_session app_private.sessions;
begin
  if username like '%@%' then
    -- It's an email
    select users.* into v_user
    from app_public.users
    inner join app_public.user_emails
    on (user_emails.user_id = users.id)
    where user_emails.email = login.username
    order by
      user_emails.is_verified desc, -- Prefer verified email
      user_emails.created_at asc -- Failing that, prefer the first registered (unverified users _should_ verify before logging in)
    limit 1;
  else
    -- It's a username
    select users.* into v_user
    from app_public.users
    where users.username = login.username;
  end if;

  -- No user with that email/username was found
  if v_user is null then
    return null;
  end if;

  -- otherwise load their secrets
  select * into v_user_secret from app_private.user_secrets
  where user_secrets.user_id = v_user.id;

  -- Have there been too many login attempts?
  if (
    v_user_secret.first_failed_password_attempt is not null
  and
    v_user_secret.first_failed_password_attempt > NOW() - v_login_attempt_window_duration
  and
    v_user_secret.failed_password_attempts >= 3
  ) then
    raise exception 'User account locked - too many login attempts. Try again after 5 minutes.' using errcode = 'LOCKD';
  end if;

  -- Not too many login attempts, let's check the password.
  -- NOTE: \`password_hash\` could be null, this is fine since \`NULL = NULL\` is null, and null is falsy.
  if v_user_secret.password_hash = crypt(password, v_user_secret.password_hash) then
    -- Excellent - they're logged in! Let's reset the attempt tracking
    update app_private.user_secrets
    set failed_password_attempts = 0, first_failed_password_attempt = null, last_login_at = now()
    where user_id = v_user.id;
    -- Create a session for the user
    insert into app_private.sessions (user_id) values (v_user.id) returning * into v_session;
    -- And finally return the session
    return v_session;
  else
    -- Wrong password, bump all the attempt tracking figures
    update app_private.user_secrets
    set
      failed_password_attempts = (case when first_failed_password_attempt is null or first_failed_password_attempt < now() - v_login_attempt_window_duration then 1 else failed_password_attempts + 1 end),
      first_failed_password_attempt = (case when first_failed_password_attempt is null or first_failed_password_attempt < now() - v_login_attempt_window_duration then now() else first_failed_password_attempt end)
    where user_id = v_user.id;
    return null; -- Must not throw otherwise transaction will be aborted and attempts won't be recorded
  end if;
end;
$$ language plpgsql strict volatile;

/*
 * Logging out deletes the session, and clears the session_id in the
 * transaction. This is a \`SECURITY DEFINER\` function, so we check that the
 * user is allowed to do it by matching the current_session_id().
 */

create function app_public.logout() returns void as $$
begin
  -- Delete the session
  delete from app_private.sessions where uuid = app_public.current_session_id();
  -- Clear the identifier from the transaction
  perform set_config('jwt.claims.session_id', '', true);
end;
$$ language plpgsql security definer volatile set search_path to pg_catalog, public, pg_temp;

/*
 * When a user forgets their password we want to let them set a new one; but we
 * need to be very careful with this. We don't want to reveal whether or not an
 * account exists by the email address, so we email the entered email address
 * whether or not it's registered. If it's not registered, we track these
 * attempts in \`unregistered_email_password_resets\` to ensure that we don't
 * allow spamming the address; otherwise we store it to \`user_email_secrets\`.
 *
 * \`app_public.forgot_password\` is responsible for checking these things and
 * queueing a reset password token to be emailed to the user. For what happens
 * after the user receives this email, see instead \`app_private.reset_password\`.
 *
 * NOTE: unlike app_private.login and app_private.reset_password, rolling back
 * the results of this function will not cause any security issues so we do not
 * need to call it indirectly as we do for those other functions. (Rolling back
 * will undo the tracking of when we sent the email but it will also prevent
 * the email being sent, so it's harmless.)
 */

create table app_private.unregistered_email_password_resets (
  email text constraint unregistered_email_pkey primary key,
  attempts int not null default 1,
  latest_attempt timestamptz not null
);

/**********/

create function app_public.forgot_password(email text) returns void as $$
declare
  v_user_email app_public.user_emails;
  v_token text;
  v_token_min_duration_between_emails interval = interval '3 minutes';
  v_token_max_duration interval = interval '3 days';
  v_now timestamptz = clock_timestamp(); -- Function can be called multiple during transaction
  v_latest_attempt timestamptz;
begin
  -- Find the matching user_email:
  select user_emails.* into v_user_email
  from app_public.user_emails
  where user_emails.email = forgot_password.email
  order by is_verified desc, id desc;

  -- If there is no match:
  if v_user_email is null then
    -- This email doesn't exist in the system; trigger an email stating as much.

    -- We do not allow this email to be triggered more than once every 15
    -- minutes, so we need to track it:
    insert into app_private.unregistered_email_password_resets (email, latest_attempt)
      values (forgot_password.email, v_now)
      on conflict on constraint unregistered_email_pkey
      do update
        set latest_attempt = v_now, attempts = unregistered_email_password_resets.attempts + 1
        where unregistered_email_password_resets.latest_attempt < v_now - interval '15 minutes'
      returning latest_attempt into v_latest_attempt;

    -- TODO: we should clear out the unregistered_email_password_resets table periodically.

    return;
  end if;

  -- There was a match.
  -- See if we've triggered a reset recently:
  if exists(
    select 1
    from app_private.user_email_secrets
    where user_email_id = v_user_email.id
    and password_reset_email_sent_at is not null
    and password_reset_email_sent_at > v_now - v_token_min_duration_between_emails
  ) then
    -- If so, take no action.
    return;
  end if;

  -- Fetch or generate reset token:
  update app_private.user_secrets
  set
    reset_password_token = (
      case
      when reset_password_token is null or reset_password_token_generated < v_now - v_token_max_duration
      then encode(gen_random_bytes(8), 'hex')
      else reset_password_token
      end
    ),
    reset_password_token_generated = (
      case
      when reset_password_token is null or reset_password_token_generated < v_now - v_token_max_duration
      then v_now
      else reset_password_token_generated
      end
    )
  where user_id = v_user_email.user_id
  returning reset_password_token into v_token;

  -- Don't allow spamming an email:
  update app_private.user_email_secrets
  set password_reset_email_sent_at = v_now
  where user_email_id = v_user_email.id;
end;
$$ language plpgsql strict security definer volatile set search_path to pg_catalog, public, pg_temp;

/*
 * This is the second half of resetting a users password, please see
 * \`app_public.forgot_password\` for the first half.
 *
 * The \`app_private.reset_password\` function checks the reset token is correct
 * and sets the user's password to be the newly provided password, assuming
 * \`assert_valid_password\` is happy with it. If the attempt fails, this is
 * logged to avoid a brute force attack. Since we cannot risk this tracking
 * being lost (e.g. by a later error rolling back the transaction), we put this
 * function into app_private and explicitly call it from the \`resetPassword\`
 * field in \`PassportLoginPlugin.ts\`.
 */

create function app_private.assert_valid_password(new_password text) returns void as $$
begin
  -- TODO: add better assertions!
  if length(new_password) < 8 then
    raise exception 'Password is too weak' using errcode = 'WEAKP';
  end if;
end;
$$ language plpgsql volatile;

create function app_private.reset_password(user_id uuid, reset_token text, new_password text) returns boolean as $$
declare
  v_user app_public.users;
  v_user_secret app_private.user_secrets;
  v_token_max_duration interval = interval '3 days';
begin
  select users.* into v_user
  from app_public.users
  where id = user_id;

  if v_user is null then
    -- No user with that id was found
    return null;
  end if;

  -- Load their secrets
  select * into v_user_secret from app_private.user_secrets
  where user_secrets.user_id = v_user.id;

  -- Have there been too many reset attempts?
  if (
    v_user_secret.first_failed_reset_password_attempt is not null
  and
    v_user_secret.first_failed_reset_password_attempt > NOW() - v_token_max_duration
  and
    v_user_secret.failed_reset_password_attempts >= 20
  ) then
    raise exception 'Password reset locked - too many reset attempts' using errcode = 'LOCKD';
  end if;

  -- Not too many reset attempts, let's check the token
  if v_user_secret.reset_password_token != reset_token then
    -- Wrong token, bump all the attempt tracking figures
    update app_private.user_secrets
    set
      failed_reset_password_attempts = (case when first_failed_reset_password_attempt is null or first_failed_reset_password_attempt < now() - v_token_max_duration then 1 else failed_reset_password_attempts + 1 end),
      first_failed_reset_password_attempt = (case when first_failed_reset_password_attempt is null or first_failed_reset_password_attempt < now() - v_token_max_duration then now() else first_failed_reset_password_attempt end)
    where user_secrets.user_id = v_user.id;
    return null;
  end if;
  -- Excellent - they're legit

  perform app_private.assert_valid_password(new_password);

  -- Let's reset the password as requested
  update app_private.user_secrets
  set
    password_hash = crypt(new_password, gen_salt('bf')),
    failed_password_attempts = 0,
    first_failed_password_attempt = null,
    reset_password_token = null,
    reset_password_token_generated = null,
    failed_reset_password_attempts = 0,
    first_failed_reset_password_attempt = null
  where user_secrets.user_id = v_user.id;

  -- Revoke the users' sessions
  delete from app_private.sessions
  where sessions.user_id = v_user.id;

  return true;
end;
$$ language plpgsql strict volatile;

/*
 * For security reasons we don't want to allow a user to just delete their user
 * account without confirmation; so we have them request deletion, receive an
 * email, and then click the link in the email and press a button to confirm
 * deletion. This function handles the first step in this process; see
 * \`app_public.confirm_account_deletion\` for the second half.
 */

create function app_public.request_account_deletion() returns boolean as $$
declare
  v_user_email app_public.user_emails;
  v_token text;
  v_token_max_duration interval = interval '3 days';
begin
  if app_public.current_user_id() is null then
    raise exception 'You must log in to delete your account' using errcode = 'LOGIN';
  end if;

  -- Get the email to send account deletion token to
  select * into v_user_email
    from app_public.user_emails
    where user_id = app_public.current_user_id()
    order by is_primary desc, is_verified desc, id desc
    limit 1;

  -- Fetch or generate token
  update app_private.user_secrets
  set
    delete_account_token = (
      case
      when delete_account_token is null or delete_account_token_generated < NOW() - v_token_max_duration
      then encode(gen_random_bytes(8), 'hex')
      else delete_account_token
      end
    ),
    delete_account_token_generated = (
      case
      when delete_account_token is null or delete_account_token_generated < NOW() - v_token_max_duration
      then now()
      else delete_account_token_generated
      end
    )
  where user_id = app_public.current_user_id()
  returning delete_account_token into v_token;

  return true;
end;
$$ language plpgsql strict security definer volatile set search_path to pg_catalog, public, pg_temp;

/*
 * This is the second half of the account deletion process, for the first half
 * see \`app_public.request_account_deletion\`.
 */

create function app_public.confirm_account_deletion(token text) returns boolean as $$
declare
  v_user_secret app_private.user_secrets;
  v_token_max_duration interval = interval '3 days';
begin
  if app_public.current_user_id() is null then
    raise exception 'You must log in to delete your account' using errcode = 'LOGIN';
  end if;

  select * into v_user_secret
    from app_private.user_secrets
    where user_secrets.user_id = app_public.current_user_id();

  if v_user_secret is null then
    -- Success: they're already deleted
    return true;
  end if;

  -- Check the token
  if (
    -- token is still valid
    v_user_secret.delete_account_token_generated > now() - v_token_max_duration
  and
    -- token matches
    v_user_secret.delete_account_token = token
  ) then
    -- Token passes; delete their account :(
    delete from app_public.users where id = app_public.current_user_id();
    return true;
  end if;

  raise exception 'The supplied token was incorrect - perhaps you''re logged in to the wrong account, or the token has expired?' using errcode = 'DNIED';
end;
$$ language plpgsql strict volatile security definer set search_path to pg_catalog, public, pg_temp;

/*
 * To change your password you must specify your previous password. The form in
 * the web UI may confirm that the new password was typed correctly by making
 * the user type it twice, but that isn't necessary in the API.
 */

create function app_public.change_password(old_password text, new_password text) returns boolean as $$
declare
  v_user app_public.users;
  v_user_secret app_private.user_secrets;
begin
  select users.* into v_user
  from app_public.users
  where id = app_public.current_user_id();

  if not (v_user is null) then
    raise exception 'You must log in to change your password' using errcode = 'LOGIN';
  end if;

  -- Load their secrets
  select * into v_user_secret from app_private.user_secrets
  where user_secrets.user_id = v_user.id;

  if v_user_secret.password_hash != crypt(old_password, v_user_secret.password_hash) then
    raise exception 'Incorrect password' using errcode = 'CREDS';
  end if;

  perform app_private.assert_valid_password(new_password);

  -- Reset the password as requested
  update app_private.user_secrets
  set
    password_hash = crypt(new_password, gen_salt('bf'))
  where user_secrets.user_id = v_user.id;

  -- Revoke all other sessions
  delete from app_private.sessions
  where sessions.user_id = v_user.id
  and sessions.uuid <> app_public.current_session_id();

  return true;
end;
$$ language plpgsql strict volatile security definer set search_path to pg_catalog, public, pg_temp;

/*
 * A user account may be created explicitly via the GraphQL \`register\` mutation
 * (which calls \`really_create_user\` below), or via OAuth (which, via
 * \`installPassportStrategy.ts\`, calls link_or_register_user below, which may
 * then call really_create_user). Ultimately \`really_create_user\` is called in
 * all cases to create a user account within our system, so it must do
 * everything we'd expect in this case including validating username/password,
 * setting the password (if any), storing the email address, etc.
 */

create function app_private.really_create_user(
  username text,
  email text,
  email_is_verified bool,
  name text,
  avatar_url text,
  password text default null
) returns app_public.users as $$
declare
  v_user app_public.users;
  v_username text = username;
begin
  if email is null then
    raise exception 'Email is required' using errcode = 'MODAT';
  end if;

  if password is not null then
    perform app_private.assert_valid_password(password);
  end if;

  -- Insert the new user
  insert into app_public.users (username, name, avatar_url) values
    (v_username, name, avatar_url)
    returning * into v_user;

  -- Add the user's email
  insert into app_public.user_emails (user_id, email, is_verified, is_primary)
  values (v_user.id, email, email_is_verified, email_is_verified);

  -- Store the password
  if password is not null then
    update app_private.user_secrets
    set password_hash = crypt(password, gen_salt('bf'))
    where user_id = v_user.id;
  end if;

  -- Refresh the user
  select * into v_user from app_public.users where id = v_user.id;

  return v_user;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;

/**********/

/*
 * The \`register_user\` function is called by \`link_or_register_user\` when there
 * is no matching user to link the login to, so we want to register the user
 * using OAuth or similar credentials.
 */

create function app_private.register_user(
  f_service character varying,
  f_identifier character varying,
  f_profile json,
  f_auth_details json,
  f_email_is_verified boolean default false
) returns app_public.users as $$
declare
  v_user app_public.users;
  v_email text;
  v_name text;
  v_username text;
  v_avatar_url text;
  v_user_authentication_id uuid;
begin
  -- Extract data from the user’s OAuth profile data.
  v_email := f_profile ->> 'email';
  v_name := f_profile ->> 'name';
  v_username := f_profile ->> 'username';
  v_avatar_url := f_profile ->> 'avatar_url';

  -- Sanitise the username, and make it unique if necessary.
  if v_username is null then
    v_username = coalesce(v_name, 'user');
  end if;
  v_username = regexp_replace(v_username, '^[^a-z]+', '', 'gi');
  v_username = regexp_replace(v_username, '[^a-z0-9]+', '_', 'gi');
  if v_username is null or length(v_username) < 3 then
    v_username = 'user';
  end if;
  select (
    case
    when i = 0 then v_username
    else v_username || i::text
    end
  ) into v_username from generate_series(0, 1000) i
  where not exists(
    select 1
    from app_public.users
    where users.username = (
      case
      when i = 0 then v_username
      else v_username || i::text
      end
    )
  )
  limit 1;

  -- Create the user account
  v_user = app_private.really_create_user(
    username => v_username,
    email => v_email,
    email_is_verified => f_email_is_verified,
    name => v_name,
    avatar_url => v_avatar_url
  );

  -- Insert the user’s private account data (e.g. OAuth tokens)
  insert into app_public.user_authentications (user_id, service, identifier, details) values
    (v_user.id, f_service, f_identifier, f_profile) returning id into v_user_authentication_id;
  insert into app_private.user_authentication_secrets (user_authentication_id, details) values
    (v_user_authentication_id, f_auth_details);

  return v_user;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

/**********/

/*
 * The \`link_or_register_user\` function is called from
 * \`installPassportStrategy.ts\` when a user logs in with a social login
 * provider (OAuth), e.g. GitHub, Facebook, etc. If the user is already logged
 * in then the new provider will be linked to the users account, otherwise we
 * will try to retrieve an existing account using these details (matching the
 * service/identifier or the email address), and failing that we will register
 * a new user account linked to this service via the \`register_user\` function.
 *
 * This function is also responsible for keeping details in sync with the login
 * provider whenever the user logs in; you'll see this in the \`update\`
 * statements towards the bottom of the function.
 */

create function app_private.link_or_register_user(
  f_user_id uuid,
  f_service character varying,
  f_identifier character varying,
  f_profile json,
  f_auth_details json
) returns app_public.users as $$
declare
  v_matched_user_id uuid;
  v_matched_authentication_id uuid;
  v_email text;
  v_name text;
  v_avatar_url text;
  v_user app_public.users;
  v_user_email app_public.user_emails;
begin
  -- See if a user account already matches these details
  select id, user_id
    into v_matched_authentication_id, v_matched_user_id
    from app_public.user_authentications
    where service = f_service
    and identifier = f_identifier
    limit 1;

  if v_matched_user_id is not null and f_user_id is not null and v_matched_user_id <> f_user_id then
    raise exception 'A different user already has this account linked.' using errcode = 'TAKEN';
  end if;

  v_email = f_profile ->> 'email';
  v_name := f_profile ->> 'name';
  v_avatar_url := f_profile ->> 'avatar_url';

  if v_matched_authentication_id is null then
    if f_user_id is not null then
      -- Link new account to logged in user account
      insert into app_public.user_authentications (user_id, service, identifier, details) values
        (f_user_id, f_service, f_identifier, f_profile) returning id, user_id into v_matched_authentication_id, v_matched_user_id;
      insert into app_private.user_authentication_secrets (user_authentication_id, details) values
        (v_matched_authentication_id, f_auth_details);
    elsif v_email is not null then
      -- See if the email is registered
      select * into v_user_email from app_public.user_emails where email = v_email and is_verified is true;
      if v_user_email is not null then
        -- User exists!
        insert into app_public.user_authentications (user_id, service, identifier, details) values
          (v_user_email.user_id, f_service, f_identifier, f_profile) returning id, user_id into v_matched_authentication_id, v_matched_user_id;
        insert into app_private.user_authentication_secrets (user_authentication_id, details) values
          (v_matched_authentication_id, f_auth_details);
      end if;
    end if;
  end if;

  if v_matched_user_id is null and f_user_id is null and v_matched_authentication_id is null then
    -- Create and return a new user account
    return app_private.register_user(f_service, f_identifier, f_profile, f_auth_details, true);
  end if;

  if v_matched_authentication_id is null then
    -- v_matched_authentication_id is null
    -- -> v_matched_user_id is null (they're paired)
    -- -> f_user_id is not null (because the if clause above)
    -- -> v_matched_authentication_id is not null (because of the separate if block above creating a user_authentications)
    -- -> contradiction.
    raise exception 'This should not occur';
  end if;

  update app_public.user_authentications
    set details = f_profile
    where id = v_matched_authentication_id;
  update app_private.user_authentication_secrets
    set details = f_auth_details
    where user_authentication_id = v_matched_authentication_id;
  update app_public.users
    set
      name = coalesce(users.name, v_name),
      avatar_url = coalesce(users.avatar_url, v_avatar_url)
    where id = v_matched_user_id
    returning  * into v_user;
  return v_user;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

/*
 * The user is only allowed to have one primary email, and that email must be
 * verified. This function lets the user change which of their verified emails
 * is the primary email.
 */

create function app_public.make_email_primary(email_id uuid) returns app_public.user_emails as $$
declare
  v_user_email app_public.user_emails;
begin
  select * into v_user_email from app_public.user_emails where id = email_id and user_id = app_public.current_user_id();
  if v_user_email is null then
    raise exception 'That''s not your email' using errcode = 'DNIED';
    return null;
  end if;
  if v_user_email.is_verified is false then
    raise exception 'You may not make an unverified email primary' using errcode = 'VRFY1';
  end if;
  update app_public.user_emails set is_primary = false where user_id = app_public.current_user_id() and is_primary is true and id <> email_id;
  update app_public.user_emails set is_primary = true where user_id = app_public.current_user_id() and is_primary is not true and id = email_id returning * into v_user_email;
  return v_user_email;
end;
$$ language plpgsql strict volatile security definer set search_path to pg_catalog, public, pg_temp;

/*
 * If you don't receive the email verification email, you can trigger a resend
 * with this function.
 */

create function app_public.resend_email_verification_code(email_id uuid) returns boolean as $$
begin
  if exists(
    select 1
    from app_public.user_emails
    where user_emails.id = email_id
    and user_id = app_public.current_user_id()
    and is_verified is false
  ) then
    return true;
  end if;
  return false;
end;
$$ language plpgsql strict volatile security definer set search_path to pg_catalog, public, pg_temp;

`.trim(),

      "00100-posts.sql": `
create domain app_public.tag as text check (length(value) between 1 and 64);

create table app_public.posts (
  id int primary key generated always as identity (start 1000),
  user_id uuid not null references app_public.users on delete cascade,
  title text not null check (length(title) between 1 and 140),
  body text not null check (length(body) between 1 and 2000),
  tags app_public.tag[] not null check (array_length(tags, 1) between 1 and 5),
  search tsvector not null generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(body, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on app_public.posts (user_id);
create index on app_public.posts using gin (tags);
create index on app_public.posts (created_at desc);

alter table app_public.posts
  enable row level security;

grant
  select,
  insert (title, body, tags),
  update (title, body, tags),
  delete
  on app_public.posts to appname_visitor;

create policy select_all on app_public.posts
  for select using (true);

create policy insert_own on app_public.posts
  for insert with check (user_id = app_public.current_user_id());

create policy update_own on app_public.posts
  for update using (user_id = app_public.current_user_id());

create policy delete_own on app_public.posts
  for delete using (user_id = app_public.current_user_id());

create trigger _100_timestamps
  before insert or update
  on app_public.posts
  for each row
execute procedure app_private.tg__timestamps();

create type app_public.vote_type as enum ('spam', 'like', 'funny', 'love');

create table app_public.posts_votes (
  post_id int not null references app_public.posts on delete cascade,
  user_id uuid not null references app_public.users,
  vote app_public.vote_type not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index on app_public.posts_votes (user_id);
create index on app_public.posts_votes (post_id);

alter table app_public.posts_votes
  enable row level security;

grant
  select,
  insert (vote),
  update (vote),
  delete
  on app_public.posts_votes to appname_visitor;

create policy select_all on app_public.posts_votes
  for select using (true);

create policy insert_own on app_public.posts_votes
  for insert with check (user_id = app_public.current_user_id());

create policy update_own on app_public.posts_votes
  for update using (user_id = app_public.current_user_id());

create policy delete_own on app_public.posts_votes
  for delete using (user_id = app_public.current_user_id());

create table app_public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id int not null references app_public.posts on delete cascade,
  user_id uuid not null references app_public.users on delete cascade,
  parent_id uuid references app_public.comments on delete cascade,
  body text not null,
  search tsvector not null generated always as (to_tsvector('simple', body)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on app_public.comments (post_id);
create index on app_public.comments (user_id);
create index on app_public.comments (parent_id);
create index on app_public.comments (created_at desc);

alter table app_public.comments
  enable row level security;

grant
  select,
  insert (body, parent_id),
  update (body),
  delete
  on app_public.comments to appname_visitor;

create policy select_all on app_public.comments
  for select using (true);

create policy insert_own on app_public.comments
  for insert with check (user_id = app_public.current_user_id());

create policy update_own on app_public.comments
  for update using (user_id = app_public.current_user_id());

create policy delete_own on app_public.comments
  for delete using (user_id = app_public.current_user_id());

create trigger _100_timestamps
  before insert or update
  on app_public.comments
  for each row
execute procedure app_private.tg__timestamps();

create or replace function app_public.posts_current_user_voted(
  post app_public.posts
) returns app_public.vote_type as $$
  select
    vote
  from
    app_public.posts_votes v
  where
    v.post_id = (post).id
    and v.user_id = app_public.current_user_id()
$$ language sql stable security definer;

create view app_public.top_tags as
  select
    unnest(tags) as tag,
    count(*)
  from
    app_public.posts
  group by
    tag
  order by
    count desc;

grant select on app_public.top_tags to appname_visitor;

create or replace function app_public.posts_score(
  post app_public.posts
) returns int as $$
  select coalesce(sum(
    case vote
      when 'spam' then -1
      when 'like' then 1
      when 'funny' then 2
      when 'love' then 4
    end
  ), 0)
  from
    app_public.posts_votes v
  where
    post_id = post.id
$$ language sql stable;

create or replace function app_public.posts_popularity(
  post app_public.posts
) returns float as $$
  -- https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d
  select (app_public.posts_score(post) - 1) / pow((extract(epoch from (now() - post.created_at)) / 3600) + 2, 1.8)
$$ language sql stable;
`.trim(),
    },
  };
}