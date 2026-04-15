-- ============================================================
-- EDGE — Initial Database Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

create type language_mode as enum ('plain', 'technical');
create type trade_outcome as enum ('win', 'loss', 'breakeven');
create type trade_direction as enum ('long', 'short');
create type signal_direction as enum ('long', 'short', 'neutral');
create type market_regime as enum ('trending', 'ranging', 'volatile');

-- ============================================================
-- PROFILES
-- Extends auth.users — one row per user, created on signup
-- ============================================================

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  account_size numeric(15, 2) default 0,
  language_mode language_mode not null default 'plain',
  created_at   timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- ============================================================
-- WATCHLIST
-- Tickers the user is tracking
-- ============================================================

create table watchlist (
  id       uuid primary key default uuid_generate_v4(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  symbol   text not null,
  added_at timestamptz not null default now(),
  unique (user_id, symbol)
);

alter table watchlist enable row level security;

create policy "Users can view their own watchlist"
  on watchlist for select
  using (auth.uid() = user_id);

create policy "Users can insert into their own watchlist"
  on watchlist for insert
  with check (auth.uid() = user_id);

create policy "Users can delete from their own watchlist"
  on watchlist for delete
  using (auth.uid() = user_id);

-- ============================================================
-- PLAYBOOKS
-- Named, saved trading strategies with backtest results
-- ============================================================

create table playbooks (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  strategy_prompt  text,
  strategy_config  jsonb not null default '{}',
  backtest_results jsonb,
  created_at       timestamptz not null default now()
);

alter table playbooks enable row level security;

create policy "Users can view their own playbooks"
  on playbooks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own playbooks"
  on playbooks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own playbooks"
  on playbooks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own playbooks"
  on playbooks for delete
  using (auth.uid() = user_id);

-- ============================================================
-- BACKTESTS
-- Individual backtest runs (may or may not be saved as a playbook)
-- ============================================================

create table backtests (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  playbook_id uuid references playbooks(id) on delete set null,
  symbol      text not null,
  timeframe   text not null,
  date_from   date not null,
  date_to     date not null,
  results     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

alter table backtests enable row level security;

create policy "Users can view their own backtests"
  on backtests for select
  using (auth.uid() = user_id);

create policy "Users can insert their own backtests"
  on backtests for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own backtests"
  on backtests for delete
  using (auth.uid() = user_id);

-- ============================================================
-- SIGNALS
-- Generated signals for a symbol, saved per-user
-- ============================================================

create table signals (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  symbol       text not null,
  edge_score   integer not null check (edge_score between 0 and 100),
  direction    signal_direction not null,
  stop_level   numeric(15, 4),
  target_level numeric(15, 4),
  confidence   integer check (confidence between 0 and 100),
  reasoning    jsonb not null default '{}',
  regime       market_regime,
  created_at   timestamptz not null default now()
);

alter table signals enable row level security;

create policy "Users can view their own signals"
  on signals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own signals"
  on signals for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- JOURNAL TRADES
-- User-logged trades with emotion tracking and playbook linkage
-- ============================================================

create table journal_trades (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  symbol          text not null,
  playbook_id     uuid references playbooks(id) on delete set null,
  entry_price     numeric(15, 4) not null,
  exit_price      numeric(15, 4),
  size            numeric(15, 4),
  direction       trade_direction not null,
  entry_emotion   integer check (entry_emotion between 1 and 5),
  notes           text,
  outcome         trade_outcome,
  is_paper        boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table journal_trades enable row level security;

create policy "Users can view their own journal trades"
  on journal_trades for select
  using (auth.uid() = user_id);

create policy "Users can insert their own journal trades"
  on journal_trades for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own journal trades"
  on journal_trades for update
  using (auth.uid() = user_id);

create policy "Users can delete their own journal trades"
  on journal_trades for delete
  using (auth.uid() = user_id);

-- ============================================================
-- TICKER NOTES
-- Free-form notes per ticker per user
-- ============================================================

create table ticker_notes (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  symbol     text not null,
  content    text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, symbol)
);

alter table ticker_notes enable row level security;

create policy "Users can view their own ticker notes"
  on ticker_notes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own ticker notes"
  on ticker_notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own ticker notes"
  on ticker_notes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own ticker notes"
  on ticker_notes for delete
  using (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_watchlist_user_id on watchlist(user_id);
create index idx_playbooks_user_id on playbooks(user_id);
create index idx_backtests_user_id on backtests(user_id);
create index idx_backtests_playbook_id on backtests(playbook_id);
create index idx_signals_user_id on signals(user_id);
create index idx_signals_symbol on signals(symbol);
create index idx_signals_created_at on signals(created_at desc);
create index idx_journal_trades_user_id on journal_trades(user_id);
create index idx_journal_trades_symbol on journal_trades(symbol);
create index idx_journal_trades_created_at on journal_trades(created_at desc);
create index idx_ticker_notes_user_id on ticker_notes(user_id);

-- ============================================================
-- PROFILE AUTO-CREATION TRIGGER
-- Creates a profile row when a new user signs up via Supabase Auth
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
