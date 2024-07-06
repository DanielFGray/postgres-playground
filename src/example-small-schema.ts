export default function getWorkspace() {
  return {
    defaultLayout: {
      editors: [
        {
          uri: "/example.sql",
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
      "/example.sql": `
drop table if exists nums cascade;

create table nums as
  select gen_random_uuid(), * from generate_series(1000, 10000);

alter table nums add primary key(gen_random_uuid);
create index on nums ((generate_series % 2000));
analyze;

explain (analyze, buffers)
select * from nums where (generate_series % 2000) = 0;

select version();
`.trim(),
    },
  };
}
