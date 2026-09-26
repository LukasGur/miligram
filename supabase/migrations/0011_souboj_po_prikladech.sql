-- Výsledek souboje po příkladech.
--
-- Odhalení výsledku ukazuje oba hráče vedle sebe příklad po příkladu.
-- Server doteď znal jen součty, takže soupeřovy řádky nebylo z čeho
-- složit. Pole nese jen značku prvního pokusu — správně, chyba, nebo
-- s nápovědou —, žádné zadání ani odpověď; ty se sestaví z lekce.
--
-- Čte se stejnou politikou jako zbytek výsledku (migrace 0010), takže
-- je zapečetěné do vlastního dohrání.

alter table public.duel_results
  add column items jsonb,
  add constraint duel_results_items check (
    items is null
    or (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50)
  );
