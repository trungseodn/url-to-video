import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
export const dynamic = "force-dynamic";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "trungseodn",
  GIT_AUTHOR_EMAIL: "trungseodn@gmail.com",
  GIT_COMMITTER_NAME: "trungseodn",
  GIT_COMMITTER_EMAIL: "trungseodn@gmail.com",
};

export async function GET(req: NextRequest) {
  try {
    const s0 = await execAsync("git status --short", { cwd: process.cwd() });
    const s1 = await execAsync("git add -A", { cwd: process.cwd() });
    const s2 = await execAsync("git status --short", { cwd: process.cwd() });
    let commitMsg = "";
    try {
      const c = await execAsync('git commit -m "fix(ts): fix EDGE_PATH, cheerio unwrap and parameter types"', {
        cwd: process.cwd(),
        env: GIT_ENV,
      });
      commitMsg = c.stdout || c.stderr;
    } catch (e: any) {
      commitMsg = e.stdout || e.stderr || e.message;
    }
    const push = await execAsync("git push origin main", {
      cwd: process.cwd(),
      env: GIT_ENV,
      timeout: 40000,
    });
    return NextResponse.json({
      statusBefore: s0.stdout,
      statusAfterAdd: s2.stdout,
      commit: commitMsg,
      push: push.stdout || push.stderr,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stdout: err.stdout, stderr: err.stderr }, { status: 500 });
  }
}
