import { ExtensionHostKind, registerExtension } from "vscode/extensions";
import * as vscode from "vscode";
import { SQLNotebookExecutionController } from "./controller";
import { WORKSPACE_PREFIX } from "../constants";
import getWorkspace from "~/example-small-schema";
import { fileSystemProvider } from "~/fsProvider";
import { RegisteredMemoryFile } from "@codingame/monaco-vscode-files-service-override";

const { getApi } = registerExtension(
  {
    name: "sql-notebook",
    publisher: "pg-playground",
    version: "0.1.0",
    engines: {
      vscode: "*",
    },
    // activationEvents: ["onLanguage:sql", "onStartupFinished"],
    contributes: {
      notebooks: [
        {
          type: "sql-notebook",
          displayName: "SQL Notebook",
          priority: "default",
          selector: [{ filenamePattern: "*.sql" }],
        },
      ],
    },
  },
  ExtensionHostKind.LocalProcess,
);

void getApi().then(async vscode => {
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
});

// Cell block delimiter
const DELIMITER = "\n\n";

export class SQLSerializer implements vscode.NotebookSerializer {
  async deserializeNotebook(
    context: Uint8Array,
    _token: vscode.CancellationToken,
  ): Promise<vscode.NotebookData> {
    const str = new TextDecoder().decode(context);
    const blocks = splitSqlBlocks(str);

    const cells = blocks.map(query => {
      if (/^(---+|\/\*+\*\/)$/.test(query)) {
        return new vscode.NotebookCellData(
          vscode.NotebookCellKind.Markup,
          "***",
          "markdown",
        );
      }
      if (query.startsWith("/*") && query.endsWith("*/")) {
        return new vscode.NotebookCellData(
          vscode.NotebookCellKind.Markup,
          stripCommentChars(query),
          "markdown",
        );
      }

      return new vscode.NotebookCellData(
        vscode.NotebookCellKind.Code,
        query,
        "sql",
      );
    });
    return new vscode.NotebookData(cells);
  }

  async serializeNotebook(
    data: vscode.NotebookData,
    _token: vscode.CancellationToken,
  ): Promise<Uint8Array> {
    return new TextEncoder().encode(
      data.cells
        .map(({ value, kind }) => {
          if (kind === vscode.NotebookCellKind.Code) return value;
          if (value === "***") return "---";
          const lines = value.split("\n");
          if (lines[0].trim().length === 0) return "";
          const withCommentChars = lines
            .map(line => (!line ? " *" : " * " + line))
            .join("\n");
          return `/*\n${withCommentChars}\n */`;
        })
        .join(DELIMITER),
    );
  }
}

function stripCommentChars(query: string) {
  const lines = query.split("\n");
  const inner =
    /^\/\*\*?$/.exec(lines[0] ?? "") && /^\s*\*\//.exec(lines.at(-1) ?? "")
      ? lines.slice(1, -1)
      : lines;
  return (
    inner.every(line => /(^ \*$|^-- |^ * )/.exec(line))
      ? inner.map(line => line.slice(3) ?? "")
      : inner
  ).join("\n");
}

function splitSqlBlocks(raw: string): string[] {
  const blocks = [];
  for (const block of raw.split(/\n\n(?!\s+)/)) {
    if (block.trim().length > 0) {
      blocks.push(block);
      continue;
    }
    if (blocks.length < 1) {
      continue;
    }
    blocks[blocks.length - 1] += "\n\n";
  }
  return blocks;
}
