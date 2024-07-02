import * as vscode from 'vscode';
import { db } from '../postgres';

export class MarkdownNotebookExecutionController {
  readonly #controller: vscode.NotebookController;
  #executionOrder = 0;
  constructor() {
    this.#controller = vscode.notebooks.createNotebookController(
      "markdown-notebook-controller",
      "sql-notebook",
      "Markdown Notebook",
    );
    this.#controller.supportedLanguages = ['sql', 'SQL'];
    this.#controller.supportsExecutionOrder = true;
    this.#controller.executeHandler = this.#execute.bind(this);
  }

  #execute(
    cells: vscode.NotebookCell[],
    _notebook: vscode.NotebookDocument,
    _controller: vscode.NotebookController
  ): void {
    for (let cell of cells) {
      this.#doExecution(cell);
    }
  }

  async #doExecution(cell: vscode.NotebookCell): Promise<void> {
    const execution = this.#controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this.#executionOrder;
    execution.start(Date.now()); // Keep track of elapsed time to execute cell.

    const cellText = cell.document.getText();
    const result = db.query(cellText);
    execution.replaceOutput([
      new vscode.NotebookCellOutput([
        vscode.NotebookCellOutputItem.json(result.rows)
      ])
    ]);
    execution.end(true, Date.now());
  }
}


