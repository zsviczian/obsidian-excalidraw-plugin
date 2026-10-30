/** Cross-repository application-session exclusion. A lock is not a vault lock. */
import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hostname, tmpdir } from "node:os";

export function acquireHostLock({ userDataPath, directory = join(tmpdir(), "excalidraw-native-host-locks"), pid = process.pid,
  alive = candidate => { try { process.kill(candidate, 0); return true; } catch (error) { if (error.code === "ESRCH") return false; return true; } },
} = {}) {
  if (!userDataPath || !existsSync(userDataPath)) throw Error("Explicit existing application user-data identity required");
  const identity = realpathSync(userDataPath), token = randomUUID();
  const digest = createHash("sha256").update(process.platform === "win32" ? identity.toLowerCase() : identity).digest("hex");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, digest + ".json");
  const recoveryPath = path + ".recovery";
  let fd;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (existsSync(recoveryPath)) throw Error("Native host lock recovery is in progress");
    try { fd = openSync(path, "wx"); break; } catch (error) {
      if (error.code !== "EEXIST") throw error;
      // Serialize recovery too: two observers of a dead PID must not remove a new owner.
      let recovery;
      try { recovery = openSync(recoveryPath, "wx"); } catch { throw Error("Native host lock recovery is in progress"); }
      try {
        let owner; try { owner = JSON.parse(readFileSync(path, "utf8")); } catch { throw Error("Unverifiable host lock; manual recovery required"); }
        if (owner.hostname !== hostname() || !Number.isInteger(owner.pid) || owner.pid <= 0 || alive(owner.pid)) throw Error(`Native host is controlled by PID ${owner.pid}`);
        if (readFileSync(path, "utf8") !== JSON.stringify(owner)) throw Error("Host lock changed during recovery");
        rmSync(path);
      } finally { closeSync(recovery); rmSync(recoveryPath); }
    }
  }
  if (fd === undefined) throw Error("Could not acquire native host lock");
  const value = JSON.stringify({ token, pid, hostname: hostname(), identity });
  try { writeFileSync(fd, value); } finally { closeSync(fd); }
  let released = false;
  return { path, identity, release() {
    if (released) return;
    if (readFileSync(path, "utf8") !== value) throw Error("Native host lock ownership changed");
    rmSync(path); released = true;
  } };
}
