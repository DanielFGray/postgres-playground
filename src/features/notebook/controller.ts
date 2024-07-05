import * as vscode from 'vscode';
import * as db from "../../pglite";
import { zip } from "../../lib";
import * as semicolons from "postgres-semicolons";
import { Results } from "@electric-sql/pglite";

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
    for (let cell of cells) {
      this.#doExecution(cell);
    }
  }

  async #doExecution(cell: vscode.NotebookCell): Promise<void> {
    const execution = this.#controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this.#executionOrder;
    const text = cell.document.getText();
    execution.start(Date.now());
    const { positions } = semicolons.parseSplits(text, false);
    const queries = semicolons.nonEmptyStatements(text, positions);
    const raw = await db.exec(text);
    const results = zip(queries, raw);
    execution.replaceOutput(
      results.map(([query, result]) => {
        if ("error" in result) {
          return new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.error(result.error),
          ]);
        }
        if (!result.fields.length) {
          return new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.text(
              query.split(" ").slice(0, 2).join(" ").toUpperCase(),
              // TODO: find out why text/plain throws renderer error
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
  result,
}: {
  query: string;
  result: Results;
}): string {
  const head =
    result.fields.length < 1
      ? null
      : `
<thead>
  <tr>${result.fields.map(col => `<th>${col.name}</th>`)}</tr>
</thead>
  `.trim();
  const rows = `<tbody>${
    result.fields.length < 1
      ? `<tr><td>${query.split(" ").slice(0, 2).join(" ").toUpperCase()}</td></tr>`
      : result.rows.length < 1
        ? `<tr> <td colspan=${result.fields.length}>No results</td></tr>`
        : result.rows.map(
            row => `<tr>${result.fields.map(f => {
              const value = row[f.name]
              return `<td>${['string', 'number'].includes(typeof value) ? value : JSON.stringify(value)}</td>`;
            })}</tr>`,
          )
  }</tbody>`;
  return `<table>${head}${rows}</table>`.trim();
}
