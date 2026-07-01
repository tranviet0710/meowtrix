"use client";

import * as React from "react";
import { Upload, X, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/validators";

export interface PhotoUploaderProps {
  maxPhotos?: number;
  minPhotos?: number;
  value?: string[];
  onChange: (urls: string[]) => void;
  error?: string;
}

interface UploadingFile {
  id: string;
  file: File;
  preview: string;
  progress: "uploading" | "done" | "error";
  url?: string;
  errorMessage?: string;
}

function validateFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}" is not a valid format. Only JPEG, PNG, and WebP are accepted.`;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `"${file.name}" exceeds the 5MB size limit.`;
  }
  return null;
}

export function PhotoUploader({
  maxPhotos = 5,
  minPhotos = 1,
  value = [],
  onChange,
  error,
}: PhotoUploaderProps) {
  const [uploadingFiles, setUploadingFiles] = React.useState<UploadingFile[]>(
    []
  );
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Keep a ref of the latest photo URLs so parallel uploads can append without
  // racing each other. Every parallel `uploadFile` call would otherwise close
  // over the same `value` snapshot and stomp each other's `onChange` — only
  // the last completion would win, silently dropping earlier uploads.
  const valueRef = React.useRef<string[]>(value);
  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const totalPhotos = value.length + uploadingFiles.filter((f) => f.progress === "uploading").length;
  const canUploadMore = totalPhotos < maxPhotos;

  const uploadFile = React.useCallback(
    async (file: File, id: string) => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Upload failed (${response.status})`
          );
        }

        const data = await response.json();
        const url: string = data.url;

        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, progress: "done", url } : f
          )
        );

        // Append via the ref so concurrent uploads don't overwrite each other.
        const nextValue = [...valueRef.current, url];
        valueRef.current = nextValue;
        onChange(nextValue);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? { ...f, progress: "error", errorMessage: message }
              : f
          )
        );
      }
    },
    [onChange]
  );

  const handleFiles = React.useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const errors: string[] = [];
      const validFiles: { file: File; id: string; preview: string }[] = [];

      const slotsAvailable = maxPhotos - totalPhotos;
      if (fileArray.length > slotsAvailable) {
        errors.push(
          `Too many files. You can upload ${slotsAvailable} more photo${slotsAvailable !== 1 ? "s" : ""}.`
        );
      }

      const filesToProcess = fileArray.slice(0, slotsAvailable);

      for (const file of filesToProcess) {
        const validationError = validateFile(file);
        if (validationError) {
          errors.push(validationError);
        } else {
          validFiles.push({
            file,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            preview: URL.createObjectURL(file),
          });
        }
      }

      setValidationErrors(errors);

      if (validFiles.length > 0) {
        const newUploading: UploadingFile[] = validFiles.map((v) => ({
          id: v.id,
          file: v.file,
          preview: v.preview,
          progress: "uploading" as const,
        }));

        setUploadingFiles((prev) => [...prev, ...newUploading]);

        for (const v of validFiles) {
          uploadFile(v.file, v.id);
        }
      }
    },
    [maxPhotos, totalPhotos, uploadFile]
  );

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (canUploadMore) {
        setIsDragOver(true);
      }
    },
    [canUploadMore]
  );

  const handleDragLeave = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    },
    []
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (!canUploadMore) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [canUploadMore, handleFiles]
  );

  const handleClick = React.useCallback(() => {
    if (canUploadMore) {
      fileInputRef.current?.click();
    }
  }, [canUploadMore]);

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [handleFiles]
  );

  const removeUploadedPhoto = React.useCallback(
    (urlToRemove: string) => {
      onChange(value.filter((url) => url !== urlToRemove));
    },
    [value, onChange]
  );

  const removeUploadingFile = React.useCallback((id: string) => {
    setUploadingFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const retryUpload = React.useCallback(
    (id: string) => {
      const file = uploadingFiles.find((f) => f.id === id);
      if (file) {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, progress: "uploading" as const, errorMessage: undefined } : f
          )
        );
        uploadFile(file.file, id);
      }
    },
    [uploadingFiles, uploadFile]
  );

  // Clean up completed uploads from the uploading list
  React.useEffect(() => {
    const doneFiles = uploadingFiles.filter((f) => f.progress === "done");
    if (doneFiles.length > 0) {
      const timer = setTimeout(() => {
        setUploadingFiles((prev) => {
          const done = prev.filter((f) => f.progress === "done");
          for (const f of done) {
            URL.revokeObjectURL(f.preview);
          }
          return prev.filter((f) => f.progress !== "done");
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [uploadingFiles]);

  const allErrors = [
    ...validationErrors,
    ...(error ? [error] : []),
  ];

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload photos"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-[2px] border-2 border-dashed p-6 transition-all cursor-pointer",
          "bg-card/50 text-text-secondary hover:border-accent/60 hover:bg-card/70",
          isDragOver && "border-accent bg-accent/10 ring-2 ring-accent/30",
          !canUploadMore && "opacity-50 cursor-not-allowed",
          allErrors.length > 0 && "border-danger/60"
        )}
      >
        <Upload className="h-8 w-8 text-secondary" />
        <span className="text-sm font-medium text-text-primary">
          {canUploadMore
            ? "Upload intelligence"
            : "Maximum photos reached"}
        </span>
        <span className="text-xs text-text-secondary">
          Drag & drop or click to select • JPEG, PNG, WebP • Max 5MB
        </span>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Photo counter */}
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-mono",
            value.length < minPhotos ? "text-danger" : "text-text-secondary"
          )}
        >
          {value.length}/{maxPhotos} photos uploaded
        </span>
        {value.length < minPhotos && (
          <span className="text-danger font-mono">
            Min {minPhotos} required
          </span>
        )}
      </div>

      {/* Thumbnails grid - uploaded photos */}
      {(value.length > 0 || uploadingFiles.length > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {/* Completed uploads */}
          {value.map((url, index) => (
            <div
              key={url}
              className="relative group aspect-square rounded-[2px] overflow-hidden border border-border bg-card"
            >
              <img
                src={url}
                alt={`Uploaded cat photo ${index + 1} of ${value.length}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeUploadedPhoto(url);
                }}
                className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-danger/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-success" />
            </div>
          ))}

          {/* Uploading files */}
          {uploadingFiles.map((file) => (
            <div
              key={file.id}
              className="relative aspect-square rounded-[2px] overflow-hidden border border-border bg-card"
            >
              <img
                src={file.preview}
                alt={`Uploading cat photo: ${file.file.name}`}
                className={cn(
                  "h-full w-full object-cover",
                  file.progress === "uploading" && "opacity-60"
                )}
              />

              {/* Progress overlay */}
              {file.progress === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                </div>
              )}

              {/* Error overlay */}
              {file.progress === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70">
                  <AlertCircle className="h-4 w-4 text-danger" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      retryUpload(file.id);
                    }}
                    className="text-[10px] text-accent hover:underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Remove button for error state */}
              {file.progress === "error" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeUploadingFile(file.id);
                  }}
                  className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-danger/90 text-white hover:bg-danger"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              )}

              {/* Progress bar at bottom */}
              {file.progress === "uploading" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-card">
                  <div className="h-full bg-accent animate-pulse w-2/3" />
                </div>
              )}
              {file.progress === "done" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-success" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inline validation errors */}
      {allErrors.length > 0 && (
        <div className="space-y-1">
          {allErrors.map((err, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-xs text-danger"
              role="alert"
            >
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
