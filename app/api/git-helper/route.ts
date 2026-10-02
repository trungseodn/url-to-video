import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET() {
  const logs: string[] = [];
  try {
    logs.push("=== 1. GIT STATUS ===");
    const { stdout: s1, stderr: e1 } = await execAsync("git status", { cwd: process.cwd() });
    logs.push(s1 || e1);

    logs.push("=== 2. GIT REMOTE ===");
    const { stdout: s2 } = await execAsync("git remote -v", { cwd: process.cwd() });
    logs.push(s2);

    logs.push("=== 3. GIT ADD ===");
    const { stdout: s3 } = await execAsync("git add .", { cwd: process.cwd() });
    logs.push(s3 || "git add . done");

    logs.push("=== 4. GIT COMMIT ===");
    try {
      const { stdout: s4, stderr: e4 } = await execAsync(
        'git commit -m "feat: complete url-to-video studio, image paste, font zoom and vps deployment setup"',
        { cwd: process.cwd() }
      );
      logs.push(s4 || e4);
    } catch (commitErr: any) {
      logs.push("Commit note: " + (commitErr.stdout || commitErr.message));
    }

    logs.push("=== 5. GIT BRANCH -M MAIN ===");
    try {
      const { stdout: s5 } = await execAsync("git branch -M main", { cwd: process.cwd() });
      logs.push(s5 || "branch set to main");
    } catch (bErr: any) {
      logs.push("Branch note: " + bErr.message);
    }

    logs.push("=== 6. GIT PUSH ===");
    try {
      const { stdout: s6, stderr: e6 } = await execAsync("git push -u origin main", {
        cwd: process.cwd(),
        timeout: 20000,
      });
      logs.push("Push SUCCESS:");
      logs.push(s6 || e6);
      return NextResponse.json({ success: true, logs });
    } catch (pushErr: any) {
      logs.push("Push FAILED / PENDING AUTH:");
      logs.push(pushErr.stderr || pushErr.stdout || pushErr.message);
      return NextResponse.json({ success: false, logs, pushError: pushErr.message });
    }
  } catch (err: any) {
    logs.push("Fatal error: " + err.message);
    return NextResponse.json({ success: false, logs, error: err.message }, { status: 500 });
  }
}
