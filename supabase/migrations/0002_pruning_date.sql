-- Data da poda da planilha (opcional). Sem valor, o PDF mostra o campo em branco
-- para ser preenchido à mão.
alter table public.sheets add column pruning_date date;
