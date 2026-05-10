import type { Status } from "../types";

export function StatusBlock({ status }: { status: Status }) {
  const tone =
    status.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : status.tone === "error"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-border bg-card text-muted-foreground";

  return (
    <div className={`rounded-md border px-3 py-2 text-sm shadow-sm ${tone}`}>
      <div>{status.text}</div>
      {status.files?.length ? (
        <div className="mt-1 space-y-1 text-xs">
          {status.files.map((file) => (
            <div key={file} className="break-all">
              {file}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
