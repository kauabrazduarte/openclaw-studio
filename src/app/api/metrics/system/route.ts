import { NextResponse } from "next/server";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

function cpuUsagePercent(): Promise<number> {
  return new Promise((resolve) => {
    const cpus1 = os.cpus();
    setTimeout(() => {
      const cpus2 = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      for (let i = 0; i < cpus1.length; i++) {
        const t1 = cpus1[i].times;
        const t2 = cpus2[i].times;
        const idle = t2.idle - t1.idle;
        const total =
          (t2.user - t1.user) +
          (t2.nice - t1.nice) +
          (t2.sys - t1.sys) +
          (t2.irq - t1.irq) +
          idle;
        totalIdle += idle;
        totalTick += total;
      }
      const percent = totalTick === 0 ? 0 : 100 - (100 * totalIdle) / totalTick;
      resolve(Math.round(percent * 10) / 10);
    }, 500);
  });
}

async function diskUsage(): Promise<{ used: number; total: number; percent: number; mountpoint: string }> {
  try {
    const { stdout } = await execAsync("df -k / | tail -1");
    const parts = stdout.trim().split(/\s+/);
    // macOS: Filesystem 1K-blocks Used Available Capacity Mounted
    const total = parseInt(parts[1] ?? "0") * 1024;
    const used = parseInt(parts[2] ?? "0") * 1024;
    const percent = total > 0 ? Math.round((used / total) * 100) : 0;
    return { used, total, percent, mountpoint: parts[8] ?? "/" };
  } catch {
    return { used: 0, total: 0, percent: 0, mountpoint: "/" };
  }
}

async function topProcesses(n = 8): Promise<Array<{ name: string; cpu: number; mem: number; pid: number }>> {
  try {
    // ps: pid, %cpu, %mem, comm — sorted by cpu
    const { stdout } = await execAsync(
      "ps aux | sort -rn -k3 | head -9 | awk '{print $2, $3, $4, $11}'"
    );
    return stdout
      .trim()
      .split("\n")
      .slice(0, n)
      .map((line) => {
        const [pid, cpu, mem, ...cmdParts] = line.split(" ");
        const cmd = (cmdParts.join(" ") || "").replace(/.*\//, "").slice(0, 28);
        return {
          pid: parseInt(pid ?? "0"),
          cpu: parseFloat(cpu ?? "0"),
          mem: parseFloat(mem ?? "0"),
          name: cmd || "unknown",
        };
      });
  } catch {
    return [];
  }
}

async function gatewayStatus(): Promise<{ up: boolean; pid?: number }> {
  try {
    const { stdout } = await execAsync("lsof -ti :18789 2>/dev/null || echo ''");
    const pid = parseInt(stdout.trim());
    return { up: !isNaN(pid) && pid > 0, pid: isNaN(pid) ? undefined : pid };
  } catch {
    return { up: false };
  }
}

export async function GET() {
  const [cpu, disk, procs, gw] = await Promise.all([
    cpuUsagePercent(),
    diskUsage(),
    topProcesses(8),
    gatewayStatus(),
  ]);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return NextResponse.json({
    timestamp: Date.now(),
    cpu: {
      percent: cpu,
      cores: os.cpus().length,
      model: os.cpus()[0]?.model ?? "Unknown",
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percent: Math.round((usedMem / totalMem) * 100),
    },
    disk,
    load: os.loadavg(),
    uptime: os.uptime(),
    platform: os.platform(),
    hostname: os.hostname(),
    processes: procs,
    gateway: gw,
  });
}
