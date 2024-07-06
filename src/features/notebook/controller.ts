import * as vscode from "vscode";
import * as db from "../../pglite";
import { zip } from "../../lib";
import * as semicolons from "postgres-semicolons";
import { Results } from "@electric-sql/pglite";
import { PGLITE_EXECUTE, PGLITE_INTROSPECT } from "../postgres";

export class SQLNotebookExecutionController {
  readonly #controller: vscode.NotebookController;
  #executionOrder = 0;
  constructor(type: string) {
    const controller = vscode.notebooks.createNotebookController(
      `${type}-controller`,
      type,
      "SQL Notebook",
    );
    controller.supportedLanguages = ["sql", "SQL"];
    controller.supportsExecutionOrder = true;
    controller.executeHandler = this.#execute.bind(this);
    this.#controller = controller;
  }

  #execute(
    cells: vscode.NotebookCell[],
    _notebook: vscode.NotebookDocument,
    _controller: vscode.NotebookController,
  ): void {
    for (const cell of cells) {
      this.#doExecution(cell);
    }
  }

  async #doExecution(cell: vscode.NotebookCell): Promise<void> {
    const execution = this.#controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this.#executionOrder;
    const text = cell.document.getText();
    const splits = semicolons.parseSplits(text, false);
    const queries = semicolons.splitStatements(text, splits.positions, true);
    execution.start(Date.now());
    const raw = await vscode.commands.executeCommand(PGLITE_EXECUTE, text);
    const results = zip(queries, raw);
    execution.replaceOutput(
      results.map(([query, result]) => {
        if ("error" in result) {
          return new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.text(
              `<span style="font-weight:550;">${result.error.message}</span>`,
              "text/markdown",
            ),
          ]);
        }
        if (!result.fields.length) {
          if (
            ["create", "alter", "drop"].some(stmt =>
              query.toLowerCase().startsWith(stmt),
            )
          ) {
            vscode.commands.executeCommand(PGLITE_INTROSPECT);
          }
          // TODO: find out why text/plain throws renderer error
          const stmtSplits = query.split(" ");
          switch (true) {
            case query.startsWith("create or replace"):
              return new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.text(
                  [stmtSplits[0], stmtSplits[3]].join(" ").toUpperCase(),
                  "text/markdown",
                ),
              ]);
            case query.startsWith("create"):
            case query.startsWith("alter"):
            case query.startsWith("drop"):
              return new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.text(
                  [stmtSplits[0], stmtSplits[1]].join(" ").toUpperCase(),
                  "text/markdown",
                ),
              ]);
          }

          return new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.text(
              stmtSplits[0].toUpperCase(),
              "text/markdown",
            ),
          ]);
        }
        return new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.text(
            renderRowsAsTable({ query, result }),
            "text/markdown",
          ),
        ]);
      }),
    );
    execution.end(true, Date.now());
  }
}

function renderRowsAsTable({
  query,
  result: { rows, fields },
}: {
  query: string;
  result: Results;
}): string {
  return `<table>${
    fields.length < 1
      ? null
      : `<thead><tr>${fields.map(col => `<th>${col.name}</th>`)}</tr></thead>`
  }<tbody>${
    fields.length < 1
      ? `<tr><td>${query.split(" ").slice(0, 2).join(" ").toUpperCase()}</td></tr>`
      : rows.length < 1
        ? `<tr><td colspan=${fields.length}>No results</td></tr>`
        : rows.map(
            row =>
              `<tr>${fields.map(f => {
                const value = row[f.name];
                return `<td>${["object"].includes(typeof value) ? JSON.stringify(value, null, 2) : value}</td>`;
              })}</tr>`,
          )
  }</tbody></table>`;
}
