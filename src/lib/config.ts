import type { NoticePayload } from "../types";

const encodedNotice = {
  title: "Q29kZXggQVBJIOS4rei9rA==",
  description:
    "MXgg5YCN546H77yMUGx1cyDlj7fmsaDvvIzlk43lupTlv6vvvIzmu6HooYAgNS41IOS4rei9rO+8jOS4u+aJk+S+v+WunOeos+WumuS4jeaOuuawtO+8jOmVv+acn+i/kOihjOS4jei3kei3r+OAgg==",
  extra: "5Y+m5aSW5pyJ5L2O5Lu3IFBsdXMg6LSm5Y+36LSo5L+d6aaW55m744CC",
  url: "aHR0cHM6Ly9wYXkubGR4cC5jbi9zaG9wL0VHUVNRVEtE",
  buttonText: "5p+l55yL",
  endpoint: "aHR0cHM6Ly93d3cud2FuZ2hhb3l1LmNvbS5jbi9hcGkvYWQucGhw",
};

export const defaultNotice: NoticePayload = {
  title: decodeText(encodedNotice.title),
  description: decodeText(encodedNotice.description),
  extra: decodeText(encodedNotice.extra),
  url: decodeText(encodedNotice.url),
  buttonText: decodeText(encodedNotice.buttonText),
};

export async function loadNotice() {
  try {
    const response = await fetch(decodeText(encodedNotice.endpoint), {
      cache: "no-store",
    });
    if (!response.ok) return defaultNotice;

    const text = (await response.text()).trim();
    if (!text) return defaultNotice;

    return parseNotice(text);
  } catch {
    return defaultNotice;
  }
}

export function cleanInput(value: string) {
  return value.trim();
}

export function buildCodexConfig(baseUrl: string, supportsWebsockets: boolean) {
  return `model_provider = "OpenAI"
model = "gpt-5.4"
review_model = "gpt-5.4"
model_reasoning_effort = "xhigh"
disable_response_storage = true
network_access = "enabled"
windows_wsl_setup_acknowledged = true
model_context_window = 1000000
model_auto_compact_token_limit = 900000

[model_providers.OpenAI]
name = "OpenAI"
base_url = "${baseUrl}"
wire_api = "responses"
${supportsWebsockets ? "supports_websockets = true\n" : ""}requires_openai_auth = true${
    supportsWebsockets
      ? `

[features]
responses_websockets_v2 = true`
      : ""
  }`;
}

export function buildAuthJson(apiKey: string) {
  return JSON.stringify({ OPENAI_API_KEY: apiKey }, null, 2);
}

export function buildClaudeSettings(baseUrl: string, apiKey: string) {
  return JSON.stringify(
    {
      env: {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_AUTH_TOKEN: apiKey,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        CLAUDE_CODE_ATTRIBUTION_HEADER: "0",
      },
    },
    null,
    2,
  );
}

export function extractQuotedValue(content: string, key: string) {
  return content.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"))?.[1] ?? "";
}

export function extractJsonString(content: string, path: string[]) {
  try {
    let value: unknown = JSON.parse(content);
    for (const key of path) {
      if (!value || typeof value !== "object" || !(key in value)) return "";
      value = (value as Record<string, unknown>)[key];
    }
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

function parseNotice(text: string): NoticePayload {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    const title = readString(value, ["title", "name", "headline"]) || defaultNotice.title;
    const description =
      readString(value, ["description", "desc", "content", "text"]) || defaultNotice.description;
    const extra = readString(value, ["extra", "subtitle", "subtext"]) || defaultNotice.extra;
    const url = readString(value, ["url", "link", "href"]) || defaultNotice.url;
    const buttonText = readString(value, ["buttonText", "button", "cta"]) || defaultNotice.buttonText;
    return { title, description, extra, url, buttonText };
  } catch {
    return {
      ...defaultNotice,
      description: text,
    };
  }
}

function readString(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const current = value[key];
    if (typeof current === "string" && current.trim()) return current.trim();
  }
  return "";
}

function decodeText(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
