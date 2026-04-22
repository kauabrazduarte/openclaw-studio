const STORAGE_KEY = "ocs_files_v1";

export type SavedFile = {
  id: string;
  name: string;
  content: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  favorite: boolean;
  agentId?: string;
  source: "upload" | "generated";
};

function readAll(): SavedFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedFile[]) : [];
  } catch {
    return [];
  }
}

function writeAll(files: SavedFile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export function getFiles(): SavedFile[] {
  return readAll();
}

export function saveFile(
  file: Omit<SavedFile, "id" | "createdAt" | "favorite">
): SavedFile {
  const files = readAll();
  const newFile: SavedFile = {
    ...file,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    favorite: false,
  };
  files.push(newFile);
  writeAll(files);
  return newFile;
}

export function deleteFile(id: string): void {
  const files = readAll().filter((f) => f.id !== id);
  writeAll(files);
}

export function toggleFavorite(id: string): void {
  const files = readAll().map((f) =>
    f.id === id ? { ...f, favorite: !f.favorite } : f
  );
  writeAll(files);
}

export function clearFiles(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
