export const PHOTO_ROOT_FOLDER = "photos";
export const PHOTO_STAGING_FOLDER = "_staging";
export const PHOTO_ARCHIVE_SUFFIX = "_photos.zip";
export const PHOTO_PREVIEW_PROTOCOL = "journalitea-photo";

export const normalizePhotoRelativePath = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

export const buildPhotoPreviewUrl = (photoPath: string): string => {
  const normalized = normalizePhotoRelativePath(photoPath);
  if (!normalized) {
    return "";
  }

  const encodedPath = normalized.split("/").map(encodeURIComponent).join("/");
  return `${PHOTO_PREVIEW_PROTOCOL}://local/${encodedPath}`;
};

export const isManagedPhotoPath = (value: unknown): boolean => {
  const normalized = normalizePhotoRelativePath(value);
  return (
    normalized === PHOTO_ROOT_FOLDER ||
    normalized.startsWith(`${PHOTO_ROOT_FOLDER}/`)
  );
};

export const isStagedPhotoPath = (value: unknown): boolean => {
  const normalized = normalizePhotoRelativePath(value);
  return normalized.startsWith(`${PHOTO_ROOT_FOLDER}/${PHOTO_STAGING_FOLDER}/`);
};

export const buildRecordPhotoDirectory = (recordId: number): string =>
  `${PHOTO_ROOT_FOLDER}/${Math.max(0, Math.round(recordId))}`;

export const buildStagedPhotoDirectory = (token: string): string =>
  `${PHOTO_ROOT_FOLDER}/${PHOTO_STAGING_FOLDER}/${token.trim()}`;

const sanitizeSegment = (value: string): string =>
  value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

export const splitPhotoFileName = (
  value: string,
  fallbackExtension = ".jpg",
): { baseName: string; extension: string } => {
  const normalized = value.trim().replace(/\\/g, "/");
  const leafName = normalized.split("/").pop() || "photo";
  const extensionMatch = leafName.match(/(\.[a-z0-9]+)$/i);
  const extension =
    extensionMatch && /^\.[a-z0-9]+$/i.test(extensionMatch[1])
      ? extensionMatch[1].toLowerCase()
      : fallbackExtension;
  const baseName =
    sanitizeSegment(
      extensionMatch ? leafName.slice(0, -extension.length) : leafName,
    ) || "photo";
  return {
    baseName,
    extension,
  };
};

export const createTimestampPhotoFileName = (
  sourceName: string,
  fallbackExtension = ".jpg",
): string => {
  const { baseName, extension } = splitPhotoFileName(
    sourceName,
    fallbackExtension,
  );
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
  return `${timestamp}-${baseName}${extension}`;
};

export const buildSiblingPhotoArchivePath = (databasePath: string): string => {
  const normalized = databasePath.replace(/\\/g, "/");
  const separator = databasePath.includes("\\") ? "\\" : "/";
  const lastSlash = normalized.lastIndexOf("/");
  const directory = lastSlash >= 0 ? normalized.slice(0, lastSlash + 1) : "";
  const fileName =
    lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  const lastDot = fileName.lastIndexOf(".");
  const baseName = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return `${directory}${baseName}${PHOTO_ARCHIVE_SUFFIX}`.replace(
    /\//g,
    separator,
  );
};

export const toPlatformPath = (relativePath: string): string =>
  normalizePhotoRelativePath(relativePath).split("/").join("/");

export const replacePhotoRecordId = (
  photoPath: string,
  targetRecordId: number,
): string => {
  const normalized = normalizePhotoRelativePath(photoPath);
  const parts = normalized.split("/");
  if (parts.length < 3 || parts[0] !== PHOTO_ROOT_FOLDER) {
    return normalized;
  }

  return [PHOTO_ROOT_FOLDER, String(targetRecordId), ...parts.slice(2)].join(
    "/",
  );
};

export const getRecordIdFromPhotoPath = (photoPath: string): number | null => {
  const normalized = normalizePhotoRelativePath(photoPath);
  const parts = normalized.split("/");
  if (parts.length < 3 || parts[0] !== PHOTO_ROOT_FOLDER) {
    return null;
  }

  const recordId = Number(parts[1]);
  return Number.isFinite(recordId) ? recordId : null;
};
