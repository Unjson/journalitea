export type RecordPhotoEntry = {
  path: string;
};

const normalizePhotoPath = (value: unknown): string => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\\/g, "/");
  return normalized.replace(/^\/+/, "");
};

const toEntry = (value: unknown): RecordPhotoEntry | null => {
  if (typeof value === "string") {
    const path = normalizePhotoPath(value);
    return path ? { path } : null;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const path = normalizePhotoPath((value as { path?: unknown }).path);
  return path ? { path } : null;
};

const dedupeEntries = (
  entries: readonly RecordPhotoEntry[],
): RecordPhotoEntry[] => {
  const seen = new Set<string>();
  const normalizedEntries: RecordPhotoEntry[] = [];

  for (const entry of entries) {
    const path = normalizePhotoPath(entry.path);
    if (!path || seen.has(path)) {
      continue;
    }

    seen.add(path);
    normalizedEntries.push({ path });
  }

  return normalizedEntries;
};

export const parseRecordPhotos = (raw: unknown): RecordPhotoEntry[] => {
  if (typeof raw !== "string") {
    return [];
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    return dedupeEntries(
      [toEntry(trimmed)].filter((entry): entry is RecordPhotoEntry => !!entry),
    );
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return dedupeEntries(
        parsed
          .map((entry) => toEntry(entry))
          .filter((entry): entry is RecordPhotoEntry => !!entry),
      );
    }

    const entry = toEntry(parsed);
    return entry ? [entry] : [];
  } catch {
    return dedupeEntries(
      [toEntry(trimmed)].filter((entry): entry is RecordPhotoEntry => !!entry),
    );
  }
};

export const serializeRecordPhotos = (
  entries: readonly RecordPhotoEntry[],
): string => {
  const normalizedEntries = dedupeEntries(entries);
  if (normalizedEntries.length === 0) {
    return "";
  }

  return JSON.stringify(normalizedEntries);
};

export const getPrimaryRecordPhoto = (raw: unknown): RecordPhotoEntry | null =>
  parseRecordPhotos(raw)[0] ?? null;

export const getPrimaryRecordPhotoPath = (raw: unknown): string =>
  getPrimaryRecordPhoto(raw)?.path ?? "";

export const setPrimaryRecordPhotoPath = (
  raw: unknown,
  nextPath: string | null | undefined,
): string => {
  const normalizedPath = normalizePhotoPath(nextPath);
  if (!normalizedPath) {
    return "";
  }

  const remaining = parseRecordPhotos(raw).slice(1);
  return serializeRecordPhotos([{ path: normalizedPath }, ...remaining]);
};

export const mapRecordPhotoPaths = (
  raw: unknown,
  mapper: (path: string, index: number) => string | null | undefined,
): string => {
  const nextEntries = parseRecordPhotos(raw)
    .map((entry, index) => {
      const nextPath = normalizePhotoPath(mapper(entry.path, index));
      return nextPath ? { path: nextPath } : null;
    })
    .filter((entry): entry is RecordPhotoEntry => !!entry);

  return serializeRecordPhotos(nextEntries);
};
