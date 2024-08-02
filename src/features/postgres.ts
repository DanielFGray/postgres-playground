import * as vscode from "vscode";
import { ExtensionHostKind, registerExtension } from "vscode/extensions";
import { PGlite } from "@electric-sql/pglite";
import { DatabaseExplorerProvider } from "./introspection";
import {
  PGLITE_RESET,
  PGLITE_EXECUTE,
  PGLITE_INTROSPECT,
  DATABASE_EXPLORER,
} from "./constants";

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
          contents: "Run some commands to see your schema",
        },
      ],
    },
  },
  ExtensionHostKind.LocalProcess,
);

void getApi().then(async vscode => {
  const pgliteOutputChannel = vscode.window.createOutputChannel("PGlite");
  pgliteOutputChannel.appendLine("starting postgres");

  let db = new PGlite();
  const {
    rows: [{ version }],
  } = await db.query("select version()");
  pgliteOutputChannel.appendLine(version);
  void vscode.window.showInformationMessage(
    ["Powered by @electric-sql/pglite", version].join("\n"),
  );

  const queryOpts = {};

  vscode.commands.registerCommand(
    PGLITE_EXECUTE,
    async function exec(sql: string) {
      try {
        const raw = await db.exec(sql, queryOpts);
        const splits = semicolons.parseSplits(sql, false);
        const queries = semicolons.splitStatements(sql, splits.positions, true);
        const result = zip(queries, raw).map(([q, r]) => {
          const stmtSplits = q.slice(0, 30).split(/\s+/);
          return {
            ...r,
            query: q,
            statement: q.startsWith("create or replace")
              ? [stmtSplits[0], stmtSplits[3]].join(" ").toUpperCase()
              : q.startsWith("create") ||
                  q.startsWith("alter") ||
                  q.startsWith("drop")
                ? [stmtSplits[0], stmtSplits[1]].join(" ").toUpperCase()
                : stmtSplits[0].toUpperCase(),
          };
        });
        result.forEach(stmt => {
          pgliteOutputChannel.appendLine(stmt.statement);
        });
        return result;
      } catch (error) {
        pgliteOutputChannel.appendLine(error.message ?? error);
        return [{ error }];
      }
    },
  );

  vscode.commands.registerCommand(PGLITE_RESET, async function reset() {
    pgliteOutputChannel.replace("restarting postgres\n");
    if (db) await db.close();
    db = new PGlite();
    await db.query("select 1");
    const {
      rows: [{ version }],
    } = await db.query("select version()");
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

  const dbExplorer = new DatabaseExplorerProvider();
  const [refreshIntrospection] = throttle(dbExplorer.refresh, 50);
  vscode.commands.registerCommand(PGLITE_INTROSPECT, refreshIntrospection);
  vscode.window.createTreeView(DATABASE_EXPLORER, {
    treeDataProvider: dbExplorer,
  });
});
