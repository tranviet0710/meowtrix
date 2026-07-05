"use client";

import * as React from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/validators";
import { useClipboardImage } from "@/hooks/useClipboardImage";

/**
 * AiAssistUploadZone — single-file drop / paste / click upload target for the
 * AI-assist modal. Accepts a screenshot via file picker, drag-and-drop, or
 * clipboard paste (while `clipboardEnabled` is true). Runs MIME + size guards
 * client-side and surfaces the exact copy from Requirements 2.4 / 2.5.
 *
 * _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 13.2, 13.3_
 */
export interface AiAssistUploadZoneProps {
  file: File | null;
  onFileSelected: (file: File | null) => void;
  /** Attach the window paste listener only while the parent modal is open. */
  clipboardEnabled: boolean;
  disabled?: boolean;
}

const MIME_REJECTION = "Only JPEG, PNG, or WebP images are supported";
const SIZE_REJECTION = "Screenshot must be 5MB or smaller";

function validate(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return MIME_REJECTION;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return SIZE_REJECTION;
  }
  return null;
}

export function AiAssistUploadZone({
  file,
  onFileSelected,
  clipboardEnabled,
  disabled = false,
}: AiAssistUploadZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [rejection, setRejection] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // Manage preview URL lifecycle — revoke the previous object URL whenever
  // the incoming file changes or the component unmounts.
  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const acceptFile = React.useCallback(
    (candidate: File) => {
      const error = validate(candidate);
      if (error) {
        setRejection(error);
        return;
      }
      setRejection(null);
      onFileSelected(candidate);
    },
    [onFileSelected]
  );

  // Clipboard paste — only listens while enabled (modal open) and not disabled.
  useClipboardImage(clipboardEnabled && !disabled, acceptFile);

  const openPicker = React.useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
    },
    [disabled, openPicker]
  );

  const onInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0];
      if (picked) acceptFile(picked);
      // Reset so the same file can be selected again after rejection.
      event.target.value = "";
    },
    [acceptFile]
  );

  const onDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const onDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
    },
    []
  );

  const onDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      if (disabled) return;
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) acceptFile(dropped);
    },
    [disabled, acceptFile]
  );

  const showPreview = file != null && previewUrl != null;

  return (
    <div className="space-y-2">
      {!showPreview ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload a screenshot: click, drop a file here, or paste from the clipboard"
          aria-disabled={disabled || undefined}
          onClick={openPicker}
          onKeyDown={onKeyDown}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card/60 p-8 text-center transition-all",
            "hover:border-accent/60 hover:bg-card",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isDragOver && "border-accent bg-accent/10 ring-2 ring-accent/40",
            rejection && "border-danger/60",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <Upload className="h-8 w-8 text-accent" aria-hidden="true" />
          <span className="text-sm font-medium text-text-primary">
            Drop a screenshot, click to choose, or paste with Ctrl/Cmd + V
          </span>
          <span className="text-xs text-text-secondary">
            JPEG, PNG, or WebP — up to 5MB
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`Selected screenshot: ${file.name}`}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-medium text-text-primary"
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="text-xs text-text-secondary">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejection(null);
                  onFileSelected(null);
                }}
                disabled={disabled}
                aria-label="Remove selected screenshot"
                className="rounded-md p-1 text-text-secondary transition-colors hover:bg-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className={cn(
                "inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-text-primary transition-colors",
                "hover:bg-muted/70 hover:-translate-y-[1px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:pointer-events-none disabled:opacity-50"
              )}
            >
              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Replace screenshot
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        onChange={onInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
      />

      {rejection && (
        <p
          role="alert"
          className="text-xs text-danger"
        >
          {rejection}
        </p>
      )}
    </div>
  );
}
