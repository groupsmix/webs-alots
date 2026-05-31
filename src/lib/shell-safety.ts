/**
 * A62-E3: Shell Command Validation and Injection Prevention
 *
 * Problem:
 *   Backup and data-retention cron jobs may use child_process.exec() or spawn()
 *   to run system commands (pg_dump, tar, mysqldump, etc.). Without validation:
 *   - Arguments containing shell metacharacters (`;`, `|`, `$()`, etc.) can inject
 *     arbitrary commands: e.g., `pg_dump /path/to/db; rm -rf /`
 *   - Unbounded command execution can hang the process or exhaust resources
 *
 * Solution:
 *   - Whitelist allowed commands (pg_dump, mysqldump, tar, rsync, etc.)
 *   - Validate arguments for shell metacharacters before execution
 *   - Use execFile() instead of exec() to avoid shell interpretation
 *   - Enforce timeouts and output size limits
 */

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Whitelist of allowed commands and their canonical paths.
 * Only commands in this map can be executed.
 */
export const SAFE_SHELL_COMMANDS: Record<string, string> = {
  pg_dump: "/usr/bin/pg_dump",
  mysqldump: "/usr/bin/mysqldump",
  tar: "/bin/tar",
  rsync: "/usr/bin/rsync",
  gzip: "/bin/gzip",
  gunzip: "/bin/gunzip",
};

/**
 * Pattern of shell metacharacters that should never appear in arguments.
 * If matched, the argument is rejected.
 */
const SHELL_METACHARACTERS = /[;&|`$(){}<>\n]/;

/**
 * Safe shell command execution with validation and limits.
 *
 * @param command Command name (must be in SAFE_SHELL_COMMANDS whitelist)
 * @param args Arguments to pass (each checked for shell metacharacters)
 * @param options Timeout and output size limits
 * @returns Promise<{stdout, stderr}> with command output
 * @throws Error if command is not whitelisted or args contain metacharacters
 */
export async function safeExecCommand(
  command: string,
  args: string[],
  options?: { timeoutMs?: number; maxOutputBytes?: number },
): Promise<{ stdout: string; stderr: string }> {
  // Validate command is whitelisted
  if (!(command in SAFE_SHELL_COMMANDS)) {
    throw new Error(
      `Command not whitelisted: ${command}. Allowed: ${Object.keys(SAFE_SHELL_COMMANDS).join(", ")}`,
    );
  }

  // Validate each argument for shell metacharacters
  for (const arg of args) {
    if (SHELL_METACHARACTERS.test(arg)) {
      throw new Error(
        `Argument contains shell metacharacters: ${arg}. ` +
          `Characters not allowed: ; & | \` $ ( ) { } < > newline`,
      );
    }
  }

  const commandPath = SAFE_SHELL_COMMANDS[command];
  const timeoutMs = options?.timeoutMs ?? 60_000; // 60 seconds default
  const maxOutputBytes = options?.maxOutputBytes ?? 100 * 1024 * 1024; // 100 MB default

  try {
    const result = await execFileAsync(commandPath, args, {
      timeout: timeoutMs,
      maxBuffer: maxOutputBytes,
      // Do not spawn a shell — use execFile directly
      shell: false,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (err) {
    // Re-throw with context
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${errorMsg}`);
  }
}

/**
 * Example: How to use in a backup cron.
 *
 * ```ts
 * import { safeExecCommand } from "@/lib/shell-safety";
 *
 * export async function backupDatabase(dbName: string, outputPath: string) {
 *   try {
 *     const result = await safeExecCommand("pg_dump", [dbName, "-f", outputPath], {
 *       timeoutMs: 300_000, // 5 minutes
 *       maxOutputBytes: 1024 * 1024 * 1024, // 1 GB
 *     });
 *     console.log("Backup succeeded", { stderr: result.stderr });
 *   } catch (err) {
 *     console.error("Backup failed", { error: err });
 *     throw err;
 *   }
 * }
 * ```
 */
