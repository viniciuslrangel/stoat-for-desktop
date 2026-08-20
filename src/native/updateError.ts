const DETAIL_MAX_CHARS = 800;

const USER_NETWORK =
  "Couldn't reach the update server. Check your network and try again.";
const USER_DOWNLOAD =
  "The update download failed. Check your network and try again.";
const USER_GENERIC = "Couldn't check for updates. Try again later.";

export type DescribedUpdateError = {
  userMessage: string;
  detail: string;
};

function collectPart(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (value instanceof Error) {
    return value.stack || value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

export function rawUpdateErrorText(error: unknown, extra?: unknown): string {
  return [collectPart(error), collectPart(extra)]
    .filter((part) => part.length > 0)
    .join("\n");
}

function foldForMatch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]+/g, "")
    .replace(/\uFFFD/g, "")
    .toLowerCase();
}

function repairWindowsText(text: string): string {
  let next = text.replace(/\r\n/g, "\n");

  try {
    const recoded = Buffer.from(next, "latin1").toString("utf8");
    if (!recoded.includes("\uFFFD") && recoded !== next) {
      next = recoded;
    }
  } catch {
    // Keep the original string when recoding is not possible.
  }

  return next.replace(/\uFFFD/g, "");
}

function truncateDetail(text: string): string {
  const cleaned = repairWindowsText(text)
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  if (cleaned.length <= DETAIL_MAX_CHARS) {
    return cleaned;
  }

  return `${cleaned.slice(0, DETAIL_MAX_CHARS).trimEnd()}\n…`;
}

function isNetworkFailure(folded: string): boolean {
  return (
    folded.includes("enotfound") ||
    folded.includes("eai_again") ||
    folded.includes("getaddrinfo") ||
    folded.includes("could not be resolved") ||
    folded.includes("nao pode ser resolvido") ||
    folded.includes("pode ser resolvido") ||
    folded.includes("remote name") ||
    folded.includes("nome remoto") ||
    folded.includes("enetunreach") ||
    folded.includes("econnrefused") ||
    folded.includes("etimedout") ||
    folded.includes("econnreset") ||
    folded.includes("update.electronjs.org")
  );
}

function isDownloadFailure(folded: string): boolean {
  return (
    folded.includes("downloadurl") ||
    folded.includes("download-progress") ||
    folded.includes("err_failed")
  );
}

export function describeUpdateError(
  error: unknown,
  extra?: unknown,
): DescribedUpdateError {
  const raw = rawUpdateErrorText(error, extra);
  const folded = foldForMatch(raw);
  const detail = truncateDetail(raw) || "No extra detail from the updater.";

  if (isNetworkFailure(folded)) {
    return { userMessage: USER_NETWORK, detail };
  }

  if (isDownloadFailure(folded)) {
    return { userMessage: USER_DOWNLOAD, detail };
  }

  return { userMessage: USER_GENERIC, detail };
}
