export default function getWorkspace() {
  return {
    defaultLayout: {
      editors: [
        {
          uri: "/0001-example.sql",
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
      "/0001-example.sql": `
select version();

drop table if exists nums cascade;

create table nums as
  select
    gen_random_uuid() as id,
    num
  from
    generate_series(1000, 10000) as num;

alter table nums add primary key(id);
create index on nums ((num % 2000));
analyze;

explain (analyze, buffers)
select * from nums where (num % 2000) = 0;
`.trim(),
    },
  };
}
