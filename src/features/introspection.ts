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
            new Entity({
              id: n.oid,
              label: n.nspname,
              kind: "schema",
              icon: "symbol-namespace",
              state: vscode.TreeItemCollapsibleState.Expanded,
            }),
        );
    switch (element.kind) {
      case "schema": {
        const tables = this.introspection.classes
          .filter(
            table => table.relnamespace === element.id && table.relkind === "r",
          )
          .map(
            t =>
              new Entity({
                id: t.oid,
                label: t.relname,
                kind: "table",
                icon: "symbol-structure",
                state: vscode.TreeItemCollapsibleState.Collapsed,
              }),
          );
        return [...tables];
      }
      case "table":
        return this.introspection.attributes
          .filter(attr => attr.attrelid === element.id)
          .map(
            c =>
              new Entity({
                id: c.oid,
                label: c.attname,
                description: c.getType()?.typname,
                kind: "column",
                icon: "symbol-property",
                state: vscode.TreeItemCollapsibleState.Collapsed,
              }),
          );
      default:
        return [];
    }
  }
}

class Entity extends vscode.TreeItem {
  public readonly id: string;
  public readonly label: string;
  public readonly kind: string;
  public readonly description: string | undefined;
  public readonly iconPath: string;
  public readonly collapsibleState: vscode.TreeItemCollapsibleState;

  constructor(props: {
    id: string;
    label: string;
    kind: string;
    description?: string;
    icon: string;
    state: vscode.TreeItemCollapsibleState;
  }) {
    super(props.label, props.state);
    this.id = props.id;
    this.label = props.label;
    this.kind = props.kind;
    this.description = props.description;
    this.iconPath = props.icon;
    this.collapsibleState = props.state;
  }
}
