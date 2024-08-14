import * as vscode from "vscode";
import { ExtensionHostKind, registerExtension } from "vscode/extensions";
import { PGlite } from "@electric-sql/pglite";
import { live } from "@electric-sql/pglite/live";
import { vector } from "@electric-sql/pglite/vector";
import { amcheck } from "@electric-sql/pglite/contrib/amcheck";
import { auto_explain } from "@electric-sql/pglite/contrib/auto_explain";
import { bloom } from "@electric-sql/pglite/contrib/bloom";
import { btree_gin } from "@electric-sql/pglite/contrib/btree_gin";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { cube } from "@electric-sql/pglite/contrib/cube";
import { earthdistance } from "@electric-sql/pglite/contrib/earthdistance";
import { fuzzystrmatch } from "@electric-sql/pglite/contrib/fuzzystrmatch";
import { hstore } from "@electric-sql/pglite/contrib/hstore";
import { isn } from "@electric-sql/pglite/contrib/isn";
import { lo } from "@electric-sql/pglite/contrib/lo";
import { ltree } from "@electric-sql/pglite/contrib/ltree";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { seg } from "@electric-sql/pglite/contrib/seg";
import { tablefunc } from "@electric-sql/pglite/contrib/tablefunc";
import { tcn } from "@electric-sql/pglite/contrib/tcn";
import { tsm_system_rows } from "@electric-sql/pglite/contrib/tsm_system_rows";
import { tsm_system_time } from "@electric-sql/pglite/contrib/tsm_system_time";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { DatabaseExplorerProvider } from "./introspection";
import {
  registerCustomView,
  ViewContainerLocation,
} from "@codingame/monaco-vscode-workbench-service-override";
import * as semicolons from "postgres-semicolons";
import { throttle, zip } from "~lib/index";
import * as services from "vscode/services";
import { BrowserStorageService } from "@codingame/monaco-vscode-storage-service-override";
import {
  PGLITE_RESET,
  PGLITE_EXECUTE,
  PGLITE_INTROSPECT,
  DATABASE_EXPLORER,
  DATABASE_MIGRATE,
} from "./constants";

const { getApi } = registerExtension(
  {
    name: "pg-playground",
    publisher: "pg-playground",
    version: "1.0.0",
    engines: { vscode: "*" },
    capabilities: { virtualWorkspaces: true },
    extensionKind: ["workspace"],
    contributes: {
      commands: [
        {
          command: PGLITE_RESET,
          title: "Reset database",
          icon: "notebook-revert",
        },
        {
          command: PGLITE_EXECUTE,
          title: "Execute SQL",
          icon: "notebook-execute",
        },
        {
          command: PGLITE_INTROSPECT,
          title: "Refresh introspection data",
          icon: "extensions-refresh",
        },
        {
          command: DATABASE_MIGRATE,
          title: "Run migrations",
          icon: "run-all",
        },
        {
          command: "github-login",
          title: "Login with GitHub",
          icon: "github",
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
          // { command: "sql.format", group: "1_run" },
          { command: DATABASE_MIGRATE, group: "1_run" },
          { command: PGLITE_EXECUTE, group: "1_run" },
          { command: PGLITE_RESET, group: "5_close" },
        ],
        "notebook/cell/execute": [
          {
            command: PGLITE_EXECUTE,
            group: "navigation",
            when: "editorLangId == sql",
          },
        ],
      },
      // views: {
      //   explorer: [
      //     { id: DATABASE_EXPLORER, name: "Database" },
      //     { id: "playground-info", name: "Playground", type: "webview" },
      //   ],
      // },
      // viewsWelcome: [
      //   {
      //     view: DATABASE_EXPLORER,
      //     contents: "Run some commands to see your schema",
      //   },
      // ],
    },
  },
  ExtensionHostKind.LocalProcess,
);

// registerCustomView({
//   id: "playground-info",
//   name: "Playground",
//   canToggleVisibility: false,
//   hideByDefault: false,
//   default: true,
//   collapsed: false,
//   order: 0,
//   renderBody(container: HTMLElement): monaco.IDisposable {
//     container.style.display = "flex";
//     container.style.flexDirection = "column";
//     container.style.alignItems = "center";
//     container.style.justifyContent = "center";
//     container.style.height = "100%";

//     const fragment = document.createDocumentFragment();

//     const title = document.createElement("div");
//     title.textContent = "playground title";
//     fragment.appendChild(title);

//     const description = document.createElement("div");
//     description.textContent = "playground description";
//     fragment.appendChild(description);

//     container.appendChild(fragment);
//     return {
//       dispose() {},
//     };
//   },
//   location: ViewContainerLocation.Sidebar,
//   // TODO: add icon
//   icon: new URL(
//     "../Visual_Studio_Code_1.35_icon.svg",
//     import.meta.url,
//   ).toString(),
//   // actions: [{
//   //   id: "custom-action",
//   //   title: "Custom action",
//   //   icon: "dialogInfo",
//   //   async run (accessor) {
//   //     void accessor.get(IDialogService).info("This is a custom view action button")
//   //   }
//   // }]
// });


let db = makePglite();

function makePglite() {
  return new PGlite(undefined, {
    extensions: {
      live,
      vector,
      amcheck,
      auto_explain,
      bloom,
      btree_gin,
      btree_gist,
      citext,
      cube,
      earthdistance,
      fuzzystrmatch,
      hstore,
      isn,
      lo,
      ltree,
      pg_trgm,
      seg,
      tablefunc,
      tcn,
      tsm_system_rows,
      tsm_system_time,
      uuid_ossp,
    },
  });
}
const version = db.query("select version()");

void getApi().then(async vscode => {
  const pgliteOutputChannel = vscode.window.createOutputChannel("PGlite");
  pgliteOutputChannel.appendLine("starting postgres");
  pgliteOutputChannel.show();
  pgliteOutputChannel.appendLine((await version).rows[0]?.version);
  pgliteOutputChannel.appendLine("Powered by @electric-sql/pglite");

  const queryOpts = {};

  vscode.commands.registerCommand(DATABASE_MIGRATE, async function migrate() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;
    const pattern = new vscode.RelativePattern(folders[0], "**/*.sql");
    // TODO: make cancellable
    const files = await vscode.workspace.findFiles(pattern);
    if (!files.length)
      return vscode.window.showInformationMessage("No migration files found");
    console.log(files);
    vscode.window.showInformationMessage(
      `executing ${files.length} migration files`,
    );
    for (const f of files) {
      const file = await vscode.workspace.fs.readFile(f);
      await vscode.commands.executeCommand(PGLITE_EXECUTE, file.toString());
    }
    return vscode.window.showInformationMessage(`migrations finished`);
  });

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
        pgliteOutputChannel.appendLine(
          `error: ${error.message ?? JSON.stringify(error)}`,
        );
        return [{ error }];
      }
    },
  );

  vscode.commands.registerCommand(PGLITE_RESET, async function reset() {
    pgliteOutputChannel.replace("restarting postgres\n");
    if (db) await db.close();
    db = makePglite();
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
  //   { language: "sql" },
  //   new ExtractNotebookImports(),
  //   {
  //     providedCodeActionKinds: [ExtractNotebookImports.providedKind],
  //   }
  // )
  // );

  // vscode.window.registerWebviewViewProvider(
  //   PlaygroundSidebarView.id,
  //   new PlaygroundSidebarView(),
  // );

  vscode.commands.registerCommand("github-login", async () => {
    window.location.href = "/auth/github";
  });

  const dbExplorer = new DatabaseExplorerProvider();
  const [refreshIntrospection] = throttle(dbExplorer.refresh, 50);
  vscode.commands.registerCommand(PGLITE_INTROSPECT, refreshIntrospection);
  // vscode.window.createTreeView(DATABASE_EXPLORER, {
  //   treeDataProvider: dbExplorer,
  // });
});

// class PlaygroundSidebarView implements vscode.WebviewViewProvider {
//   public static readonly id = "playground-info";

//   async #getHtmlForWebview(webview: vscode.Webview) {
//     const me = await fetch("/api/me").then(res => res.json());
//     const userInfo = me
//       ? `<p>hello ${me.username}</p>
//         <form method="post" action="/api/logout">
//           <button>logout</a>
//         </form>`
//       : '<button href="/auth/github">login</button>';
//     return `
//       <style type="text/css">${vscodeCss}</style>
//       <h1>playground</h1>
//       ${userInfo}
//     `;
//   }

//   resolveWebviewView(
//     webviewView: vscode.WebviewView,
//     context: vscode.WebviewViewResolveContext,
//     token: vscode.CancellationToken,
//   ): void {
//     this.#getHtmlForWebview(webviewView.webview).then(html => {
//       webviewView.webview.html = html;
//       webviewView.show(true);
//     });
//   }
// }

const vscodeCss = `
:root {
  --container-paddding: 20px;
  --input-padding-vertical: 6px;
  --input-padding-horizontal: 4px;
  --input-margin-vertical: 4px;
  --input-margin-horizontal: 0;
}

body {
  padding: 0 var(--container-paddding);
  color: var(--vscode-foreground);
  font-size: var(--vscode-font-size);
  font-weight: var(--vscode-font-weight);
  font-family: var(--vscode-font-family);
  background-color: var(--vscode-editor-background);
}

ol,
ul {
  padding-left: var(--container-paddding);
}

body > *,
form > * {
  margin-block-start: var(--input-margin-vertical);
  margin-block-end: var(--input-margin-vertical);
}

*:focus {
  outline-color: var(--vscode-focusBorder) !important;
}

a {
  color: var(--vscode-textLink-foreground);
}

a:hover,
a:active {
  color: var(--vscode-textLink-activeForeground);
}

code {
  font-size: var(--vscode-editor-font-size);
  font-family: var(--vscode-editor-font-family);
}

button {
  border: none;
  padding: var(--input-padding-vertical) var(--input-padding-horizontal);
  width: 100%;
  text-align: center;
  outline: 1px solid transparent;
  outline-offset: 2px !important;
  color: var(--vscode-button-foreground);
  background: var(--vscode-button-background);
}

button:hover {
  cursor: pointer;
  background: var(--vscode-button-hoverBackground);
}

button:focus {
  outline-color: var(--vscode-focusBorder);
}

button.secondary {
  color: var(--vscode-button-secondaryForeground);
  background: var(--vscode-button-secondaryBackground);
}

button.secondary:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

input:not([type='checkbox']),
textarea {
  display: block;
  width: 100%;
  border: none;
  font-family: var(--vscode-font-family);
  padding: var(--input-padding-vertical) var(--input-padding-horizontal);
  color: var(--vscode-input-foreground);
  outline-color: var(--vscode-input-border);
  background-color: var(--vscode-input-background);
}

input::placeholder,
textarea::placeholder {
  color: var(--vscode-input-placeholderForeground);
}
`;
