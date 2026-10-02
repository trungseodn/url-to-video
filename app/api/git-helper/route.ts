import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

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
    // Delete next.config.ts in favor of next.config.mjs
    const oldTsConfig = path.join(process.cwd(), "next.config.ts");
    if (fs.existsSync(oldTsConfig)) {
      fs.unlinkSync(oldTsConfig);
      logs.push("Deleted next.config.ts");
    }

    logs.push("=== 1. GIT ADD . ===");
    const { stdout: s1 } = await execAsync("git add .", { cwd: process.cwd() });
    logs.push(s1 || "git add done");

    logs.push("=== 2. GIT COMMIT ===");
    try {
      const { stdout: s2, stderr: e2 } = await execAsync(
        'git commit -m "fix: install devDependencies during docker build and use next.config.mjs"',
        { cwd: process.cwd(), env: GIT_ENV }
      );
      logs.push(s2 || e2);
    } catch (cErr: any) {
      logs.push("Commit result: " + (cErr.stdout || cErr.stderr || cErr.message));
    }

    logs.push("=== 3. GIT PUSH ===");
    try {
      const { stdout: s3, stderr: e3 } = await execAsync("git push -u origin main", {
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
