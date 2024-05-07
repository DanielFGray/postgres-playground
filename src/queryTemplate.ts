export const defaultFiles: Record<string, string> = {
  "0001-setup.sql": `
-- welcome to pgfiddle, a browser-based playground for postgresql
drop table if exists nums cascade;

create table nums as
  select gen_random_uuid(), * from generate_series(1000, 10000);

alter table nums add primary key(gen_random_uuid);
create index on nums ((generate_series % 2000));
analyze;

-- explain (analyze, buffers)
select * from nums where (generate_series % 2000) = 0;
`.trim(),
};

