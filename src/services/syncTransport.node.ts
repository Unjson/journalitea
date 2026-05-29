import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import db from "./database.js";
import type {
  SyncDownloadRequest,
  SyncFileTransferResponse,
  SyncHttpRequest,
  SyncHttpResponse,
  SyncUploadRequest,
} from "./syncTypes.js";

class SyncTransportService {
  private getTempDirectory(): string {
    const directoryPath = path.join(app.getPath("temp"), "journalitea-sync");
    fs.mkdirSync(directoryPath, { recursive: true });
    return directoryPath;
  }

  private headersToObject(headers: Headers): Record<string, string> {
    const values: Record<string, string> = {};
    headers.forEach((value, key) => {
      values[key.toLowerCase()] = value;
    });
    return values;
  }

  private buildTempFilePath(fileName: string): string {
    const safeName = path
      .basename(fileName)
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-");
    return path.join(this.getTempDirectory(), `${Date.now()}-${safeName}`);
  }

  async request(options: SyncHttpRequest): Promise<SyncHttpResponse> {
    const response = await fetch(options.url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
    });

    return {
      status: response.status,
      ok: response.ok,
      headers: this.headersToObject(response.headers),
      data: await response.text(),
    };
  }

  createDatabaseSnapshot(): { path: string } {
    const snapshotPath = this.buildTempFilePath("database.db");
    db.exportDatabase(snapshotPath);
    return { path: snapshotPath };
  }

  replaceDatabaseFromFile(sourcePath: string): boolean {
    db.importDatabase(sourcePath);
    return true;
  }

  async uploadFile(
    options: SyncUploadRequest,
  ): Promise<SyncFileTransferResponse> {
    const response = await fetch(options.url, {
      method: options.method ?? "PUT",
      headers: options.headers,
      body: fs.readFileSync(options.sourcePath),
    });

    return {
      status: response.status,
      ok: response.ok,
      headers: this.headersToObject(response.headers),
      data: await response.text(),
      path: null,
    };
  }

  async downloadFile(
    options: SyncDownloadRequest,
  ): Promise<SyncFileTransferResponse> {
    const response = await fetch(options.url, {
      method: options.method ?? "GET",
      headers: options.headers,
    });

    const headers = this.headersToObject(response.headers);
    if (!response.ok) {
      return {
        status: response.status,
        ok: false,
        headers,
        data: await response.text(),
        path: null,
      };
    }

    const filePath = this.buildTempFilePath(options.fileName ?? "database.db");
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    return {
      status: response.status,
      ok: true,
      headers,
      data: "",
      path: filePath,
    };
  }

  deleteFile(filePath: string): boolean {
    fs.rmSync(filePath, { force: true });
    return true;
  }
}

export const syncTransport = new SyncTransportService();
