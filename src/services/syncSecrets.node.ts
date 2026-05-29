import fs from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";
import { APP_USER_FOLDER } from "../appSettings.js";

type StoredSecretPayload = {
  encodedValue: string;
  protected: boolean;
};

class SyncSecretsService {
  private getSecretPath(): string {
    const directoryPath = path.join(app.getPath("userData"), APP_USER_FOLDER);
    fs.mkdirSync(directoryPath, { recursive: true });
    return path.join(directoryPath, "nextcloud-sync-secret.json");
  }

  private readPayload(): StoredSecretPayload | null {
    const secretPath = this.getSecretPath();
    if (!fs.existsSync(secretPath)) {
      return null;
    }

    const raw = fs.readFileSync(secretPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredSecretPayload>;
    if (typeof parsed.encodedValue !== "string") {
      throw new Error("Stored sync credentials are invalid.");
    }

    return {
      encodedValue: parsed.encodedValue,
      protected: parsed.protected !== false,
    };
  }

  private writePayload(payload: StoredSecretPayload): void {
    const secretPath = this.getSecretPath();
    fs.writeFileSync(secretPath, JSON.stringify(payload), "utf8");
    try {
      fs.chmodSync(secretPath, 0o600);
    } catch (error) {
      console.warn("Failed to protect Nextcloud sync secret file", error);
    }
  }

  getAppPassword(): string | null {
    const payload = this.readPayload();
    if (!payload) {
      return null;
    }

    const encoded = Buffer.from(payload.encodedValue, "base64");
    if (payload.protected) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error(
          "Stored Nextcloud credentials cannot be decrypted on this system.",
        );
      }
      return safeStorage.decryptString(encoded);
    }

    return encoded.toString("utf8");
  }

  setAppPassword(password: string): void {
    const trimmed = String(password ?? "").trim();
    if (!trimmed) {
      this.clearAppPassword();
      return;
    }

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(trimmed);
      this.writePayload({
        encodedValue: encrypted.toString("base64"),
        protected: true,
      });
      return;
    }

    this.writePayload({
      encodedValue: Buffer.from(trimmed, "utf8").toString("base64"),
      protected: false,
    });
  }

  clearAppPassword(): void {
    fs.rmSync(this.getSecretPath(), { force: true });
  }
}

export const syncSecrets = new SyncSecretsService();
