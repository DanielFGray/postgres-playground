import * as vscode from "vscode";
import { Results } from "~/types.d";
import { PGLITE_EXECUTE, PGLITE_INTROSPECT } from "../constants";

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
    const text = cell.document.getText();
    if (text.trim().length < 1) return;
    execution.executionOrder = ++this.#executionOrder;
    execution.start(Date.now());
    const results = await vscode.commands.executeCommand<Results[]>(
      PGLITE_EXECUTE,
      text,
    );
    execution.replaceOutput(
      results.map(result => {
        if ("error" in result) {
          return new vscode.NotebookCellOutput([
            // TODO: find out why text/plain throws renderer error
            // vscode.NotebookCellOutputItem.error(result.error.message),
            vscode.NotebookCellOutputItem.text(
              `<div style="font-weight:550;background:#f009;padding:0.25em;color;white;">${result.error.message}</div>`,
              "text/markdown",
            ),
          ]);
        }
        if (result.fields.length > 0) {
          return new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.text(
              renderRowsAsTable(result),
              "text/markdown",
            ),
          ]);
        }
        // TODO: find out why text/plain throws renderer error
        return new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.text(result.statement, "text/markdown"),
        ]);
      }),
    );
    execution.end(true, Date.now());
  }
}

function renderRowsAsTable({ rows, fields, statement }: Results): string {
  return `<table>${
    fields.length < 1
      ? null
      : `<thead><tr>${fields.map(col => `<th>${col.name}</th>`).join('')}</tr></thead>`
  }<tbody>${
    fields.length < 1
      ? `<tr><td>${statement}</td></tr>`
      : rows.length < 1
        ? `<tr><td colspan=${fields.length}>No results</td></tr>`
        : rows.map(
            row =>
              `<tr>${fields.map(f => {
                const value = row[f.name];
                return `<td style="white-space:pre">${["object"].includes(typeof value) ? JSON.stringify(value, null, 2) : value}</td>`;
              }).join('')}</tr>`,
          ).join('')
  }</tbody></table>`;
}
