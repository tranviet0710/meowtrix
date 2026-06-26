"use client";

import { Eye } from "lucide-react";
import { SpottedAgentForm } from "@/components/forms/SpottedAgentForm";

export default function ReportFoundPage() {
  return (
    <div className="mx-auto w-[92%] max-w-2xl py-8 md:w-full md:px-6">
      {/* Page Header */}
      <div className="mb-8 space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="h-6 w-6 text-success" />
          <h1 className="text-2xl font-bold uppercase tracking-wider text-text-primary">
            Report Spotted Agent
          </h1>
        </div>
        <p className="text-sm text-text-secondary">
          Log a feline sighting. Upload photos and mark the location — our AI will
          cross-reference against missing Overlords and alert their handlers.
        </p>
      </div>

      {/* Form */}
      <SpottedAgentForm />
    </div>
  );
}
