"use client";

import { AlertTriangle } from "lucide-react";
import { LostOverlordForm } from "@/components/forms/LostOverlordForm";

export default function ReportLostPage() {
  return (
    <div className="mx-auto w-[92%] max-w-2xl py-8 md:w-full md:px-6">
      {/* Page Header */}
      <div className="mb-8 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-danger" />
          <h1 className="text-2xl font-bold uppercase tracking-wider text-text-primary">
            Report a Missing Pet
          </h1>
        </div>
        <p className="text-sm text-text-secondary">
          File a report for your lost cat or dog. Our community will be alerted
          and the escalating search protocol will activate automatically.
        </p>
      </div>

      {/* Form */}
      <LostOverlordForm />
    </div>
  );
}
