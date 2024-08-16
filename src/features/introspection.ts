import * as vscode from "vscode";
import {
  PgType,
  Introspection,
  makeIntrospectionQuery,
  parseIntrospectionResults,
} from "pg-introspection";
import { Results } from "~/types.d";
import { PGLITE_EXECUTE } from "./constants";

export class DatabaseExplorerProvider
  implements vscode.TreeDataProvider<Entity>
{
  introspection: Introspection | undefined;

  #onDidChangeTreeData: vscode.EventEmitter<Entity | undefined | null | void> =
    new vscode.EventEmitter<Entity | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<Entity | undefined | null | void> =
    this.#onDidChangeTreeData.event;

  refresh = async (): Promise<void> => {
    const [result] = await vscode.commands.executeCommand<
      Results<{ introspection: string }>[]
    >(PGLITE_EXECUTE, makeIntrospectionQuery());
    this.introspection = parseIntrospectionResults(
      result.rows[0]?.introspection,
      true,
    );
    this.#onDidChangeTreeData.fire();
  };

  getTreeItem(element: Entity): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Entity): Entity[] {
    console.log(element);
    if (!this.introspection) return [];
    if (!element)
      return this.introspection.namespaces
        .filter(n => n.nspname !== "pg_catalog" && n.nspname !== "pg_toast")
        .map(
          n =>
            new Entity(
              n.oid,
              n.nspname,
              "schema",
              "symbol-namespace",
              vscode.TreeItemCollapsibleState.Expanded,
            ),
        );
    switch (element.kind) {
      case "schema":
        return this.introspection.classes
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
                "symbol-structure",
                vscode.TreeItemCollapsibleState.Collapsed,
              ),
          );
      case "table":
        return this.introspection.attributes
          .filter(attr => attr.attrelid === element.oid)
          .map(
            c =>
              new Entity(
                c.oid,
                c.attname,
                "column",
                "symbol-property",
                vscode.TreeItemCollapsibleState.Collapsed,
              ),
          );
    }
  }
}

function getTypeName(type: PgType) {
  return [type.getNamespace()?.nspname, type.typname].join(".");
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
