import { invoke } from "@tauri-apps/api/core";
import {
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  FileJson,
  Github,
  Loader2,
  RefreshCw,
  TerminalSquare,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CodeEditor } from "./components/CodeEditor";
import { StatusBlock } from "./components/StatusBlock";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Switch } from "./components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import {
  buildAuthJson,
  buildClaudeSettings,
  buildCodexConfig,
  cleanInput,
  defaultNotice,
  extractJsonString,
  extractQuotedValue,
  loadNotice,
} from "./lib/config";
import type {
  ConfigureClaudePayload,
  ConfigureCodexPayload,
  ConfigureResult,
  ConfigPaths,
  ExistingConfig,
  NoticePayload,
  Status,
} from "./types";

export default function App() {
  const hydrated = useRef(false);
  const suppressNextDerive = useRef(false);
  const [tab, setTab] = useState("codex");
  const [codexFileTab, setCodexFileTab] = useState("config");
  const [claudeFileTab, setClaudeFileTab] = useState("settings");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [supportsWebsockets, setSupportsWebsockets] = useState(false);
  const [codexConfigContent, setCodexConfigContent] = useState("");
  const [codexAuthContent, setCodexAuthContent] = useState("");
  const [claudeSettingsContent, setClaudeSettingsContent] = useState("");
  const [manualCodexConfig, setManualCodexConfig] = useState(false);
  const [manualCodexAuth, setManualCodexAuth] = useState(false);
  const [manualClaudeSettings, setManualClaudeSettings] = useState(false);
  const [paths, setPaths] = useState<ConfigPaths>();
  const [notice, setNotice] = useState<NoticePayload>(defaultNotice);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({
    tone: "idle",
    text: "正在读取本地配置...",
  });

  const cleanedBaseUrl = cleanInput(baseUrl);
  const cleanedApiKey = cleanInput(apiKey);
  const canSubmit = cleanedApiKey.length > 0 && cleanedBaseUrl.length > 0 && !busy;

  useEffect(() => {
    loadExistingConfig();
    loadNotice().then(setNotice);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (suppressNextDerive.current) {
      suppressNextDerive.current = false;
      return;
    }
    if (!manualCodexConfig) setCodexConfigContent(buildCodexConfig(cleanedBaseUrl, supportsWebsockets));
    if (!manualCodexAuth) setCodexAuthContent(buildAuthJson(cleanedApiKey));
    if (!manualClaudeSettings) setClaudeSettingsContent(buildClaudeSettings(cleanedBaseUrl, cleanedApiKey));
  }, [cleanedApiKey, cleanedBaseUrl, supportsWebsockets, manualCodexConfig, manualCodexAuth, manualClaudeSettings]);

  async function loadExistingConfig() {
    setBusy(true);
    try {
      const existing = await invoke<ExistingConfig>("read_existing_config");
      const existingBaseUrl =
        extractQuotedValue(existing.codexConfig, "base_url") ||
        extractJsonString(existing.claudeSettings, ["env", "ANTHROPIC_BASE_URL"]);
      const existingApiKey =
        extractJsonString(existing.codexAuth, ["OPENAI_API_KEY"]) ||
        extractJsonString(existing.claudeSettings, ["env", "ANTHROPIC_AUTH_TOKEN"]);
      const existingWebsocket =
        existing.codexConfig.includes("supports_websockets = true") ||
        existing.codexConfig.includes("responses_websockets_v2 = true");

      setBaseUrl(existingBaseUrl);
      setApiKey(existingApiKey);
      setSupportsWebsockets(existingWebsocket);
      setCodexConfigContent(existing.codexConfig || buildCodexConfig(existingBaseUrl, existingWebsocket));
      setCodexAuthContent(existing.codexAuth || buildAuthJson(existingApiKey));
      setClaudeSettingsContent(existing.claudeSettings || buildClaudeSettings(existingBaseUrl, existingApiKey));
      setManualCodexConfig(false);
      setManualCodexAuth(false);
      setManualClaudeSettings(false);
      setPaths(existing);
      setStatus({
        tone: "idle",
        text: existing.codexConfig || existing.codexAuth || existing.claudeSettings ? "已读取本地配置。" : "未发现现有配置，可直接填写后写入。",
      });
      suppressNextDerive.current = true;
      hydrated.current = true;
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  async function runCommand<TPayload extends object>(
    command: string,
    payload: TPayload,
    manualEdited: boolean,
    clearManualState: () => void,
  ) {
    if (manualEdited && !window.confirm("你正在写入手动编辑过的配置内容。确认继续吗？")) return;
    setBusy(true);
    setStatus({ tone: "idle", text: "正在写入..." });
    try {
      const result = await invoke<ConfigureResult>(command, { payload });
      clearManualState();
      setStatus({ tone: "success", text: result.message, files: result.writtenFiles });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  async function openExternal(url: string) {
    try {
      await invoke("open_url", { url });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    }
  }

  const configureCodex = () =>
    runCommand<ConfigureCodexPayload>(
      "configure_codex",
      {
        apiKey: cleanedApiKey,
        baseUrl: cleanedBaseUrl,
        supportsWebsockets,
        ...(manualCodexConfig ? { configContent: codexConfigContent } : {}),
        ...(manualCodexAuth ? { authContent: codexAuthContent } : {}),
      },
      manualCodexConfig || manualCodexAuth,
      () => {
        setManualCodexConfig(false);
        setManualCodexAuth(false);
      },
    );

  const configureClaude = () =>
    runCommand<ConfigureClaudePayload>(
      "configure_claude",
      {
        apiKey: cleanedApiKey,
        baseUrl: cleanedBaseUrl,
        ...(manualClaudeSettings ? { settingsContent: claudeSettingsContent } : {}),
      },
      manualClaudeSettings,
      () => setManualClaudeSettings(false),
    );

  const commandPreview = `set ANTHROPIC_BASE_URL=${cleanedBaseUrl}
set ANTHROPIC_AUTH_TOKEN=${cleanedApiKey}
set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`;

  return (
    <main className="app-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden">
              <img src="/app-icon.png" alt="" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-normal">Codex API 配置工具</h1>
              <p className="mt-1 text-sm text-muted-foreground">Codex 与 Claude Code 中转配置工具</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="icon"
              title="GitHub"
              onClick={() => openExternal("https://github.com/nas-tool/codex-api-configure")}
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">GitHub</span>
            </Button>
            <Button variant="outline" onClick={loadExistingConfig} disabled={busy}>
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
              重新读取
            </Button>
          </div>
        </header>

        <section className="py-5">
          <Card className="border-amber-200 bg-amber-50/80 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4 text-sm text-amber-950 lg:flex-row lg:items-center lg:justify-between">
              <div className="leading-6">
                <span className="font-semibold">{notice.title}</span>
                <span className="ml-2">{notice.description}</span>
                {notice.extra ? <span className="ml-2">{notice.extra}</span> : null}
              </div>
              <Button
                variant="outline"
                className="border-amber-300 bg-white/70 hover:bg-white"
                onClick={() => openExternal(notice.url)}
              >
                {notice.buttonText}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid flex-1 gap-5 pb-5 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card>
              <CardHeader className="p-4">
                <CardTitle>连接</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0">
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">中转站地址</Label>
                  <Input
                    id="baseUrl"
                    placeholder="api.example.com 或完整地址"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    autoComplete="url"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="text"
                    placeholder="输入 API Key"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                  <Label htmlFor="websocket" className="text-sm">
                    WebSocket
                  </Label>
                  <Switch id="websocket" checked={supportsWebsockets} onCheckedChange={setSupportsWebsockets} />
                </div>
                <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">Base URL</div>
                  <div className="mt-1 break-all">{cleanedBaseUrl || "等待输入"}</div>
                </div>
              </CardContent>
            </Card>
            <StatusBlock status={status} />
          </aside>

          <div className="min-w-0">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="codex">Codex</TabsTrigger>
                <TabsTrigger value="claude">Claude Code</TabsTrigger>
                <TabsTrigger value="about">关于</TabsTrigger>
              </TabsList>

              <TabsContent value="codex">
                <Card>
                  <CardHeader className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Code2 className="h-4 w-4" aria-hidden="true" />
                        Codex
                      </CardTitle>
                      <Button onClick={configureCodex} disabled={!canSubmit} className="sm:min-w-36">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                        写入 Codex
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Tabs value={codexFileTab} onValueChange={setCodexFileTab}>
                      <TabsList>
                        <TabsTrigger value="config">config.toml</TabsTrigger>
                        <TabsTrigger value="auth">auth.json</TabsTrigger>
                      </TabsList>
                      <TabsContent value="config">
                        <CodeEditor
                          label="config.toml"
                          language="toml"
                          path={paths?.codexConfigPath}
                          value={codexConfigContent}
                          manual={manualCodexConfig}
                          onChange={(value) => {
                            setCodexConfigContent(value);
                            setManualCodexConfig(true);
                          }}
                        />
                      </TabsContent>
                      <TabsContent value="auth">
                        <CodeEditor
                          label="auth.json"
                          language="json"
                          path={paths?.codexAuthPath}
                          value={codexAuthContent}
                          manual={manualCodexAuth}
                          onChange={(value) => {
                            setCodexAuthContent(value);
                            setManualCodexAuth(true);
                          }}
                        />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="claude">
                <Card>
                  <CardHeader className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <TerminalSquare className="h-4 w-4" aria-hidden="true" />
                        Claude Code
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => navigator.clipboard.writeText(commandPreview)}
                          disabled={!cleanedBaseUrl || !cleanedApiKey}
                        >
                          <Copy className="h-4 w-4" aria-hidden="true" />
                          复制 CMD
                        </Button>
                        <Button onClick={configureClaude} disabled={!canSubmit} className="sm:min-w-36">
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileJson className="h-4 w-4" aria-hidden="true" />}
                          写入 Claude
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <Tabs value={claudeFileTab} onValueChange={setClaudeFileTab}>
                      <TabsList>
                        <TabsTrigger value="settings">settings.json</TabsTrigger>
                        <TabsTrigger value="cmd">Windows CMD</TabsTrigger>
                      </TabsList>
                      <TabsContent value="settings">
                        <CodeEditor
                          label="settings.json"
                          language="json"
                          path={paths?.claudeSettingsPath}
                          value={claudeSettingsContent}
                          manual={manualClaudeSettings}
                          onChange={(value) => {
                            setClaudeSettingsContent(value);
                            setManualClaudeSettings(true);
                          }}
                        />
                      </TabsContent>
                      <TabsContent value="cmd">
                        <CodeEditor label="Windows CMD" language="cmd" value={commandPreview} readOnly />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="about">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle>关于</CardTitle>
                    <CardDescription>本地配置工具，不上传密钥。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 pt-0 text-sm leading-7 text-muted-foreground">
                    <p>
                      作者：<span className="font-medium text-foreground">Haoyu Wang</span>
                    </p>
                    <p>
                      官网：
                      <button
                        type="button"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => openExternal("https://wanghaoyu.com.cn")}
                      >
                        wanghaoyu.com.cn
                      </button>
                    </p>
                    <p>默认读取本机已有配置。编辑代码块后写入会要求二次确认。</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-border/70 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>Codex API Configure</div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-foreground hover:bg-accent"
              title="GitHub"
              onClick={() => openExternal("https://github.com/nas-tool/codex-api-configure")}
            >
              <Github className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">GitHub</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
              onClick={() => openExternal("https://wanghaoyu.com.cn")}
            >
              Haoyu Wang
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
