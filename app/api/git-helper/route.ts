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
  const logs: string[] = [];
  try {
    logs.push("=== 1. GIT STATUS BEFORE ===");
    const { stdout: s0 } = await execAsync("git status --short", { cwd: process.cwd() });
    logs.push(s0);

    logs.push("=== 2. GIT ADD . ===");
    const { stdout: s1 } = await execAsync("git add .", { cwd: process.cwd() });
    logs.push(s1 || "git add done");

    logs.push("=== 3. GIT COMMIT ===");
    try {
      const { stdout: s2, stderr: e2 } = await execAsync(
        'git commit -m "fix(ts): fix EDGE_PATH, cheerio unwrap and parameter types for clean build"',
        { cwd: process.cwd(), env: GIT_ENV }
      );
      logs.push(s2 || e2);
    } catch (cErr: any) {
      logs.push("Commit result: " + (cErr.stdout || cErr.stderr || cErr.message));
    }

    logs.push("=== 4. GIT PUSH ===");
    try {
      const { stdout: s3, stderr: e3 } = await execAsync("git push origin main", {
        cwd: process.cwd(),
        timeout: 40000,
        env: GIT_ENV,
      });
      logs.push("PUSH SUCCESS:\n" + (s3 || e3));
      return NextResponse.json({ success: true, logs });
    } catch (pErr: any) {
      const out = pErr.stderr || pErr.stdout || pErr.message;
      logs.push("PUSH OUTPUT:\n" + out);
      return NextResponse.json({ success: false, logs, pushError: out });
    }
  } catch (err: any) {
    logs.push("Error: " + err.message);
    return NextResponse.json({ success: false, logs, error: err.message }, { status: 500 });
  }
}
