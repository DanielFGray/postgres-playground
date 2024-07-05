import "./style.css";
import "./features/notebook/markdown";
import "./features/notebook/sql";
// import './features/output'
// import './features/debugger'
import "./features/search";
// import './features/intellisense'
// import './features/notifications'
// import './features/terminal'
// import './features/scm'
import "./features/postgres";
import "./features/testing";
import "./features/ai";
import "@codingame/monaco-vscode-diff-default-extension";
import "@codingame/monaco-vscode-json-default-extension";
import "@codingame/monaco-vscode-json-language-features-default-extension";
import "@codingame/monaco-vscode-markdown-basics-default-extension";
import "@codingame/monaco-vscode-markdown-language-features-default-extension";
import "@codingame/monaco-vscode-sql-default-extension";
import "@codingame/monaco-vscode-typescript-language-features-default-extension";
// import '@codingame/monaco-vscode-html-language-features-default-extension'
// import '@codingame/monaco-vscode-css-language-features-default-extension'
// import '@codingame/monaco-vscode-emmet-default-extension'
import "@codingame/monaco-vscode-theme-defaults-default-extension";
import "@codingame/monaco-vscode-theme-seti-default-extension";
import "@codingame/monaco-vscode-references-view-default-extension";
import "@codingame/monaco-vscode-search-result-default-extension";
import "@codingame/monaco-vscode-configuration-editing-default-extension";
import "@codingame/monaco-vscode-media-preview-default-extension";
import {
  IStorageService,
  getService,
  initialize as initializeMonacoService,
} from "vscode/services";
import getWorkbenchServiceOverride from "@codingame/monaco-vscode-workbench-service-override";
import getQuickAccessServiceOverride from "@codingame/monaco-vscode-quickaccess-service-override";
import { BrowserStorageService } from "@codingame/monaco-vscode-storage-service-override";
import {
  commonServices,
  constructOptions,
  envOptions,
  userDataProvider,
} from "./workbench";

const container = document.createElement("div");
container.style.height = "100dvh";

document.body.append(container);

// Override services
await initializeMonacoService(
  {
    ...commonServices,
    ...getWorkbenchServiceOverride(),
    ...getQuickAccessServiceOverride({
      isKeybindingConfigurationVisible: () => true,
      shouldUseGlobalPicker: _editor => true,
    }),
  },
  container,
  constructOptions,
  envOptions,
);

// const layoutService = await getService(IWorkbenchLayoutService)
// document.querySelector('#togglePanel')!.addEventListener('click', async () => {
//   layoutService.setPartHidden(layoutService.isVisible(Parts.PANEL_PART, window), Parts.PANEL_PART)
// })

// document.querySelector('#toggleAuxiliary')!.addEventListener('click', async () => {
//   layoutService.setPartHidden(layoutService.isVisible(Parts.AUXILIARYBAR_PART, window), Parts.AUXILIARYBAR_PART)
// })

export async function clearStorage(): Promise<void> {
  await userDataProvider.reset();
  await ((await getService(IStorageService)) as BrowserStorageService).clear();
}

const searchParams = new URLSearchParams(window.location.search);
const locale = searchParams.get("locale");

const localeLoader: Partial<Record<string, () => Promise<void>>> = {
  cs: async () => {
    await import("@codingame/monaco-vscode-language-pack-cs");
  },
  de: async () => {
    await import("@codingame/monaco-vscode-language-pack-de");
  },
  es: async () => {
    await import("@codingame/monaco-vscode-language-pack-es");
  },
  fr: async () => {
    await import("@codingame/monaco-vscode-language-pack-fr");
  },
  it: async () => {
    await import("@codingame/monaco-vscode-language-pack-it");
  },
  ja: async () => {
    await import("@codingame/monaco-vscode-language-pack-ja");
  },
  ko: async () => {
    await import("@codingame/monaco-vscode-language-pack-ko");
  },
  pl: async () => {
    await import("@codingame/monaco-vscode-language-pack-pl");
  },
  "pt-br": async () => {
    await import("@codingame/monaco-vscode-language-pack-pt-br");
  },
  "qps-ploc": async () => {
    await import("@codingame/monaco-vscode-language-pack-qps-ploc");
  },
  ru: async () => {
    await import("@codingame/monaco-vscode-language-pack-ru");
  },
  tr: async () => {
    await import("@codingame/monaco-vscode-language-pack-tr");
  },
  "zh-hans": async () => {
    await import("@codingame/monaco-vscode-language-pack-zh-hans");
  },
  "zh-hant": async () => {
    await import("@codingame/monaco-vscode-language-pack-zh-hant");
  },
};

if (locale != null) {
  const loader = localeLoader[locale];
  if (loader != null) {
    await loader();
  } else {
    console.error(`Unknown locale ${locale}`);
  }
}

export {};
