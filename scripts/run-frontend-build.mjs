import { spawn } from "node:child_process";

const FRONTEND_BUILD_TIMEOUT_MS = 5 * 60 * 1000;

function timestamp() {
  return new Date().toISOString();
}

function runStep(label, command, args) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(
          `${label} supero el timeout de ${Math.round(FRONTEND_BUILD_TIMEOUT_MS / 1000)}s`
        )
      );
    }, FRONTEND_BUILD_TIMEOUT_MS);

    const heartbeat = setInterval(() => {
      console.log(
        `[build-check] ${timestamp()} ${label} sigue ejecutandose (${Math.round(
          (Date.now() - startedAt) / 1000
        )}s)`
      );
    }, 15000);

    child.on("error", (error) => {
      clearTimeout(timeout);
      clearInterval(heartbeat);
      reject(error);
    });

    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      clearInterval(heartbeat);

      if (code === 0) {
        console.log(
          `[build-check] ${timestamp()} ${label} completado en ${Math.round(
            (Date.now() - startedAt) / 1000
          )}s`
        );
        resolve();
        return;
      }

      reject(
        new Error(
          `${label} finalizo con code=${code ?? "null"} signal=${signal ?? "null"}`
        )
      );
    });
  });
}

async function main() {
  console.log(`[build-check] ${timestamp()} inicio de validacion frontend`);

  await runStep("TypeScript", "npx", ["tsc", "-b", "--pretty", "false"]);
  await runStep("Vite", "node", ["./node_modules/vite/bin/vite.js", "build", "--logLevel", "info"]);

  console.log(`[build-check] ${timestamp()} validacion frontend finalizada`);
}

main().catch((error) => {
  console.error(`[build-check] ${timestamp()} ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
