import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  Logger, SymbolInformation, SymbolKind, URI, WorkspaceFolder,
  Position,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { PostgresKind, parseCreateStatements, parseStmtements } from "~/lib/parser";
import { store } from "~/store";

export function getWordRangeAtPosition(
  document: TextDocument, position: Position,
): Range | undefined {
  const lines = document.getText().split("\n")
  const line = Math.max(0, Math.min(lines.length - 1, position.line))
  const lineText = lines[line]
  const character = Math.max(0, Math.min(lineText.length - 1, position.character))
  const separator = /[\s,()':=;]/

  let startChar = character
  while (startChar > 0 && !separator.test(lineText.charAt(startChar - 1))) {
    --startChar
  }

  let endChar = character
  while (
    endChar < lineText.length && !separator.test(lineText.charAt(endChar))
  ) {
    ++endChar
  }

  if (startChar === endChar) return undefined

  return Range.create(line, startChar, line, endChar)
}

export function getCompletionItems(
  document: TextDocument,
  position: Position,
  defaultSchema: string,
  logger: Logger,
): CompletionItem[] | undefined {
  if (isFirstCommentLine(document, position)) {
    return getLanguageServerCommentCompletionItems();
  }

  const wordRange = getWordRangeAtPosition(document, position);
  if (wordRange === undefined) {
    return undefined;
  }
  const word = document.getText(wordRange);

  const schmaCompletionItems = getSchemaCompletionItems(logger);

  const schema = findSchema(
    word,
    schmaCompletionItems.map(item => item.label),
  );

  const completionItems = schmaCompletionItems
    .concat(getTableCompletionItems(schema, defaultSchema, logger))
    .concat(getViewCompletionItems(schema, defaultSchema, logger))
    .concat(getMaterializedViewCompletionItems(schema, defaultSchema, logger))
    .concat(getFunctionCompletionItems(schema, defaultSchema, logger))
    .concat(getTypeCompletionItems(schema, defaultSchema, logger))
    .concat(getDomainCompletionItems(schema, defaultSchema, logger))
    .concat(getBuiltinFunctionCompletionItems());

  return completionItems
    .concat(
      getKeywordCompletionItems(word, document.getText(), completionItems),
    )
    .map((item, index) => {
      item.data = index;

      return item;
    });
}

function convertToCompletionItemKind(kind: PostgresKind): CompletionItemKind {
  switch (kind) {
    case PostgresKind.Schema:
      return CompletionItemKind.Module;
    case PostgresKind.Table:
      return CompletionItemKind.Class;
    case PostgresKind.View:
      return CompletionItemKind.Class;
    case PostgresKind.MaterializedView:
      return CompletionItemKind.Class;
    case PostgresKind.Type:
      return CompletionItemKind.Struct;
    case PostgresKind.Domain:
      return CompletionItemKind.Struct;
    case PostgresKind.Index:
      return CompletionItemKind.Struct;
    case PostgresKind.Function:
      return CompletionItemKind.Function;
    case PostgresKind.Trigger:
      return CompletionItemKind.Event;
    default: {
      const unknownKind: never = kind;
      throw new Error(`"${unknownKind}" is unknown "PostgresKind".`);
    }
  }
}

function findSchema(word: string, schemas: string[]): string | undefined {
  const schemaMatch = word.match(`^(${schemas.join("|")})."?`);

  if (schemaMatch === null) {
    return undefined;
  } else {
    return schemaMatch[1];
  }
}

function getLanguageServerCommentCompletionItems(): CompletionItem[] {
  return [
    {
      label: "plpgsql-language-server:disable",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Disable all features.",
    },
    {
      label: "plpgsql-language-server:disable validation",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Disable validation feature only.",
    },
    {
      label: "plpgsql-language-server:use-query-parameter",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Use query parameter.",
    },
    {
      label: "plpgsql-language-server:use-positional-query-parameter",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Use positional query parameter.",
    },
    {
      label: "plpgsql-language-server:use-positional-query-parameter number=1",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Use positional query parameter with number.",
    },
    {
      label: "plpgsql-language-server:use-keyword-query-parameter",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Use keyword query parameter.",
    },
    {
      label:
        "plpgsql-language-server:use-keyword-query-parameter keywords=[id, name]",
      kind: CompletionItemKind.Text,
      data: 0,
      detail: "Use keyword query parameter with keywords.",
    },
  ];
}

function getSchemaCompletionItems(
  logger: Logger,
): CompletionItem[] {
  const schemas = querySchemas(logger);

  return schemas.map((schema, index) => {
    return {
      label: schema,
      kind: convertToCompletionItemKind(PostgresKind.Schema),
      data: index,
      detail: `Schema ${schema}`,
    };
  });
}

function getTableCompletionItems(
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): CompletionItem[] {
  const definitions = queryTableDefinitions(
    schema,
    undefined,
    defaultSchema,
    logger,
  );

  return definitions.map((definition, index) => ({
    label: definition.tableName,
    kind: convertToCompletionItemKind(PostgresKind.Table),
    data: index,
    detail: makeTableDefinitionText(definition),
  }));
}

function getViewCompletionItems(
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): CompletionItem[] {
  const definitions = queryViewDefinitions(
    schema,
    undefined,
    defaultSchema,
    logger,
  );

  return definitions.map((definition, index) => ({
    label: definition.viewName,
    kind: convertToCompletionItemKind(PostgresKind.View),
    data: index,
    detail: makeViewDefinitionText(definition),
  }));
}

function getMaterializedViewCompletionItems(
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): CompletionItem[] {
  const definitions = queryMaterializedViewDefinitions(
    schema,
    undefined,
    defaultSchema,
    logger,
  );

  return definitions.map((definition, index) => ({
    label: definition.viewName,
    kind: convertToCompletionItemKind(PostgresKind.MaterializedView),
    data: index,
    detail: makeMaterializedViewDefinitionText(definition),
  }));
}

function getFunctionCompletionItems(
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): CompletionItem[] {
  const definitions = queryFunctionDefinitions(
    schema,
    undefined,
    defaultSchema,
    logger,
  );

  return definitions.map((definition, index) => ({
    label: definition.functionName,
    kind: convertToCompletionItemKind(PostgresKind.Function),
    data: index,
    detail: makeFunctionDefinitionText(definition),
    insertText: makeInsertFunctionText(definition),
    insertTextFormat: InsertTextFormat.Snippet,
  }));
}

function getBuiltinFunctionCompletionItems(): CompletionItem[] {
  return ["coalesce", "greatest", "least", "now", "to_json", "to_jsonb"]
    .map((functionName, index) => ({
      label: functionName,
      kind: convertToCompletionItemKind(PostgresKind.Function),
      data: index,
      detail: 'FUNCTION ${functionName}(value [, ...])\n  LANGUAGE built-in',
      insertText: `${functionName}($\{1:value}, $\{2:...})`,
      insertTextFormat: InsertTextFormat.Snippet,
    }))
    .concat(
      ["nullif"].map((functionName, index) => ({
        label: functionName,
        kind: convertToCompletionItemKind(PostgresKind.Function),
        data: index,
        detail: 'FUNCTION ${functionName}(value1, value2)\n  LANGUAGE built-in',
        insertText: `${functionName}($\{1:value1}, $\{2:value2})`,
        insertTextFormat: InsertTextFormat.Snippet,
      })),
    );
}

function getDomainCompletionItems(
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): CompletionItem[] {
  const definition = queryDomainDefinitions(
    schema,
    undefined,
    defaultSchema,
    logger,
  );

  return definition.map((definition, index) => ({
    label: definition.domainName,
    kind: convertToCompletionItemKind(PostgresKind.Domain),
    data: index,
    detail: makeDomainDefinitionText(definition),
  }));
}

function getTypeCompletionItems(
  schema: string | undefined,
  defaultSchema: string,
  logger: Logger,
): CompletionItem[] {
  const definition = queryTypeDefinitions(
    schema,
    undefined,
    defaultSchema,
    logger,
  );

  return definition.map((definition, index) => ({
    label: definition.typeName,
    kind: convertToCompletionItemKind(PostgresKind.Type),
    data: index,
    detail: makeTypeDefinitionText(definition),
  }));
}

function getKeywordCompletionItems(
  word: string,
  documentText: string,
  completionItems: CompletionItem[],
): CompletionItem[] {
  const completionNames = new Set(completionItems.map(item => item.label));

  const keywords = documentText
    .split(/[\s,.();:="'-]+/)
    .filter(
      keyword =>
        keyword.length >= 4 &&
        !completionNames.has(keyword) &&
        keyword !== word,
    );

  return Array.from(new Set(keywords))
    .sort()
    .map((keyword, index) => ({
      label: keyword,
      kind: CompletionItemKind.Keyword,
      data: index,
    }));
}

interface TableDefinition {
  schema: string;
  tableName: string;
  fields: {
    columnName: string;
    dataType: string;
    isNullable: boolean;
    columnDefault: string | null;
  }[];
}

function queryTableDefinitions(
  schema: string | undefined,
  tableName: string | undefined,
  defaultSchema: string,
  logger: Logger,
): TableDefinition[] {
  
  const results = store.getState().queries.introspection?.[schema ?? defaultSchema];
  return results?.[tableName ?? '']
    .column.map(row => ({
    schema: row.schema,
    tableName: row.table_name,
    fields: row.fields,
  })) as TableDefinition[];

  return definitions;
}

function makeTableDefinitionText(definition: TableDefinition): string {
  const { schema, tableName, fields } = definition;

  if (fields.length === 0) {
    return `table ${schema}.${tableName}()`;
  }
  const tableFields = fields.map(
    ({ columnName, dataType, isNullable, columnDefault }) =>
      [
        columnName,
        dataType,
        isNullable ? null : "not null",
        columnDefault ? `default ${columnDefault}` : null,
      ]
        .filter(elem => elem !== null)
        .join(" "),
  );

  return `table ${schema}.${tableName}(\n  ${tableFields.join(",\n")}\n)`;
}

export class SymbolsManager {
  private fileSymbols: Map<URI, SymbolInformation[]> = new Map()

  getSymbols(): SymbolInformation[] | undefined {
    return Array.from(this.fileSymbols.values())
      .flat()
      .sort((a, b) => (a.name > b.name ? -1 : 1))
  }

  async updateDocumentSymbols(
    document: TextDocument,
    settings: Settings,
    logger: Logger,
  ): Promise<void> {
    logger.log("The file symbols are updating...")

    const symbols = await this.innerUpdateDocumentSymbols(
      document, settings.defaultSchema, logger,
    )

    if (symbols !== undefined) {
      const symbolNames = symbols.map(symbol => symbol.name)

      logger.log(
        `The file symbols have been updated!! 😎 ${JSON.stringify(symbolNames)}`,
      )
    }
  }

  async loadWorkspaceSymbols(
    workspaceFolder: WorkspaceFolder,
    settings: Settings,
    logger: Logger,
  ): Promise<void> {
    logger.log(`The "${workspaceFolder.name}" workspace symbols are loading... 🚀`)

    for (const file of await loadDefinitionFiles(workspaceFolder, settings)) {
      const document = await readTextDocumentFromUri(`${workspaceFolder.uri}/${file}`)

      if (disableLanguageServer(document)) {
        continue
      }

      await this.innerUpdateDocumentSymbols(
        document, settings.defaultSchema, logger,
      )
    }

    logger.log("The symbols have been loaded!! 👍")
  }

  private async innerUpdateDocumentSymbols(
    document: TextDocument,
    defaultSchema: string,
    logger: Logger,
  ): Promise<SymbolInformation[] | undefined> {
    const symbols = parseDocumentSymbols(
      document.uri, document.getText(), defaultSchema, logger,
    )
    this.fileSymbols.set(document.uri, symbols ?? [])

    return symbols
  }
}

function convertToSymbleKind(kind: PostgresKind): SymbolKind {
  switch (kind) {
    case PostgresKind.Schema:
      return SymbolKind.Module
    case PostgresKind.Table:
      return SymbolKind.Class
    case PostgresKind.View:
      return SymbolKind.Class
    case PostgresKind.MaterializedView:
      return SymbolKind.Class
    case PostgresKind.Type:
      return SymbolKind.Struct
    case PostgresKind.Domain:
      return SymbolKind.Struct
    case PostgresKind.Index:
      return SymbolKind.Struct
    case PostgresKind.Function:
      return SymbolKind.Function
    case PostgresKind.Trigger:
      return SymbolKind.Event
    default: {
      const unknownKind: never = kind
      throw new Error(`"${unknownKind}" is unknown "PostgresKind".`)
    }
  }
}

function parseDocumentSymbols(
  uri: URI,
  fileText: string,
  defaultSchema: string,
  logger: Logger,
): SymbolInformation[] | undefined {
  const statements = parseStmtements(fileText)?.parse_tree?.stmts
  if (statements === undefined) {
    return undefined
  }

  return parseCreateStatements(fileText, statements, uri, logger).map(
    (statementInfo) => {
      return {
        name: `${statementInfo.schema ?? defaultSchema}.${statementInfo.name}`,
        kind: convertToSymbleKind(PostgresKind.Table),
        location: {
          uri,
          range: statementInfo.targetSelectionRange,
        },
      }
    },
  )
}
