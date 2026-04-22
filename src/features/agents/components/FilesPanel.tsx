"use client";

import { useCallback, useRef, useState } from "react";
import { X, Star, Download, Trash2, Paperclip, FileText, Image, Music, Video, Archive } from "lucide-react";
import { getFiles, saveFile, deleteFile, toggleFavorite, type SavedFile } from "@/lib/files/filesStore";

type FilesPanelProps = {
  open: boolean;
  onClose: () => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4 shrink-0 text-white/40" />;
  if (mimeType.startsWith("audio/")) return <Music className="h-4 w-4 shrink-0 text-white/40" />;
  if (mimeType.startsWith("video/")) return <Video className="h-4 w-4 shrink-0 text-white/40" />;
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("gz")) {
    return <Archive className="h-4 w-4 shrink-0 text-white/40" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-white/40" />;
}

function FileRow({
  file,
  onToggleFavorite,
  onDownload,
  onDelete,
}: {
  file: SavedFile;
  onToggleFavorite: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/5"
    >
      <FileIcon mimeType={file.mimeType} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-white/80" title={file.name}>
          {file.name}
        </p>
        <p className="font-mono text-[10px] text-white/30">
          {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          className="ui-btn-icon ui-btn-icon-xs"
          onClick={onToggleFavorite}
          aria-label={file.favorite ? "Unpin" : "Pin"}
          title={file.favorite ? "Unpin" : "Pin"}
        >
          <Star
            className={`h-3.5 w-3.5 ${file.favorite ? "text-yellow-400 fill-yellow-400" : "text-white/40"}`}
          />
        </button>
        <button
          type="button"
          className="ui-btn-icon ui-btn-icon-xs"
          onClick={onDownload}
          aria-label="Download"
          title="Download"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="ui-btn-icon ui-btn-icon-xs"
          onClick={onDelete}
          aria-label="Delete"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-400/70" />
        </button>
      </div>
    </div>
  );
}

export const FilesPanel = ({ open, onClose }: FilesPanelProps) => {
  const [files, setFiles] = useState<SavedFile[]>(() => (open ? getFiles() : []));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(() => {
    setFiles(getFiles());
  }, []);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      toggleFavorite(id);
      refresh();
    },
    [refresh]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteFile(id);
      refresh();
    },
    [refresh]
  );

  const handleDownload = useCallback((file: SavedFile) => {
    try {
      const isBinary = !file.mimeType.startsWith("text/") && !file.mimeType.includes("json");
      const blob = isBinary
        ? (() => {
            const bin = atob(file.content);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return new Blob([bytes], { type: file.mimeType });
          })()
        : new Blob([file.content], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore download errors
    }
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files ?? []);
      if (selectedFiles.length === 0) return;
      const readers = selectedFiles.map((f) => {
        return new Promise<void>((resolve) => {
          const isText = f.type.startsWith("text/") || f.type.includes("json");
          const reader = new FileReader();
          reader.onload = () => {
            const content = typeof reader.result === "string" ? reader.result : "";
            saveFile({
              name: f.name,
              content: isText
                ? content
                : (reader.result as string).split(",")[1] ?? content,
              mimeType: f.type || "application/octet-stream",
              sizeBytes: f.size,
              source: "upload",
            });
            resolve();
          };
          if (isText) {
            reader.readAsText(f);
          } else {
            reader.readAsDataURL(f);
          }
        });
      });
      Promise.all(readers).then(refresh);
      // Reset input so same file can be re-uploaded
      e.target.value = "";
    },
    [refresh]
  );

  if (!open) return null;

  const favorites = files.filter((f) => f.favorite);
  const all = files;

  return (
    <div className="files-panel-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="files-panel-drawer">
        {/* header */}
        <div
          className="flex h-11 shrink-0 items-center justify-between border-b px-4"
          style={{ borderColor: "#27272a" }}
        >
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">
            File Vault
          </span>
          <button
            type="button"
            className="ui-btn-icon ui-btn-icon-xs"
            onClick={onClose}
            aria-label="Close files panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto px-2 py-2">
          {all.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
              <Paperclip className="mb-3 h-8 w-8 text-white/15" />
              <p className="font-mono text-[12px] text-white/30">No files saved yet.</p>
            </div>
          ) : (
            <>
              {favorites.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1 flex items-center gap-2 px-3 py-1">
                    <Star className="h-3 w-3 text-yellow-400/70 fill-yellow-400/70" />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
                      Favorites
                    </span>
                  </div>
                  {favorites.map((file) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      onToggleFavorite={() => handleToggleFavorite(file.id)}
                      onDownload={() => handleDownload(file)}
                      onDelete={() => handleDelete(file.id)}
                    />
                  ))}
                  <div className="mx-3 my-2 border-t" style={{ borderColor: "#27272a" }} />
                </div>
              )}
              <div>
                <div className="mb-1 flex items-center gap-2 px-3 py-1">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
                    All Files
                  </span>
                  <span className="font-mono text-[10px] text-white/25">{all.length}</span>
                </div>
                {all.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onToggleFavorite={() => handleToggleFavorite(file.id)}
                    onDownload={() => handleDownload(file)}
                    onDelete={() => handleDelete(file.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* footer: upload button */}
        <div
          className="shrink-0 border-t p-3"
          style={{ borderColor: "#27272a" }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*/*"
            className="sr-only"
            onChange={handleFileInputChange}
          />
          <button
            type="button"
            className="ui-btn-secondary flex w-full items-center justify-center gap-2 py-2 font-mono text-[12px] font-medium tracking-[0.04em]"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
            Upload file
          </button>
        </div>
      </div>
    </div>
  );
};
