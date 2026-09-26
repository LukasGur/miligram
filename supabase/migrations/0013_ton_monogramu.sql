-- Tón monogramu.
--
-- Monogram dostal barvu z přezdívky (src/core/monogram.ts) a nikdo si ji
-- nevybral. Kdo o ni nestojí, si teď vybere jinou z týchž osmi tónů.
-- Prázdná hodnota znamená „jako dřív“: tón se dál odvodí z přezdívky,
-- takže stávající účty se nezmění a nikdo nemusí nic nastavovat.
--
-- Čte se s profilem (politika z 0001 — přezdívku a tón vidí přihlášení)
-- a mění ho jen majitel, stejnou politikou jako přezdívku. Rozsah musí
-- souhlasit s TONES v src/core/monogram.ts.

alter table public.profiles
  add column tone smallint
  constraint profiles_tone_range check (tone is null or tone between 0 and 7);
