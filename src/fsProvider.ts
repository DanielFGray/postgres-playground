import {
  RegisteredFileSystemProvider,
  InMemoryFileSystemProvider,
} from "@codingame/monaco-vscode-files-service-override";

export const fileSystemProvider = new RegisteredFileSystemProvider(false);

// export const fileSystemProvider = new InMemoryFileSystemProvider();
