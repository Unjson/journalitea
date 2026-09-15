import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const keystorePath = resolve("android/app/journalitea-release.jks");

if (existsSync(keystorePath)) {
  console.error(`Keystore already exists: ${keystorePath}`);
  process.exitCode = 1;
} else {
  const result = spawnSync(
    "keytool",
    [
      "-genkeypair",
      "-keystore",
      keystorePath,
      "-alias",
      "journalitea",
      "-keyalg",
      "RSA",
      "-keysize",
      "4096",
      "-validity",
      "10000",
      "-storetype",
      "JKS",
    ],
    { stdio: "inherit" },
  );

  if (result.error) {
    console.error(`Could not run keytool: ${result.error.message}`);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}