import * as vscode from "vscode";
import {
  Introspection,
  makeIntrospectionQuery,
  parseIntrospectionResults,
} from "pg-introspection";
import { PGLITE_EXECUTE } from "./postgres";

export class DatabaseExplorerProvider
  implements vscode.TreeDataProvider<Entity>
{
  introspectionResults: Introspection | undefined;

  refresh = async (): Promise<void> => {
    const [result] = await vscode.commands.executeCommand(
      PGLITE_EXECUTE,
      makeIntrospectionQuery(),
    );
    this.introspectionResults = parseIntrospectionResults(
      result.rows[0]?.introspection!,
      true,
    );
  };

  getTreeItem(element: Entity): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Entity): Entity[] {
    if (!this.introspectionResults) return [];
    if (!element)
      return this.introspectionResults.namespaces.map(
        x =>
          new Entity(
            x.oid,
            x.nspname,
            "schema",
            "namespace",
            vscode.TreeItemCollapsibleState.Expanded,
          ),
      );
    switch (element.kind) {
      case "namespace":
        return this.introspectionResults.classes
          .filter(
            table =>
              table.relnamespace === element.oid && table.relkind === "r",
          )
          .map(
            t =>
              new Entity(
                t.oid,
                t.relname,
                "table",
                "structure",
                vscode.TreeItemCollapsibleState.Collapsed,
              ),
          );
    }
  }
}

class Entity extends vscode.TreeItem {
  public readonly id: string;

  constructor(
    public readonly oid: string,
    public readonly label: string,
    public readonly kind: string,
    public readonly iconPath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.id = `${this.label}-${this.kind}`;
  }
}
