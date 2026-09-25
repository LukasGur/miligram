-- pg_net patří do schématu `extensions`, ne do `public`.
--
-- Migrace 0008 ho založila bez schématu, takže skončil ve veřejném API.
-- Funkce pg_net žijí v `net` bez ohledu na to, takže přesun nic nerozbije.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
