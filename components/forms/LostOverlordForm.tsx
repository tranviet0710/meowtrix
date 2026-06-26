"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Shield, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { overlordFormSchema, type OverlordFormInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  pet_name?: string;
  pet_type?: string;
  description?: string;
  last_seen_at?: string;
  location?: string;
  photos?: string;
  verification_name?: string;
  verification_marking?: string;
  verification_trait?: string;
}

export function LostOverlordForm() {
  const router = useRouter();

  // Form field state
  const [petName, setPetName] = React.useState("");
  const [petType, setPetType] = React.useState<"cat" | "dog">("cat");
  const [description, setDescription] = React.useState("");
  const [lastSeenAt, setLastSeenAt] = React.useState("");
  const [location, setLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [verificationName, setVerificationName] = React.useState("");
  const [verificationMarking, setVerificationMarking] = React.useState("");
  const [verificationTrait, setVerificationTrait] = React.useState("");

  // UI state
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [submitError, setSubmitError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  function validateForm(): boolean {
    const errors: FieldErrors = {};

    // Validate using Zod schema
    const result = overlordFormSchema.safeParse({
      pet_name: petName,
      pet_type: petType,
      description,
      last_seen_lat: location?.lat,
      last_seen_lng: location?.lng,
      last_seen_at: lastSeenAt,
      verification_name: verificationName,
      verification_marking: verificationMarking,
      verification_trait: verificationTrait,
    });

    if (!result.success) {
      const flat = result.error.flatten();
      if (flat.fieldErrors.pet_name) {
        errors.pet_name = flat.fieldErrors.pet_name[0];
      }
      if (flat.fieldErrors.description) {
        errors.description = flat.fieldErrors.description[0];
      }
      if (flat.fieldErrors.last_seen_at) {
        errors.last_seen_at = flat.fieldErrors.last_seen_at[0];
      }
      if (flat.fieldErrors.last_seen_lat || flat.fieldErrors.last_seen_lng) {
        errors.location = "Last-seen location is required — place a pin on the map";
      }
      if (flat.fieldErrors.verification_name) {
        errors.verification_name = flat.fieldErrors.verification_name[0];
      }
      if (flat.fieldErrors.verification_marking) {
        errors.verification_marking = flat.fieldErrors.verification_marking[0];
      }
      if (flat.fieldErrors.verification_trait) {
        errors.verification_trait = flat.fieldErrors.verification_trait[0];
      }
    }

    // Photos validation (not in Zod schema for the form fields)
    if (photos.length < 1) {
      errors.photos = "At least 1 photo is required";
    }

    // Location check (in case Zod didn't catch it due to undefined)
    if (!location) {
      errors.location = "Last-seen location is required — place a pin on the map";
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
        pet_name: petName.trim(),
        pet_type: petType,
        description: description.trim(),
        last_seen_lat: location!.lat,
        last_seen_lng: location!.lng,
        last_seen_at: new Date(lastSeenAt).toISOString(),
        verification_name: verificationName.trim(),
        verification_marking: verificationMarking.trim(),
        verification_trait: verificationTrait.trim(),
        photos,
      };

      const response = await fetch("/api/overlords", {
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

      // Success: clear form and navigate to the new record
      setPetName("");
      setPetType("cat");
      setDescription("");
      setLastSeenAt("");
      setLocation(null);
      setPhotos([]);
      setVerificationName("");
      setVerificationMarking("");
      setVerificationTrait("");
      setFieldErrors({});

      const overlordId = data.overlord?.id;
      if (overlordId) {
        router.push(`/overlords/${overlordId}`);
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

      {/* Pet Type Selector */}
      <div className="space-y-2">
        <Label>
          Pet Type <span className="text-danger">*</span>
        </Label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPetType("cat")}
            className={cn(
              "flex-1 rounded-[2px] border px-4 py-3 text-sm font-medium transition-colors",
              petType === "cat"
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-text-secondary hover:border-text-secondary"
            )}
          >
            🐱 Cat
          </button>
          <button
            type="button"
            onClick={() => setPetType("dog")}
            className={cn(
              "flex-1 rounded-[2px] border px-4 py-3 text-sm font-medium transition-colors",
              petType === "dog"
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-text-secondary hover:border-text-secondary"
            )}
          >
            🐶 Dog
          </button>
        </div>
      </div>

      {/* Pet Name */}
      <div className="space-y-2">
        <Label htmlFor="pet-name">
          Overlord Codename <span className="text-danger">*</span>
        </Label>
        <Input
          id="pet-name"
          placeholder={petType === "cat" ? "e.g., Agent Whiskers" : "e.g., Commander Barkley"}
          value={petName}
          onChange={(e) => {
            setPetName(e.target.value);
            if (fieldErrors.pet_name) {
              setFieldErrors((prev) => ({ ...prev, pet_name: undefined }));
            }
          }}
          maxLength={50}
          aria-invalid={!!fieldErrors.pet_name}
          aria-describedby={fieldErrors.pet_name ? "pet-name-error" : undefined}
          className={cn(fieldErrors.pet_name && "border-danger")}
        />
        <InlineError id="pet-name-error" message={fieldErrors.pet_name} />
        <p className="text-xs text-text-secondary">1–50 characters</p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          placeholder="Notable features, personality, last known behavior..."
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
          {description.length}/500 characters
        </p>
      </div>

      {/* Photo Upload */}
      <div className="space-y-2">
        <Label>
          Intelligence Photos <span className="text-danger">*</span>
        </Label>
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

      {/* Last-Seen Location (Map Picker) */}
      <div className="space-y-2">
        <Label>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-accent" />
            Last-Seen Location <span className="text-danger">*</span>
          </span>
        </Label>
        <p className="text-xs text-text-secondary">
          Drop a pin where the Overlord was last spotted
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

      {/* Last-Seen Timestamp */}
      <div className="space-y-2">
        <Label htmlFor="last-seen-at">
          Last-Seen Timestamp <span className="text-danger">*</span>
        </Label>
        <Input
          id="last-seen-at"
          type="datetime-local"
          value={lastSeenAt}
          onChange={(e) => {
            setLastSeenAt(e.target.value);
            if (fieldErrors.last_seen_at) {
              setFieldErrors((prev) => ({ ...prev, last_seen_at: undefined }));
            }
          }}
          max={new Date().toISOString().slice(0, 16)}
          aria-invalid={!!fieldErrors.last_seen_at}
          aria-describedby={fieldErrors.last_seen_at ? "last-seen-error" : undefined}
          className={cn(fieldErrors.last_seen_at && "border-danger")}
        />
        <InlineError id="last-seen-error" message={fieldErrors.last_seen_at} />
        <p className="text-xs text-text-secondary">
          Cannot be in the future or more than 30 days ago
        </p>
      </div>

      {/* Verification Questions */}
      <div className="space-y-4 rounded-[2px] border border-border bg-card/50 p-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Security Verification
          </h3>
        </div>
        <p className="text-xs text-text-secondary">
          These answers are used to verify your ownership when someone finds your Overlord.
          They are never shown to other Informants.
        </p>

        {/* Verification Name */}
        <div className="space-y-2">
          <Label htmlFor="verification-name">
            Pet&apos;s True Name <span className="text-danger">*</span>
          </Label>
          <Input
            id="verification-name"
            placeholder="The name your Overlord answers to"
            value={verificationName}
            onChange={(e) => {
              setVerificationName(e.target.value);
              if (fieldErrors.verification_name) {
                setFieldErrors((prev) => ({ ...prev, verification_name: undefined }));
              }
            }}
            maxLength={200}
            aria-invalid={!!fieldErrors.verification_name}
            aria-describedby={fieldErrors.verification_name ? "vname-error" : undefined}
            className={cn(fieldErrors.verification_name && "border-danger")}
          />
          <InlineError id="vname-error" message={fieldErrors.verification_name} />
        </div>

        {/* Verification Marking */}
        <div className="space-y-2">
          <Label htmlFor="verification-marking">
            Unique Physical Marking <span className="text-danger">*</span>
          </Label>
          <Input
            id="verification-marking"
            placeholder="e.g., heart-shaped patch on left ear"
            value={verificationMarking}
            onChange={(e) => {
              setVerificationMarking(e.target.value);
              if (fieldErrors.verification_marking) {
                setFieldErrors((prev) => ({ ...prev, verification_marking: undefined }));
              }
            }}
            maxLength={200}
            aria-invalid={!!fieldErrors.verification_marking}
            aria-describedby={fieldErrors.verification_marking ? "vmarking-error" : undefined}
            className={cn(fieldErrors.verification_marking && "border-danger")}
          />
          <InlineError id="vmarking-error" message={fieldErrors.verification_marking} />
        </div>

        {/* Verification Trait */}
        <div className="space-y-2">
          <Label htmlFor="verification-trait">
            Behavioral Trait <span className="text-danger">*</span>
          </Label>
          <Input
            id="verification-trait"
            placeholder="e.g., chirps at birds, kneads blankets before napping"
            value={verificationTrait}
            onChange={(e) => {
              setVerificationTrait(e.target.value);
              if (fieldErrors.verification_trait) {
                setFieldErrors((prev) => ({ ...prev, verification_trait: undefined }));
              }
            }}
            maxLength={200}
            aria-invalid={!!fieldErrors.verification_trait}
            aria-describedby={fieldErrors.verification_trait ? "vtrait-error" : undefined}
            className={cn(fieldErrors.verification_trait && "border-danger")}
          />
          <InlineError id="vtrait-error" message={fieldErrors.verification_trait} />
        </div>
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
            Filing Report...
          </>
        ) : (
          "Deploy Missing Overlord Alert"
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
