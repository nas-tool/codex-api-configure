export type ConfigureCodexPayload = {
  apiKey: string;
  baseUrl: string;
  supportsWebsockets: boolean;
  configContent?: string;
  authContent?: string;
};

export type ConfigureClaudePayload = {
  apiKey: string;
  baseUrl: string;
  settingsContent?: string;
};

export type ConfigureResult = {
  message: string;
  writtenFiles: string[];
};

export type ExistingConfig = {
  codexConfig: string;
  codexAuth: string;
  claudeSettings: string;
  codexConfigPath: string;
  codexAuthPath: string;
  claudeSettingsPath: string;
};

export type ConfigPaths = Pick<ExistingConfig, "codexConfigPath" | "codexAuthPath" | "claudeSettingsPath">;

export type Status = {
  tone: "idle" | "success" | "error";
  text: string;
  files?: string[];
};

export type NoticePayload = {
  title: string;
  description: string;
  extra?: string;
  url: string;
  buttonText: string;
};
