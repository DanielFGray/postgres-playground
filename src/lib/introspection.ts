import {
  PgType,
  PgNamespace,
  Introspection as PgIntrospection,
} from "pg-introspection";
import { groupWith, invariant } from "./";
import { PgEntity } from "pg-introspection/dist/introspection";

export type DbSchema = {
  name: string;
  views: Record<string, DbView>;
  tables: Record<string, DbTable>;
  functions: Record<string, DbFunction>;
  types: Record<string, DbType>;
};

type DbDomain = { kind: "domain"; name: string; type: string };
type DbEnum = { kind: "enum"; name: string; values: Array<string> };
type DbComposite = {
  kind: "composite";
  name: string;
  columns: Array<{ name: string; type: string }>;
};
type DbType = DbDomain | DbEnum | DbComposite;

type DbView = {
  name: string;
  columns: Array<DbColumn>;
  constraints: Record<string, DbReference>;
  description: string | undefined;
};

type DbTable = {
  name: string;
  columns: Array<DbColumn>;
  indexes: Record<string, DbIndex>;
  references: Record<string, DbReference>;
  description: string | undefined;
};

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

export type DbIndex = {
  name: string;
  colnames: Array<string>;
  isUnique: boolean | null;
  isPrimary: boolean | null;
  option: Array<number> | null;
  type: string | null;
};

type DbReference = {
  name: string;
  refPath: {
    kind: string;
    schemas: string;
    name: string;
    columns: string[];
  };
};

export class DbIntrospection {
  #introspection: PgIntrospection;
  name: string;
  schemas: Record<string, DbSchema>;

  constructor(introspection: PgIntrospection) {
    this.#introspection = introspection;
    this.name = introspection.database.datname;
    this.schemas = Object.fromEntries(
      introspection.namespaces.map(schema => [
        schema.nspname,
        this.processSchema(schema),
      ]),
    );
  }

  processSchema(schema: PgNamespace): DbSchema {
    return {
      name: schema.nspname,
      types: this.processTypes(schema.oid),
      functions: this.processFunctions(schema.oid),
      tables: this.processTables(schema.oid),
      views: this.processViews(schema.oid),
    };
  }

  processTypes(schemaId: string): Record<string, DbType> {
    const domains = this.#introspection.types
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

    const enums = this.#introspection.types
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

    const composites = this.#introspection.classes
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

    const types: Record<string, DbType> = groupWith(
      (_, b) => b,
      t => t.name,
      [...domains, ...enums, ...composites],
    );
    return types;
  }

  processViews(schemaId: string): Record<string, DbView> {
    const views = Object.fromEntries(
      this.#introspection.classes
        .filter(view => view.relnamespace === schemaId && view.relkind === "v")
        .map(view => {
          const description = getDescription(view);
          return [
            view.relname,
            {
              name: view.relname, // TODO: any other attributes specific to views? references? pseudo-FKs?
              columns: this.processColumns(view.oid),
              constraints: this.processReferences(view.oid),
              description,
            },
          ];
        }),
    );
    return views;
  }

  processTables(schemaId: string): Record<string, DbTable> {
    return Object.fromEntries(
      this.#introspection.classes
        .filter(table => table.relnamespace === schemaId && table.relkind === "r")
        .map(table => {
          const name = table.relname;
          const columns = this.processColumns(table.oid);
          const description = getDescription(table);
          const references = this.processReferences(table.oid);
          const indexes = this.processIndexes(table.oid);
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

  processColumns(tableId: string): Array<DbColumn> {
    return this.#introspection.attributes
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
        const description = getDescription(column);
        return {
          name,
          identity: column.attidentity,
          type: typeName,
          nullable: !column.attnotnull,
          hasDefault: column.atthasdef ?? false,
          generated: column.attgenerated === "s" ? "STORED" : false,
          isArray,
          description: description,
          attnum: column.attnum,
          // original: column,
        };
      })
      .sort((a, b) => a.attnum - b.attnum);
  }

  processIndexes(tableId: string): Record<string, DbIndex> {
    return Object.fromEntries(
      this.#introspection.indexes
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

  processReferences(tableId: string): Record<string, DbReference> {
    return Object.fromEntries(
      this.#introspection.constraints
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

  processFunctions(schemaId: string): Record<string, DbFunction> {
    return Object.fromEntries(
      this.#introspection.procs
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
}

type DbFunction = {
  returnType: string | undefined;
  args: Array<[string | number, { type: string; hasDefault?: boolean }]>;
  volatility: "immutable" | "stable" | "volatile";
};

function getTypeName(type: PgType) {
  return [type.getNamespace()?.nspname, type.typname].join(".");
}

function getDescription(entity: PgEntity) {
  if ("getDescription" in entity) {
    return entity.getDescription();
  }
}
