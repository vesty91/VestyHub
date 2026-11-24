import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROCESS_SAMPLE_TTL_MS = 30_000;
const PROCESS_SAMPLE_LIMIT = 5;

export interface LocalProcess {
  pid: number;
  name: string;
  memoryBytes: number;
}

export interface LocalProcessSnapshot {
  sampledAt: string;
  processes: LocalProcess[];
}

const TASKLIST_ROW = /^"((?:[^"]|"")*)","(\d+)","(?:[^"]|"")*","(?:[^"]|"")*","([^"]*)"$/;

export function parseTasklist(output: string): LocalProcess[] {
  const processes: LocalProcess[] = [];

  for (const line of output.split(/\r?\n/)) {
    const columns = line.trim().match(TASKLIST_ROW);
    if (!columns) continue;

    const name = columns[1].replace(/""/g, '"').trim();
    const pid = Number(columns[2]);
    // tasklist reports the working set in localized KB (e.g. "2 333 364 Ko").
    const memoryKb = Number(columns[3].replace(/[^0-9]/g, ""));
    if (
      !name ||
      name.length > 128 ||
      !Number.isSafeInteger(pid) ||
      pid <= 0 ||
      !Number.isSafeInteger(memoryKb) ||
      memoryKb <= 0
    ) {
      continue;
    }

    const memoryBytes = memoryKb * 1024;
    if (!Number.isSafeInteger(memoryBytes)) continue;
    processes.push({ pid, name, memoryBytes });
  }

  return processes
    .sort((left, right) => right.memoryBytes - left.memoryBytes || left.pid - right.pid)
    .slice(0, PROCESS_SAMPLE_LIMIT);
}

let snapshot: { time: number; data: LocalProcessSnapshot } | null = null;
let pending: Promise<LocalProcessSnapshot> | null = null;

export async function getLocalProcesses(): Promise<LocalProcessSnapshot> {
  if (snapshot && Date.now() - snapshot.time < PROCESS_SAMPLE_TTL_MS) {
    return snapshot.data;
  }
  if (pending) return pending;

  pending = (async () => {
    // Fixed executable and fixed flags: no shell or user-provided arguments.
    const { stdout } = await execFileAsync("tasklist.exe", ["/FO", "CSV", "/NH"], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });

    const data = {
      sampledAt: new Date().toISOString(),
      processes: parseTasklist(stdout),
    };
    snapshot = { time: Date.now(), data };
    return data;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}
