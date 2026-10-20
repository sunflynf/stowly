-- Colour theme, per person (like language). "auto" follows the device's
-- light/dark setting. The app mirrors it in the STOWLY_THEME cookie so pages
-- render in the right colours without a flash.
alter table public.profiles
  add column theme text not null default 'teal' check (theme in ('auto', 'teal', 'green', 'blue', 'dark'));
