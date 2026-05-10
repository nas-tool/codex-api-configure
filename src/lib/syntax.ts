export type CodeLanguage = "toml" | "json" | "cmd";

export function highlightCode(value: string, language: CodeLanguage) {
  const escaped = escapeHtml(value);
  if (language === "cmd") {
    return escaped.replace(
      /^(set)(\s+)([^=]+)(=)(.*)$/gm,
      '<span class="syntax-key">$1</span>$2<span class="syntax-prop">$3</span><span class="syntax-op">$4</span><span class="syntax-string">$5</span>',
    );
  }
  if (language === "json") {
    return escaped
      .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="syntax-prop">$1</span>$2')
      .replace(/(:\s*)(&quot;.*?&quot;)/g, '$1<span class="syntax-string">$2</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="syntax-bool">$1</span>');
  }
  return escaped
    .replace(/^(\[[^\]]+\])/gm, '<span class="syntax-section">$1</span>')
    .replace(/^([A-Za-z0-9_.-]+)(\s*=)/gm, '<span class="syntax-prop">$1</span>$2')
    .replace(/=\s*(&quot;.*?&quot;)/g, '= <span class="syntax-string">$1</span>')
    .replace(/\b(true|false)\b/g, '<span class="syntax-bool">$1</span>')
    .replace(/\b(\d{4,})\b/g, '<span class="syntax-number">$1</span>');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
