"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { agentFormSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhotoUploader } from "@/components/forms/PhotoUploader";

const MapPicker = dynamic(() => import("@/components/map/MapPicker"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[300px] items-center justify-center rounded-[2px] border border-border bg-card"
      role="status"
      aria-label="Loading map"
    >
      <p className="animate-pulse text-sm text-text-secondary">Loading map...</p>
    </div>
  ),
});

interface FieldErrors {
  description?: string;
  location?: string;
  photos?: string;
}

export function SpottedAgentForm() {
  const router = useRouter();

  // Form field state
  const [description, setDescription] = React.useState("");
  const [location, setLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [photos, setPhotos] = React.useState<string[]>([]);

  // UI state
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [submitError, setSubmitError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  function validateForm(): boolean {
    const errors: FieldErrors = {};

    // Validate using Zod schema
    const result = agentFormSchema.safeParse({
      description,
      sighting_lat: location?.lat,
      sighting_lng: location?.lng,
    });

    if (!result.success) {
      const flat = result.error.flatten();
      if (flat.fieldErrors.description) {
        errors.description = flat.fieldErrors.description[0];
      }
      if (flat.fieldErrors.sighting_lat || flat.fieldErrors.sighting_lng) {
        errors.location = "Sighting location is required — place a pin on the map";
      }
    }

    // Photos validation (not in Zod schema for form fields)
    if (photos.length < 1) {
      errors.photos = "At least 1 photo is required";
    }

    // Location check (in case Zod didn't catch it due to undefined)
    if (!location) {
      errors.location = "Sighting location is required — place a pin on the map";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        description: description.trim(),
        sighting_lat: location!.lat,
        sighting_lng: location!.lng,
        photos,
      };

      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.error || "Failed to file report. Try again.");
        setIsSubmitting(false);
        return;
      }

      // Success: clear form and navigate to new record
      setDescription("");
      setLocation(null);
      setPhotos([]);
      setFieldErrors({});
      setSubmitError("");

      const agentId = data.agent?.id;
      if (agentId) {
        router.push(`/agents/${agentId}`);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setSubmitError("Network error — check your connection and try again.");
      setIsSubmitting(false);
    }
  }

  function handleLocationSelect(loc: { lat: number; lng: number }) {
    setLocation(loc);
    if (fieldErrors.location) {
      setFieldErrors((prev) => ({ ...prev, location: undefined }));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Global submit error */}
      {submitError && (
        <div className="flex items-start gap-2 rounded-[2px] border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Photo Upload */}
      <div className="space-y-2">
        <Label>
          Surveillance Photos <span className="text-danger">*</span>
        </Label>
        <p className="text-xs text-text-secondary">
          Upload 1–5 photos of the spotted Agent. Clear shots help our AI match faster.
        </p>
        <PhotoUploader
          value={photos}
          onChange={(urls) => {
            setPhotos(urls);
            if (fieldErrors.photos) {
              setFieldErrors((prev) => ({ ...prev, photos: undefined }));
            }
          }}
          minPhotos={1}
          maxPhotos={5}
          error={fieldErrors.photos}
        />
      </div>

      {/* Sighting Location (Map Picker) */}
      <div className="space-y-2">
        <Label>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-accent" />
            Sighting Location <span className="text-danger">*</span>
          </span>
        </Label>
        <p className="text-xs text-text-secondary">
          Drop a pin where you spotted the Agent
        </p>
        <MapPicker
          onLocationSelect={handleLocationSelect}
          selectedLocation={location}
        />
        {location && (
          <p className="font-mono text-xs text-success">
            Coordinates locked: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </p>
        )}
        <InlineError id="location-error" message={fieldErrors.location} />
      </div>

      {/* Description (optional) */}
      <div className="space-y-2">
        <Label htmlFor="description">Field Notes</Label>
        <textarea
          id="description"
          placeholder="Behavior, direction of travel, condition, any notable traits..."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (fieldErrors.description) {
              setFieldErrors((prev) => ({ ...prev, description: undefined }));
            }
          }}
          maxLength={500}
          rows={3}
          aria-invalid={!!fieldErrors.description}
          aria-describedby={fieldErrors.description ? "description-error" : undefined}
          className={cn(
            "flex w-full rounded-[2px] border border-border bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors resize-none",
            fieldErrors.description && "border-danger"
          )}
        />
        <InlineError id="description-error" message={fieldErrors.description} />
        <p className="text-xs text-text-secondary">
          {description.length}/500 characters (optional)
        </p>
      </div>

      {/* Timestamp info */}
      <div className="rounded-[2px] border border-border/50 bg-card/30 px-4 py-3">
        <p className="text-xs font-mono text-text-secondary">
          ⏱ SIGHTING TIMESTAMP: Auto-generated at moment of submission
        </p>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Transmitting Intel...
          </>
        ) : (
          "Log Spotted Agent"
        )}
      </Button>
    </form>
  );
}

/** Inline validation error display */
function InlineError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <div id={id} className="flex items-start gap-1.5 text-xs text-danger" role="alert">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
