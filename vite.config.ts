import { defineConfig } from "vite";
import importMetaUrlPlugin from "@codingame/esbuild-import-meta-url-plugin";
import * as fs from "fs";
import path from "path";
import pkg from "./package.json" assert { type: "json" };

export default defineConfig({
  build: {
    target: "esnext",
    rollupOptions: {
      external: ['~lib']
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    fs: {
      allow: ["../"], // allow to load codicon.ttf from monaco-editor in the parent folder
    },
    proxy: {
      "/auth": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ""),
      },
    },
  },
  plugins: [
    {
      // For the *-language-features extensions which use SharedArrayBuffer
      name: "configure-response-headers",
      apply: "serve",
      configureServer: server => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          next();
        });
      },
    },
    {
      name: "force-prevent-transform-assets",
      apply: "serve",
      configureServer(server) {
        return () => {
          server.middlewares.use(async (req, res, next) => {
            if (req.originalUrl != null) {
              const pathname = new URL(req.originalUrl, import.meta.url)
                .pathname;
              if (pathname.endsWith(".html")) {
                res.setHeader("Content-Type", "text/html");
                res.writeHead(200);
                res.write(fs.readFileSync(path.join(__dirname, pathname)));
                res.end();
              }
            }

            next();
          });
        };
      },
    },
  ],
  optimizeDeps: {
    include: [
      "vscode/extensions",
      "vscode/services",
      "vscode/monaco",
      "vscode/localExtensionHost",

      // These 2 lines prevent vite from reloading the whole page when starting a worker (so 2 times in a row after cleaning the vite cache - for the editor then the textmate workers)
      // it's mainly empirical and probably not the best way, fix me if you find a better way
      "vscode-textmate",
      "vscode-oniguruma",
      "@vscode/vscode-languagedetection",
    ],
    exclude: ["@electric-sql/pglite"],
    esbuildOptions: {
      tsconfig: "./tsconfig.json",
      plugins: [importMetaUrlPlugin],
    },
  },
  define: {
    rootDirectory: JSON.stringify(__dirname),
  },
  resolve: {
    dedupe: ["vscode"],
  },
});
