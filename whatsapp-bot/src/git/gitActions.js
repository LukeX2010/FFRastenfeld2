import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ALLOWED_STAGE_PATTERNS = [
  "wwwroot/data/posts.json",
  "wwwroot/data/backups/",
  "wwwroot/img/posts/",
  "wwwroot/img/Bearbeiten/Entwurf/",
  "Services/DataService.cs",
  "Program.cs",
  "Models/",
  "Pages/",
  "Shared/",
  "Layout/",
  "wwwroot/css/",
  "wwwroot/js/",
  "wwwroot/favicon",
  "wwwroot/appsettings.json"
];

const BLOCKED_STAGE_PATTERNS = [
  ".env",
  ".idea/",
  "bin/",
  "obj/",
  "auth_info_baileys",
  "logs/",
  "node_modules/",
  "whatsapp-bot/.env",
  "whatsapp-bot/auth_info",
  "whatsapp-bot/logs/"
];

export async function getGitStatus({ cwd }) {
  const remote = await git(["remote", "get-url", "origin"], cwd).catch((error) => ({ stdout: "", stderr: error.message }));
  const branch = await git(["branch", "--show-current"], cwd).catch(() => ({ stdout: "" }));
  const status = await git(["status", "--short"], cwd);
  const files = parseStatus(status.stdout);
  const allowed = files.filter((file) => canStage(file.path));
  const blocked = files.filter((file) => !canStage(file.path));

  return {
    remote: remote.stdout.trim(),
    branch: branch.stdout.trim(),
    files,
    allowed,
    blocked
  };
}

export async function createCommit({ cwd, message }) {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) {
    return { ok: false, reason: "Commit-Nachricht fehlt. Beispiel: COMMIT: Bericht Ottensteiner Seelauf 2026" };
  }

  const status = await getGitStatus({ cwd });
  if (status.allowed.length === 0) {
    return { ok: false, reason: "Keine erlaubten Dateien zum Commit gefunden.", status };
  }

  await git(["add", "--", ...status.allowed.map((file) => file.path)], cwd);
  const staged = await git(["diff", "--cached", "--name-status"], cwd);
  if (!staged.stdout.trim()) {
    return { ok: false, reason: "Nach git add gibt es keine gestagten Änderungen.", status };
  }

  const commit = await git(["commit", "-m", cleanMessage], cwd);
  const head = await git(["rev-parse", "--short", "HEAD"], cwd);
  return {
    ok: true,
    message: cleanMessage,
    commit: head.stdout.trim(),
    staged: staged.stdout.trim().split(/\r?\n/).filter(Boolean),
    blocked: status.blocked,
    output: commit.stdout.trim()
  };
}

export async function pushToOrigin({ cwd }) {
  const branch = (await git(["branch", "--show-current"], cwd)).stdout.trim();
  if (!branch) {
    return { ok: false, reason: "Kein aktueller Git-Branch erkannt." };
  }

  const result = await git(["push", "origin", branch], cwd, 120000);
  return {
    ok: true,
    branch,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
  };
}

function parseStatus(output) {
  return String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => ({
      code: line.slice(0, 2).trim(),
      path: line.slice(3).replace(/\\/g, "/")
    }));
}

function canStage(filePath) {
  const path = String(filePath || "").replace(/\\/g, "/");
  if (BLOCKED_STAGE_PATTERNS.some((pattern) => path === pattern || path.startsWith(pattern))) return false;
  return ALLOWED_STAGE_PATTERNS.some((pattern) => path === pattern || path.startsWith(pattern));
}

async function git(args, cwd, timeout = 60000) {
  try {
    return await execFileAsync("git", args, {
      cwd,
      timeout,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "never"
      },
      maxBuffer: 1024 * 1024 * 5
    });
  } catch (error) {
    const message = [
      error.stdout,
      error.stderr,
      error.message
    ].filter(Boolean).join("\n").trim();
    throw new Error(message || `git ${args.join(" ")} fehlgeschlagen`);
  }
}
