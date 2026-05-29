import { Capacitor, registerPlugin } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { FileTransfer } from "@capacitor/file-transfer";
import { Filesystem, Encoding, Directory } from "@capacitor/filesystem";
import { parseTranslationsFromCSVContent } from "./i18n/csvParser";
import translationsCsv from "./i18n/translations.csv?raw";
import { capacitorDb } from "./capacitorDatabase";
import { markSyncDataDirty, SYNC_SECRET_STORAGE_KEY } from "./syncConfig";
import type {
  SyncDownloadRequest,
  SyncFileTransferResponse,
  SyncHttpRequest,
  SyncHttpResponse,
  SyncUploadRequest,
} from "./syncTypes";

export type BridgeListener = (...args: any[]) => void;
export type BackButtonListener = (event: { canGoBack: boolean }) => void;

type InvokeResult = Promise<any>;

type JournaliteaHttpPlugin = {
  request(options: SyncHttpRequest): Promise<SyncHttpResponse>;
};

const shouldMarkDatabaseDirty = (channel: string, result: any): boolean => {
  switch (channel) {
    case "db:saveRecord":
    case "db:updateRecord":
    case "db:deleteRecord":
    case "db:setSetting":
      return true;
    case "db:importDatabase":
      return result?.success === true;
    default:
      return false;
  }
};

const withDirtyTracking = async (
  channel: string,
  operation: InvokeResult,
): InvokeResult => {
  const result = await operation;
  if (shouldMarkDatabaseDirty(channel, result)) {
    markSyncDataDirty();
  }
  return result;
};

type ElectronIpc = {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, listener: BridgeListener) => void;
};

const isElectron =
  typeof window !== "undefined" &&
  typeof (window as any).require === "function" &&
  !!(window as any).process?.type;

const electronIpc: ElectronIpc | null = (() => {
  if (!isElectron) return null;
  const electron = (window as any).require("electron");
  return electron?.ipcRenderer ?? null;
})();

const isCapacitor = Capacitor.isNativePlatform();
const isAndroid = Capacitor.getPlatform() === "android";
const journaliteaHttp =
  registerPlugin<JournaliteaHttpPlugin>("JournaliteaHttp");

const isJsonFile = (pathOrName: string | null | undefined): boolean =>
  !!pathOrName && pathOrName.toLowerCase().endsWith(".json");

const isDbFile = (pathOrName: string | null | undefined): boolean =>
  !!pathOrName && /(\.db|\.db3|\.sqlite|\.sqlite3)$/i.test(pathOrName);

const copyFileWithPicker = async (
  from: string,
  to: string,
  overwrite = true,
): Promise<void> => {
  const picker = FilePicker as unknown as {
    copyFile?: (options: {
      from: string;
      to: string;
      overwrite?: boolean;
    }) => Promise<void>;
  };
  if (typeof picker.copyFile !== "function") {
    throw new Error("File copy is not supported on this device.");
  }
  await picker.copyFile({ from, to, overwrite });
};

const decodeBase64 = (base64: string): string => {
  try {
    if (typeof atob === "function") {
      return decodeURIComponent(
        Array.prototype.map
          .call(
            atob(base64),
            (c: string) =>
              `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`,
          )
          .join(""),
      );
    }
  } catch (error) {
    console.warn("Failed to decode base64 data", error);
  }
  return base64;
};

const getStoredSyncSecret = (): string | null => {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined"
  ) {
    return null;
  }

  const value = window.localStorage.getItem(SYNC_SECRET_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
};

const setStoredSyncSecret = (value: string): boolean => {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined"
  ) {
    return false;
  }

  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    window.localStorage.removeItem(SYNC_SECRET_STORAGE_KEY);
    return true;
  }

  window.localStorage.setItem(SYNC_SECRET_STORAGE_KEY, trimmed);
  return true;
};

const toNormalizedHttpResponse = (response: any): SyncHttpResponse => ({
  status: Number(response?.status ?? 0),
  ok:
    response?.ok === true ||
    (Number(response?.status ?? 0) >= 200 &&
      Number(response?.status ?? 0) < 300),
  headers:
    typeof response?.headers === "object" && response.headers !== null
      ? response.headers
      : {},
  data:
    typeof response?.data === "string"
      ? response.data
      : JSON.stringify(response?.data ?? ""),
});

const createCacheFileUri = async (fileName: string): Promise<string> => {
  const uriResult = await Filesystem.getUri({
    path: fileName,
    directory: Directory.Cache,
  });
  return uriResult.uri;
};

const handleCapacitorInvoke = async (
  channel: string,
  ...args: any[]
): InvokeResult => {
  switch (channel) {
    case "app:openExternal": {
      const url = String(args[0] ?? "").trim();
      if (!/^https?:\/\//i.test(url)) {
        throw new Error("Invalid URL");
      }
      await Browser.open({ url });
      return true;
    }
    case "db:listRecords":
      return capacitorDb.listRecords(args[0] ?? null);
    case "db:listRecordsPage":
      return capacitorDb.listRecordsPage(args[0]);
    case "db:listRecordYears":
      return capacitorDb.listRecordYears();
    case "db:getRecordCount":
      return capacitorDb.getRecordCount();
    case "db:getRecordById":
      return capacitorDb.getRecordById(args[0]);
    case "db:saveRecord":
      return capacitorDb.saveRecord(args[0]);
    case "db:updateRecord":
      return capacitorDb.updateRecord(args[0]);
    case "db:deleteRecord":
      return capacitorDb.deleteRecord(args[0]);
    case "db:getSetting":
      return capacitorDb.getSettingsValue(args[0]);
    case "db:setSetting":
      return capacitorDb.setSettingsValue(
        args[0],
        args[1] ?? null,
        args[2] ?? null,
      );
    case "db:exportDatabase": {
      if (!isAndroid) return { cancelled: true };
      return capacitorDb.exportDatabaseToDocuments();
    }
    case "db:pickDatabaseFile": {
      if (!isAndroid) return { cancelled: true };
      const result = await FilePicker.pickFiles({
        types: [
          "application/octet-stream",
          "application/x-sqlite3",
          "application/json",
          "application/vnd.sqlite3",
        ],
        limit: 1,
        readData: false,
      });
      const file = result.files?.[0];
      if (!file) return { cancelled: true };
      return {
        path: file.path ?? (file as any).uri ?? null,
        data: file.data ?? null,
        name: file.name ?? null,
        mimeType: file.mimeType ?? null,
      };
    }
    case "db:importDatabase": {
      const payload = args[0] as {
        mode: "append" | "replace";
        sourcePath?: string | null;
        sourceData?: string | null;
        sourceName?: string | null;
      };
      if (!payload) return { cancelled: true };
      if (payload.sourceData) {
        const json = decodeBase64(payload.sourceData);
        await capacitorDb.importDatabaseFromJson(json, payload.mode);
        return {
          success: true,
          mode: payload.mode,
          path: payload.sourcePath ?? null,
        };
      }
      if (!payload.sourcePath) return { cancelled: true };

      const sourceLabel = payload.sourceName ?? payload.sourcePath;

      if (isJsonFile(sourceLabel)) {
        const file = await Filesystem.readFile({
          path: payload.sourcePath,
          encoding: Encoding.UTF8,
        });
        const jsonContent =
          typeof file.data === "string" ? file.data : await file.data.text();
        await capacitorDb.importDatabaseFromJson(jsonContent, payload.mode);
        return {
          success: true,
          mode: payload.mode,
          path: payload.sourcePath,
        };
      }

      if (payload.mode === "append") {
        throw new Error(
          "Append import is only supported for JSON exports on Android.",
        );
      }

      if (!isDbFile(sourceLabel)) {
        throw new Error("Unsupported import file type.");
      }

      const targetUrl = await capacitorDb.getDatabaseUrl();
      await capacitorDb.closeConnection();
      await copyFileWithPicker(payload.sourcePath, targetUrl, true);
      return {
        success: true,
        mode: payload.mode,
        path: payload.sourcePath,
      };
    }
    case "i18n:loadTranslations":
      return parseTranslationsFromCSVContent(translationsCsv);
    case "app:getVersion":
      const appInfo = await CapacitorApp.getInfo();
      return appInfo.version;
    case "sync:getSecret":
      return getStoredSyncSecret();
    case "sync:setSecret":
      return setStoredSyncSecret(String(args[0] ?? ""));
    case "sync:clearSecret":
      return setStoredSyncSecret("");
    case "sync:httpRequest": {
      const payload = (args[0] ?? {}) as SyncHttpRequest;
      const response = await journaliteaHttp.request({
        url: payload.url,
        method: payload.method ?? "GET",
        headers: payload.headers,
        body: payload.body,
        responseType: payload.responseType ?? "text",
      });
      return toNormalizedHttpResponse(response);
    }
    case "sync:createDatabaseSnapshot":
      return { path: await capacitorDb.createSyncSnapshot() };
    case "sync:replaceDatabaseFromFile":
      return capacitorDb.replaceDatabaseFromPath(String(args[0] ?? ""));
    case "sync:uploadFile": {
      const payload = (args[0] ?? {}) as SyncUploadRequest;
      const result = await FileTransfer.uploadFile({
        url: payload.url,
        path: payload.sourcePath,
        method: payload.method ?? "PUT",
        headers: payload.headers,
        chunkedMode: false,
        progress: false,
      });
      const status = Number(result.responseCode ?? 0);
      const response: SyncFileTransferResponse = {
        status,
        ok: status >= 200 && status < 300,
        headers: result.headers ?? {},
        data: result.response ?? "",
        path: null,
      };
      return response;
    }
    case "sync:downloadFile": {
      const payload = (args[0] ?? {}) as SyncDownloadRequest;
      const fileName =
        payload.fileName && payload.fileName.trim().length > 0
          ? payload.fileName.trim()
          : `journalitea-sync-${Date.now()}.db`;
      const fileUri = await createCacheFileUri(fileName);
      const result = await FileTransfer.downloadFile({
        url: payload.url,
        path: fileUri,
        method: payload.method ?? "GET",
        headers: payload.headers,
        progress: false,
      });
      const response: SyncFileTransferResponse = {
        status: 200,
        ok: true,
        headers: {},
        data: "",
        path: result.path ?? fileUri,
      };
      return response;
    }
    case "sync:deleteFile": {
      await Filesystem.deleteFile({ path: String(args[0] ?? "") });
      return true;
    }
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }
};

export const platformBridge = {
  isElectron,
  isCapacitor,
  isAndroid,
  openExternal(url: string): Promise<boolean> {
    const safeUrl = String(url ?? "").trim();
    if (!/^https?:\/\//i.test(safeUrl)) {
      return Promise.reject(new Error("Invalid URL"));
    }
    if (electronIpc) {
      return electronIpc.invoke("app:openExternal", safeUrl);
    }
    if (isCapacitor) {
      return handleCapacitorInvoke("app:openExternal", safeUrl);
    }
    if (typeof window !== "undefined") {
      window.open(safeUrl, "_blank", "noopener,noreferrer");
      return Promise.resolve(true);
    }
    return Promise.reject(new Error("Unsupported platform"));
  },
  onBackButton(listener: BackButtonListener) {
    if (!isCapacitor || !isAndroid) return undefined;
    return CapacitorApp.addListener("backButton", (event) => {
      listener(event);
    });
  },
  on(channel: string, listener: BridgeListener): void {
    if (electronIpc) {
      electronIpc.on(channel, listener);
    }
  },
  invoke(channel: string, ...args: any[]): InvokeResult {
    if (electronIpc) {
      return withDirtyTracking(channel, electronIpc.invoke(channel, ...args));
    }
    if (isCapacitor) {
      return withDirtyTracking(
        channel,
        handleCapacitorInvoke(channel, ...args),
      );
    }
    return Promise.reject(
      new Error(`Unsupported platform for channel: ${channel}`),
    );
  },
};
