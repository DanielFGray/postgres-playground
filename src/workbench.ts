import getConfigurationServiceOverride, { IStoredWorkspace, initUserConfiguration } from '@codingame/monaco-vscode-configuration-service-override'
import getKeybindingsServiceOverride, { initUserKeybindings } from '@codingame/monaco-vscode-keybindings-service-override'
import { RegisteredFileSystemProvider, RegisteredMemoryFile, createIndexedDBProviders, registerFileSystemOverlay } from '@codingame/monaco-vscode-files-service-override'
import * as monaco from 'monaco-editor'
import { IWorkbenchConstructionOptions, LogLevel, IEditorOverrideServices } from 'vscode/services'
import * as vscode from 'vscode'
import getModelServiceOverride from '@codingame/monaco-vscode-model-service-override'
import getNotificationServiceOverride from '@codingame/monaco-vscode-notifications-service-override'
import getDialogsServiceOverride from '@codingame/monaco-vscode-dialogs-service-override'
import getTextmateServiceOverride from '@codingame/monaco-vscode-textmate-service-override'
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override'
import getLanguagesServiceOverride from '@codingame/monaco-vscode-languages-service-override'
import getSecretStorageServiceOverride from '@codingame/monaco-vscode-secret-storage-service-override'
import getAuthenticationServiceOverride from '@codingame/monaco-vscode-authentication-service-override'
import getScmServiceOverride from '@codingame/monaco-vscode-scm-service-override'
import getExtensionGalleryServiceOverride from '@codingame/monaco-vscode-extension-gallery-service-override'
import getBannerServiceOverride from '@codingame/monaco-vscode-view-banner-service-override'
import getStatusBarServiceOverride from '@codingame/monaco-vscode-view-status-bar-service-override'
import getTitleBarServiceOverride from '@codingame/monaco-vscode-view-title-bar-service-override'
import getDebugServiceOverride from '@codingame/monaco-vscode-debug-service-override'
import getPreferencesServiceOverride from '@codingame/monaco-vscode-preferences-service-override'
import getSnippetServiceOverride from '@codingame/monaco-vscode-snippets-service-override'
import getOutputServiceOverride from '@codingame/monaco-vscode-output-service-override'
import getTerminalServiceOverride from '@codingame/monaco-vscode-terminal-service-override'
import getSearchServiceOverride from '@codingame/monaco-vscode-search-service-override'
import getMarkersServiceOverride from '@codingame/monaco-vscode-markers-service-override'
import getAccessibilityServiceOverride from '@codingame/monaco-vscode-accessibility-service-override'
import getLanguageDetectionWorkerServiceOverride from '@codingame/monaco-vscode-language-detection-worker-service-override'
import getStorageServiceOverride from '@codingame/monaco-vscode-storage-service-override'
import getExtensionServiceOverride from '@codingame/monaco-vscode-extensions-service-override'
import getRemoteAgentServiceOverride from '@codingame/monaco-vscode-remote-agent-service-override'
import getEnvironmentServiceOverride from '@codingame/monaco-vscode-environment-service-override'
import getLifecycleServiceOverride from '@codingame/monaco-vscode-lifecycle-service-override'
import getWorkspaceTrustOverride from '@codingame/monaco-vscode-workspace-trust-service-override'
import getLogServiceOverride from '@codingame/monaco-vscode-log-service-override'
import getWorkingCopyServiceOverride from '@codingame/monaco-vscode-working-copy-service-override'
import getTestingServiceOverride from '@codingame/monaco-vscode-testing-service-override'
import getChatServiceOverride from '@codingame/monaco-vscode-chat-service-override'
import getNotebookServiceOverride from '@codingame/monaco-vscode-notebook-service-override'
import getWelcomeServiceOverride from '@codingame/monaco-vscode-welcome-service-override'
import getWalkThroughServiceOverride from '@codingame/monaco-vscode-walkthrough-service-override'
import getUserDataSyncServiceOverride from '@codingame/monaco-vscode-user-data-sync-service-override'
import getUserDataProfileServiceOverride from '@codingame/monaco-vscode-user-data-profile-service-override'
import getAiServiceOverride from '@codingame/monaco-vscode-ai-service-override'
import getTaskServiceOverride from '@codingame/monaco-vscode-task-service-override'
import getOutlineServiceOverride from '@codingame/monaco-vscode-outline-service-override'
import getTimelineServiceOverride from '@codingame/monaco-vscode-timeline-service-override'
import getCommentsServiceOverride from '@codingame/monaco-vscode-comments-service-override'
import getEditSessionsServiceOverride from '@codingame/monaco-vscode-edit-sessions-service-override'
import getEmmetServiceOverride from '@codingame/monaco-vscode-emmet-service-override'
import getInteractiveServiceOverride from '@codingame/monaco-vscode-interactive-service-override'
import getIssueServiceOverride from '@codingame/monaco-vscode-issue-service-override'
import getMultiDiffEditorServiceOverride from '@codingame/monaco-vscode-multi-diff-editor-service-override'
import getPerformanceServiceOverride from '@codingame/monaco-vscode-performance-service-override'
import getRelauncherServiceOverride from '@codingame/monaco-vscode-relauncher-service-override'
import getShareServiceOverride from '@codingame/monaco-vscode-share-service-override'
import getSpeechServiceOverride from '@codingame/monaco-vscode-speech-service-override'
import getSurveyServiceOverride from '@codingame/monaco-vscode-survey-service-override'
import getUpdateServiceOverride from '@codingame/monaco-vscode-update-service-override'
import getExplorerServiceOverride from '@codingame/monaco-vscode-explorer-service-override'
import getLocalizationServiceOverride from '@codingame/monaco-vscode-localization-service-override'
import { EnvironmentOverride } from 'vscode/workbench'
import { Worker } from './tools/crossOriginWorker'
import defaultKeybindings from './user/keybindings.json?raw'
import defaultConfiguration from './user/configuration.json?raw'
// import { TerminalBackend } from './features/terminal'
import { workerConfig } from './tools/extHostWorker'
import 'vscode/localExtensionHost'
import getWorkspace from './example-schema'

const url = new URL(document.location.href)
const params = url.searchParams
export const remoteAuthority = params.get('remoteAuthority') ?? undefined
export const connectionToken = params.get('connectionToken') ?? undefined
export const remotePath = remoteAuthority != null ? params.get('remotePath') ?? undefined : undefined

window.history.replaceState({}, document.title, url.href)

export let workspaceFile = monaco.Uri.file('/workspace.code-workspace')

export const userDataProvider = await createIndexedDBProviders()

const fileSystemProvider = new RegisteredFileSystemProvider(false)

const workspacePrefix = '/workspace'

const { defaultLayout, files } = getWorkspace()

Object.entries(files).forEach(([path, value]) =>
  fileSystemProvider.registerFile(
    new RegisteredMemoryFile(
      vscode.Uri.file(workspacePrefix.concat(
        path.startsWith('/') ? path : `/${path}`
      )),
      value
    )
  )
)

// Use a workspace file to be able to add another folder later (for the "Attach filesystem" button)
fileSystemProvider.registerFile(new RegisteredMemoryFile(workspaceFile, JSON.stringify(<IStoredWorkspace>{
  folders: [{
    path: workspacePrefix
  }]
}, null, 2)))

// fileSystemProvider.registerFile(new RegisteredMemoryFile(monaco.Uri.file('/workspace/.vscode/extensions.json'), JSON.stringify({
//   recommendations: [
//     'vscodevim.vim'
//   ]
// }, null, 2)))

registerFileSystemOverlay(1, fileSystemProvider)

// Workers
export type WorkerLoader = () => Worker
const workerLoaders: Partial<Record<string, WorkerLoader>> = {
  editorWorkerService: () => new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), { type: 'module' }),
  textMateWorker: () => new Worker(new URL('@codingame/monaco-vscode-textmate-service-override/worker', import.meta.url), { type: 'module' }),
  outputLinkComputer: () => new Worker(new URL('@codingame/monaco-vscode-output-service-override/worker', import.meta.url), { type: 'module' }),
  languageDetectionWorkerService: () => new Worker(new URL('@codingame/monaco-vscode-language-detection-worker-service-override/worker', import.meta.url), { type: 'module' }),
  notebookEditorWorkerService: () => new Worker(new URL('@codingame/monaco-vscode-notebook-service-override/worker', import.meta.url), { type: 'module' }),
  localFileSearchWorker: () => new Worker(new URL('@codingame/monaco-vscode-search-service-override/worker', import.meta.url), { type: 'module' })
}

window.MonacoEnvironment = {
  getWorker: function(moduleId, label) {
    const workerFactory = workerLoaders[label]
    if (workerFactory != null) {
      return workerFactory()
    }
    throw new Error(`Unimplemented worker ${label} (${moduleId})`)
  }
}

// Set configuration before initializing service so it's directly available (especially for the theme, to prevent a flicker)
await Promise.all([
  initUserConfiguration(defaultConfiguration),
  initUserKeybindings(defaultKeybindings)
])

export const constructOptions: IWorkbenchConstructionOptions = {
  remoteAuthority,
  enableWorkspaceTrust: false,
  connectionToken,
  windowIndicator: {
    label: "Postgres Playground",
    tooltip: "",
    command: "",
  },
  workspaceProvider: {
    trusted: false,
    async open() {
      return false;
    },
    workspace:
      remotePath == null
        ? {
            workspaceUri: workspaceFile,
          }
        : {
            folderUri: monaco.Uri.from({
              scheme: "vscode-remote",
              path: remotePath,
              authority: remoteAuthority,
            }),
          },
  },
  developmentOptions: {
    logLevel: LogLevel.Info, // Default value
  },
  configurationDefaults: {
    // eslint-disable-next-line no-template-curly-in-string
    "window.title":
      "Postgres Playground${separator}${dirty}${activeEditorShort}",
  },
  defaultLayout: {
    editors: defaultLayout.editors.map(({ uri, ...rest }) => ({
      ...rest,
      uri: vscode.Uri.file(
        workspacePrefix.concat(uri.startsWith("/") ? uri : `/${uri}`),
      ),
    })),
    layout: defaultLayout.layout,
    // views: [{ id: 'custom-view' }],
    force: true,
  },
  welcomeBanner: {
    message: "Welcome to Postgres Playground",
  },
  productConfiguration: {
    nameShort: "pg-playground",
    nameLong: "Postgres Playground",
    extensionsGallery: {
      serviceUrl: "https://open-vsx.org/vscode/gallery",
      itemUrl: "https://open-vsx.org/vscode/item",
      resourceUrlTemplate:
        "https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}",
      controlUrl: "",
      nlsBaseUrl: "",
      publisherUrl: "",
    },
  },
};

export const envOptions: EnvironmentOverride = {
  // Otherwise, VSCode detect it as the first open workspace folder
  // which make the search result extension fail as it's not able to know what was detected by VSCode
  userHome: vscode.Uri.file('/')
}

export const commonServices: IEditorOverrideServices = {
  ...getAuthenticationServiceOverride(),
  ...getLogServiceOverride(),
  ...getExtensionServiceOverride(workerConfig),
  ...getExtensionGalleryServiceOverride({ webOnly: false }),
  ...getModelServiceOverride(),
  ...getNotificationServiceOverride(),
  ...getDialogsServiceOverride(),
  ...getConfigurationServiceOverride(),
  ...getKeybindingsServiceOverride(),
  ...getTextmateServiceOverride(),
  ...getThemeServiceOverride(),
  ...getLanguagesServiceOverride(),
  ...getDebugServiceOverride(),
  ...getPreferencesServiceOverride(),
  ...getOutlineServiceOverride(),
  ...getTimelineServiceOverride(),
  ...getBannerServiceOverride(),
  ...getStatusBarServiceOverride(),
  ...getTitleBarServiceOverride(),
  ...getSnippetServiceOverride(),
  ...getOutputServiceOverride(),
  ...getTerminalServiceOverride(),
  ...getSearchServiceOverride(),
  ...getMarkersServiceOverride(),
  ...getAccessibilityServiceOverride(),
  ...getLanguageDetectionWorkerServiceOverride(),
  ...getStorageServiceOverride({
    fallbackOverride: { 'workbench.activity.showAccounts': true }
  }),
  ...getRemoteAgentServiceOverride({ scanRemoteExtensions: true }),
  ...getLifecycleServiceOverride(),
  ...getEnvironmentServiceOverride(),
  ...getWorkspaceTrustOverride(),
  ...getWorkingCopyServiceOverride(),
  ...getScmServiceOverride(),
  ...getTestingServiceOverride(),
  ...getChatServiceOverride(),
  ...getNotebookServiceOverride(),
  ...getWelcomeServiceOverride(),
  ...getWalkThroughServiceOverride(),
  ...getUserDataProfileServiceOverride(),
  ...getUserDataSyncServiceOverride(),
  ...getAiServiceOverride(),
  ...getTaskServiceOverride(),
  ...getCommentsServiceOverride(),
  ...getEditSessionsServiceOverride(),
  ...getEmmetServiceOverride(),
  ...getInteractiveServiceOverride(),
  ...getIssueServiceOverride(),
  ...getMultiDiffEditorServiceOverride(),
  ...getPerformanceServiceOverride(),
  ...getRelauncherServiceOverride(),
  ...getShareServiceOverride(),
  ...getSpeechServiceOverride(),
  ...getSurveyServiceOverride(),
  ...getUpdateServiceOverride(),
  ...getExplorerServiceOverride(),
  ...getLocalizationServiceOverride({
    async clearLocale() {
      const url = new URL(window.location.href)
      url.searchParams.delete('locale')
      window.history.pushState(null, '', url.toString())
    },
    async setLocale(id) {
      const url = new URL(window.location.href)
      url.searchParams.set('locale', id)
      window.history.pushState(null, '', url.toString())
    },
    availableLanguages: [{
      locale: 'en',
      languageName: 'English'
    }, {
      locale: 'cs',
      languageName: 'Czech'
    }, {
      locale: 'de',
      languageName: 'German'
    }, {
      locale: 'es',
      languageName: 'Spanish'
    }, {
      locale: 'fr',
      languageName: 'French'
    }, {
      locale: 'it',
      languageName: 'Italian'
    }, {
      locale: 'ja',
      languageName: 'Japanese'
    }, {
      locale: 'ko',
      languageName: 'Korean'
    }, {
      locale: 'pl',
      languageName: 'Polish'
    }, {
      locale: 'pt-br',
      languageName: 'Portuguese (Brazil)'
    }, {
      locale: 'qps-ploc',
      languageName: 'Pseudo Language'
    }, {
      locale: 'ru',
      languageName: 'Russian'
    }, {
      locale: 'tr',
      languageName: 'Turkish'
    }, {
      locale: 'zh-hans',
      languageName: 'Chinese (Simplified)'
    }, {
      locale: 'zh-hant',
      languageName: 'Chinese (Traditional)'
    }, {
      locale: 'en',
      languageName: 'English'
    }]
  }),
  ...getSecretStorageServiceOverride()
}
