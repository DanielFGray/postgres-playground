import * as vscode from "vscode";
import { ExtensionHostKind, registerExtension } from "vscode/extensions";
import { PGlite } from "@electric-sql/pglite"
import { DatabaseExplorerProvider } from "./introspection";

export const PGLITE_EXECUTE = "pglite.execute";
export const PGLITE_RESET = "pglite.reset";
export const DATABASE_EXPLORER = "databaseExplorer";
export const PGLITE_INTROSPECT = "introspection.refresh";

const { getApi } = registerExtension(
  {
    name: "pg-playground",
    publisher: "pg-playground",
    version: "1.0.0",
    engines: {
      vscode: "*",
    },
    capabilities: {
      virtualWorkspaces: true,
    },
    extensionKind: ["workspace"],
    contributes: {
      commands: [
        {
          command: "sql.format",
          title: "Format SQL",
          icon: "sparkle",
        },
        {
          command: PGLITE_RESET,
          title: "Reset database",
          icon: "trash",
        },
        {
          command: PGLITE_EXECUTE,
          title: "Execute SQL",
          icon: "notebook-execute",
        },
        {
          command: PGLITE_INTROSPECT,
          title: "refresh introspection data",
          icon: "refresh",
        },
      ],
      menus: {
        commandPalette: [
          {
            command: PGLITE_EXECUTE,
            when: "editorLangId == sql",
          },
        ],
        "view/title": [
          {
            command: PGLITE_INTROSPECT,
            when: "view == databaseExplorer",
            group: "navigation",
          },
        ],
        "editor/title": [
          // { command: "sql.format", group: "navigation", },
          {
            command: PGLITE_EXECUTE,
            group: "navigation",
          },
        ],
        "notebook/cell/execute": [
          {
            command: PGLITE_EXECUTE,
            group: "navigation",
            when: "editorLangId == sql",
          },
        ],
      },
      views: {
        explorer: [{ id: DATABASE_EXPLORER, name: "Database" }],
      },
      viewsWelcome: [
        {
          view: DATABASE_EXPLORER,
          contents:
            "Run some commands to see your schema",
        },
      ],
    },
  },
  ExtensionHostKind.LocalProcess,
);

void getApi().then(async vscode => {
  const pgliteOutputChannel = vscode.window.createOutputChannel("PGlite");
  pgliteOutputChannel.appendLine('starting postgres');

  let db = new PGlite();
  const { rows: [{ version }] } = await db.query('select version()');
  pgliteOutputChannel.appendLine(version);
  void vscode.window.showInformationMessage(['Powered by @electric-sql/pglite', version].join("\n"));

  const queryOpts = {}

  vscode.commands.registerCommand(PGLITE_EXECUTE, async function exec(sql: string) {
    try {
      pgliteOutputChannel.appendLine(`executing: ${sql}`);
      const result = await db.exec(sql, queryOpts);
      result.forEach(stmt => {
        pgliteOutputChannel.appendLine(
          stmt.fields.length && stmt.rows.length
            ? `results: ${stmt.rows.length}`
            : 'no result'
        );
      });
      return result
    } catch (error) {
      pgliteOutputChannel.appendLine(error.message ?? error);
      return [{ error }]
    }
  });

  vscode.commands.registerCommand(PGLITE_RESET, async function reset() {
    pgliteOutputChannel.appendLine('restarting postgres');
    if (db) await db.close()
    db = new PGlite()
    await db.query('select 1');
    const { rows: [{ version }] } = await db.query('select version()');
    pgliteOutputChannel.appendLine(version);
  });

  // vscode.languages.registerDocumentFormattingEditProvider("sql", {
  //   provideDocumentFormattingEdits(
  //     document: vscode.TextDocument,
  //   ): vscode.TextEdit[] {
  //     const firstLine = document.lineAt(0);
  //     if (firstLine.text !== "42") {
  //       return [vscode.TextEdit.insert(firstLine.range.start, "42\n")];
  //     }
  //   },
  // });

  // vscode.languages.registerCodeActionsProvider(
  //   { language: 'sql' },
  //   new ExtractNotebookImports(),
  //   {
  //     providedCodeActionKinds: [ExtractNotebookImports.providedKind],
  //   }
  // )
  // );

  const dbExplorer = new DatabaseExplorerProvider()
  vscode.commands.registerCommand(PGLITE_INTROSPECT, dbExplorer.refresh);
  vscode.window.createTreeView(DATABASE_EXPLORER, {
    treeDataProvider: dbExplorer,
  });
});
