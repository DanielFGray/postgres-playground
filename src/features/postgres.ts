import * as vscode from 'vscode'
import { ExtensionHostKind, registerExtension } from 'vscode/extensions'
import {
  Introspection,
  makeIntrospectionQuery,
  parseIntrospectionResults,
} from "pg-introspection";

const pgliteExecute = "pglite.execute"
const databaseExplorer = "database-explorer"

const { getApi } = registerExtension({
  name: 'pg-playground',
  publisher: 'pg-playground',
  version: '1.0.0',
  engines: {
    vscode: '*'
  },
  capabilities: {
    virtualWorkspaces: true,
  },
  extensionKind: ["workspace"],
  contributes: {
    commands: [
      {
        command: pgliteExecute,
        title: "Execute SQL",
        icon: "play",
      },
    ],
    menus: {
      commandPalette: [
        {
          command: pgliteExecute,
          when: "editorLangId == sql",
        },
      ],
      "editor/title": [
        {
          command: pgliteExecute,
          group: "navigation",
          when: "editorLangId == sql",
        },
      ],
      "notebook/cell/execute": [
        {
          command: pgliteExecute,
          group: "navigation",
          when: "editorLangId == sql",
        },
      ],
    },
    views: {
      explorer: [{ id: databaseExplorer, name: "Database" }],
    },
  },
}, ExtensionHostKind.LocalProcess)

function query<T>(sql: string): Promise<{ rows: T[] }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ rows: [] });
    }, 1000);
  });
}

void getApi().then(async vscode => {
  const pgliteOutputChannel = vscode.window.createOutputChannel("PGlite");
  pgliteOutputChannel.append("Here's some fake output\n");

  vscode.commands.registerCommand(pgliteExecute, query);
})

export class DatabaseExplorerProvider
  implements vscode.TreeDataProvider<Entity>
{
  introspectionResults: Introspection;

  constructor() {
    this.refresh()
  }

  async refresh(): Promise<void> {
    const result = await query<{introspection: string}>(makeIntrospectionQuery());
    this.introspectionResults = parseIntrospectionResults(result.rows[0]?.introspection!, true);
  }

  getTreeItem(element: Entity): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Entity): Entity[] {
    console.log(element)
    if (!this.introspectionResults) return []
    switch (element.kind) {
      default:
        return this.introspectionResults.namespaces.map(
          (x) =>
            new Entity(
              x.nspname,
              x.nspname,
              "schema",
              vscode.TreeItemCollapsibleState.Expanded,
            ),
        );
    }
  }
}

vscode.window.createTreeView(databaseExplorer, {
  treeDataProvider: new DatabaseExplorerProvider(),
});

class Entity extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly kind: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.id = `${this.label}-${this.kind}`;
    this.kind = this.kind;
  }
}


