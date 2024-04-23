import {
  PgType,
  PgNamespace,
  Introspection as PgIntrospection,
} from "pg-introspection";
import { groupWith, invariant } from "./";
import { PgEntity } from "pg-introspection/dist/introspection";

export type DbIntrospection = {
  name: string;
  schemas: Record<string, DbSchema>;
};

export function processIntrospection(
  introspection: PgIntrospection,
): DbIntrospection {
  return {
    name: introspection.database.datname,
    schemas: Object.fromEntries(
      introspection.namespaces.map(schema => [
        schema.nspname,
        processSchema(schema, { introspection }),
      ]),
    ),
  };
}

export type DbSchema = {
  name: string;
  views: Record<string, DbView>;
  tables: Record<string, DbTable>;
  functions: Record<string, DbFunction>;
  types: Record<string, DbType>;
};

function processSchema(
  schema: PgNamespace,
  {
    introspection,
  }: {
    introspection: PgIntrospection;
  },
): DbSchema {
  return {
    name: schema.nspname,
    views: processViews(schema.oid, { introspection }),
    tables: processTables(schema.oid, { introspection }),
    functions: processFunctions(schema.oid, { introspection }),
    types: processTypes(schema.oid, { introspection }),
  };
}

type DbDomain = { kind: "domain"; name: string; type: string };
type DbEnum = { kind: "enum"; name: string; values: Array<string> };
type DbComposite = {
  kind: "composite";
  name: string;
  columns: Array<{ name: string; type: string }>;
};
type DbType = DbDomain | DbEnum | DbComposite;

function processTypes(
  schemaId: string,
  {
    introspection,
  }: {
    introspection: PgIntrospection;
  },
): Record<string, DbType> {
  const domains = introspection.types
    .filter(t => t.typtype === "d" && t.typnamespace === schemaId)
    .map(t => {
      return {
        name: t.typname,
        kind: "domain",
        type: invariant(
          t.typoutput,
          `missing typoutput for ${t.typname}`,
        ).replace("out$", ""),
      } satisfies DbDomain;
    });

  const enums = introspection.types
    .filter(t => t.typtype === "e" && t.typnamespace === schemaId)
    .map(t => {
      const values = t.getEnumValues();
      if (!values)
        throw new Error("could not find enum values for ${t.typname}");
      return {
        name: t.typname,
        kind: "enum",
        values: values.map(x => x.enumlabel),
      } satisfies DbEnum;
    });

  const composites = introspection.classes
    .filter(cls => cls.relnamespace === schemaId && cls.relkind === "c")
    .map(t => {
      return {
        name: t.relname,
        kind: "composite",
        columns: t.getAttributes().map(a => {
          const type = a.getType();
          if (!type)
            throw new Error(
              `could not find type for composite attribute ${t.relname}`,
            );
          return { name: a.attname, type: getTypeName(type) };
        }),
      } satisfies DbComposite;
    });

  const types: Record<string,DbType> = groupWith(
    (_, b) => b,
    t => t.name,
    [...domains, ...enums, ...composites],
  );
  return types
}

type DbView = {
  name: string;
  columns: Record<string, DbColumn>;
  constraints: Record<string, DbReference>;
  description: string | undefined;
};

function processViews(
  schemaId: string,
  {
    introspection,
  }: {
    introspection: PgIntrospection;
  },
): Record<string, DbView> {
  const views = Object.fromEntries(
    introspection.classes
      .filter(view => view.relnamespace === schemaId && view.relkind === "v")
      .map(view => {
        const { description } = getDescription(view);
        return [
          view.relname,
          {
            name: view.relname, // TODO: any other attributes specific to views? references? pseudo-FKs?
            columns: processColumns(view.oid, { introspection }),
            constraints: processReferences(view.oid, { introspection }),
            description,
          },
        ];
      }),
  );
  return views;
}

type DbTable = {
  name: string;
  columns: Record<string, DbColumn>;
  indexes: Record<string, DbIndex>;
  references: Record<string, DbReference>;
  description: string | undefined;
};

function processTables(
  schemaId: string,
  {
    introspection,
  }: {
    introspection: PgIntrospection;
  },
): Record<string, DbTable> {
  return Object.fromEntries(
    introspection.classes
      .filter(table => table.relnamespace === schemaId && table.relkind === "r")
      .map(table => {
        const name = table.relname;
        const columns = processColumns(table.oid, {
          introspection,
        });
        const { description } = getDescription(table);
        const references = processReferences(table.oid, {
          introspection,
        });
        const indexes = processIndexes(table.oid, { introspection });
        return [
          name,
          {
            name,
            columns,
            indexes,
            references,
            description,
          },
        ];
      }),
  );
}

export type DbColumn = {
  name: string;
  identity: string | null;
  type: string;
  generated: "STORED" | false;
  nullable: boolean;
  hasDefault: boolean;
  isArray: boolean;
  description: string | undefined;
};

function processColumns(
  tableId: string,
  {
    introspection,
  }: {
    introspection: PgIntrospection;
  },
): Record<string, DbColumn> {
  return Object.fromEntries(
    introspection.attributes
      .filter(column => column.attrelid === tableId)
      .map(column => {
        const name = column.attname;
        const type = column.getType();
        if (!type)
          throw new Error(`couldn't find type for column ${column.attname}`);
        const isArray =
          typeof column.attndims === "number" && column.attndims > 0;
        const typeName = isArray
          ? getTypeName(
              invariant(
                type.getElemType(),
                `elemType didn't return anything for ${column.getClass()?.relname}.${column.attname}`,
              ),
            )
          : getTypeName(type);
        const { description } = getDescription(column);
        return [
          name,
          {
            name,
            identity: column.attidentity,
            type: typeName,
            nullable: !column.attnotnull,
            hasDefault: column.atthasdef ?? false,
            generated: column.attgenerated === "s" ? "STORED" : false,
            isArray,
            description: description,
            // original: column,
          },
        ];
      }),
  );
}

export type DbIndex = {
  name: string;
  colnames: Array<string>;
  isUnique: boolean | null;
  isPrimary: boolean | null;
  option: Array<number> | null;
  type: string | null;
};

function processIndexes(
  tableId: string,
  {
    introspection,
  }: {
    introspection: PgIntrospection;
  },
): Record<string, DbIndex> {
  return Object.fromEntries(
    introspection.indexes
      .filter(index => index.indrelid === tableId)
      .map(index => {
        const cls = index.getIndexClass();
        if (!cls)
          throw new Error(
            `failed to find index class for index ${index.indrelid}`,
          );

        const am = cls.getAccessMethod();
        if (!am)
          throw new Error(
            `failed to find access method for index ${cls.relname}`,
          );

        const keys = index.getKeys();
        if (!keys)
          throw new Error(`failed to find keys for index ${cls.relname}`);

        const colnames = keys.filter(Boolean).map(a => a.attname);
        const name = cls.relname;
        const option = index.indoption;
        return [
          name,
          {
            name,
            isUnique: index.indisunique,
            isPrimary: index.indisprimary,
            option,
            type: am.amname,
            colnames,
          } satisfies DbIndex,
        ];
      }),
  );
}

type DbReference = {
  name: string;
  refPath: {
    kind: string;
    schemas: string;
    name: string;
    columns: string[];
  };
};

function processReferences(
  tableId: string,
  { introspection }: { introspection: PgIntrospection },
): Record<string, DbReference> {
  return Object.fromEntries(
    introspection.constraints
      .filter(c => c.conrelid === tableId && c.contype === "f")
      .map(constraint => {
        const fkeyClass = constraint.getForeignClass();
        if (!fkeyClass) throw new Error();
        const fkeyNsp = fkeyClass.getNamespace();
        if (!fkeyNsp) throw new Error();
        const fkeyAttr = constraint.getForeignAttributes();
        if (!fkeyAttr) throw new Error();
        const kind = fkeyClass.relkind;
        const name = constraint.conname;
        return [
          name,
          {
            name,
            refPath: {
              kind,
              schemas: fkeyNsp.nspname,
              name: fkeyClass.relname,
              columns: fkeyAttr.map(a => a.attname),
            },
          } satisfies DbReference,
        ];
      }),
  );
}

type DbFunction = {
  returnType: string | undefined;
  args: Array<[string | number, { type: string; hasDefault?: boolean }]>;
  volatility: "immutable" | "stable" | "volatile";
};

function processFunctions(
  schemaId: string,
  {
    introspection,
  }: {
    introspection: PgIntrospection;
  },
): Record<string, DbFunction> {
  return Object.fromEntries(
    introspection.procs
      .filter(proc => proc.pronamespace === schemaId)
      .map(proc => {
        const type = proc.getReturnType();
        if (!type)
          throw new Error(`couldn't find type for proc ${proc.proname}`);
        const volatility = {
          i: "immutable",
          s: "stable",
          v: "volatile",
        }[proc.provolatile ?? "v"] as "immutable" | "stable" | "volatile";
        return [
          proc.proname,
          {
            returnType: getTypeName(type),
            volatility,
            args: !proc.proargnames
              ? []
              : proc.getArguments().map((a, i) => {
                  const argName = proc.proargnames?.[i] ?? i + 1;
                  return [
                    argName,
                    {
                      type: getTypeName(a.type),
                      hasDefault: a.hasDefault,
                    },
                  ];
                }),
          } satisfies DbFunction,
        ];
      }),
  );
}

function getTypeName(type: PgType) {
  return [type.getNamespace()?.nspname, type.typname].join(".");
}

function getDescription(entity: PgEntity) {
  if ('getDescription' in entity) {
    return entity.getDescription();
  }
}
