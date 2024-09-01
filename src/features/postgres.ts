import * as vscode from "vscode";
import * as db from "./pglite";
import { ExtensionHostKind, registerExtension } from "vscode/extensions";
import { DatabaseExplorerProvider } from "./introspection";
import {
  registerCustomView,
  ViewContainerLocation,
} from "@codingame/monaco-vscode-workbench-service-override";
import { throttle } from "~lib/index";
import getWorkspace from "~/example-small-schema";
import { fileSystemProvider } from "~/fsProvider";
import {
  FileType,
  RegisteredMemoryFile,
} from "@codingame/monaco-vscode-files-service-override";
import {
  PGLITE_RESET,
  PGLITE_EXECUTE,
  PGLITE_INTROSPECT,
  DATABASE_EXPLORER,
  DATABASE_MIGRATE,
  WORKSPACE_PREFIX,
  ERD_SHOW,
  ERD_UPDATE,
} from "./constants";
import { SQLNotebookExecutionController } from "./notebook/controller";
import { SQLSerializer } from "./notebook/sql";
import { MarkdownSerializer } from "./notebook/markdown";
import { getMermaidERD, mermaidRender } from "./erd";

const { getApi } = registerExtension(
  {
    name: "pg-playground",
    publisher: "pg-playground",
    version: "1.0.0",
    engines: { vscode: "*" },
    capabilities: { virtualWorkspaces: true },
    extensionKind: ["workspace"],
    contributes: {
      notebooks: [
        {
          type: "sql-notebook",
          displayName: "SQL Notebook",
          priority: "default",
          selector: [{ filenamePattern: "*.sql" }],
        },
        {
          type: "markdown-notebook",
          displayName: "Markdown Notebook",
          priority: "default",
          selector: [{ filenamePattern: "*.md" }],
        },
      ],
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
        {
          command: ERD_SHOW,
          title: "Show entity relationship diagram",
          icon: "",
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
            command: ERD_SHOW,
            when: "view == databaseExplorer",
            group: "navigation",
          },
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
      views: {
        explorer: [
          { id: DATABASE_EXPLORER, name: "Database", visibility: "visible" },
          // { id: "playground-info", name: "Playground", type: "webview" },
        ],
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

void getApi().then(async vscode => {
  vscode.workspace.registerNotebookSerializer(
    "markdown-notebook",
    new MarkdownSerializer(),
  );
  new SQLNotebookExecutionController("markdown-notebook");

  vscode.workspace.registerNotebookSerializer(
    "sql-notebook",
    new SQLSerializer(),
  );

  new SQLNotebookExecutionController("sql-notebook");

  const { defaultLayout, files } = getWorkspace();

  Object.entries(files).forEach(([path, value]) =>
    fileSystemProvider.registerFile(
      new RegisteredMemoryFile(
        vscode.Uri.file(
          WORKSPACE_PREFIX.concat(path.startsWith("/") ? path : `/${path}`),
        ),
        value,
      ),
    ),
  );

  defaultLayout.editors.forEach(editor => {
    const uri = vscode.Uri.file(
      WORKSPACE_PREFIX.concat(
        editor.uri.startsWith("/") ? editor.uri : `/${editor.uri}`,
      ),
    );
    vscode.window.showNotebookDocument(uri);
  });

  const pgliteOutputChannel = vscode.window.createOutputChannel("PGlite");
  pgliteOutputChannel.appendLine("starting postgres");
  // pgliteOutputChannel.show();
  pgliteOutputChannel.appendLine((await version).rows[0]?.version);
  pgliteOutputChannel.appendLine("Powered by @electric-sql/pglite");

  const queryOpts = {};

  vscode.commands.registerCommand(DATABASE_MIGRATE, async function migrate() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return;
    // recursively read paths
    const paths = (await fileSystemProvider.readdir(folder.uri))
      .filter(
        ([f, type]) => type === FileType.File && /\/?\d+[^/]+\.sql$/.test(f),
      )
      .sort(([a], [b]) => a.localeCompare(b));
    if (!paths.length) {
      return vscode.window.showInformationMessage(
        "No migration files detected",
      );
    }
    const uris = paths.map(([path]) => vscode.Uri.joinPath(folder.uri, path));
    for (const f of uris) {
      const raw = await vscode.workspace.fs.readFile(f);
      const sql = new TextDecoder().decode(raw);
      await vscode.commands.executeCommand(PGLITE_EXECUTE, sql);
    }
    return vscode.window.showInformationMessage(
      `finished ${paths.length} migrations`,
    );
  });

  vscode.commands.registerCommand(
    PGLITE_EXECUTE,
    async function exec(sql: string) {
      try {
        const result = await db.exec(sql, queryOpts);
        result.forEach(stmt => {
          pgliteOutputChannel.appendLine(stmt.statement);
        });
        if (
          result.some(r =>
            ["CREATE", "ALTER", "DROP"].some(stmt =>
              r.statement.startsWith(stmt),
            ),
          )
        ) {
          vscode.commands.executeCommand(PGLITE_INTROSPECT);
        }
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
    await db.reset();
    vscode.commands.executeCommand(PGLITE_INTROSPECT);
    const {
      rows: [{ version }],
    } = await db.query<{ version: string }>("select version()");
    pgliteOutputChannel.appendLine(version);
  });

  function createErdPanel() {
    return vscode.window.createWebviewPanel(
      "erd",
      "Entity Relationship Diagram",
      vscode.ViewColumn.Two,
      {
        enableCommandUris: true,
        enableScripts: true,
        retainContextWhenHidden: false,
      },
    );
  }
  let erdPanel: vscode.WebviewPanel | undefined;

  const [updateErd] = throttle(
    async () => {
      if (erdPanel) {
        const erd = await getMermaidERD();
        console.log(erd);
        const { svg } = await mermaidRender(erd);
        erdPanel.webview.html = svg;
      }
    },
    200,
  );

  vscode.commands.registerCommand(ERD_UPDATE, updateErd);
  vscode.commands.registerCommand(ERD_SHOW, () => {
    if (!erdPanel) erdPanel = createErdPanel();
    updateErd();
    erdPanel.reveal();
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
  vscode.window.createTreeView(DATABASE_EXPLORER, {
    treeDataProvider: dbExplorer,
  });
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
