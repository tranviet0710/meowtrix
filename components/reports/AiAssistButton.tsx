"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  AiAssistModal,
  type AiAssistApplyValues,
} from "./AiAssistModal";

/**
 * AiAssistButton — single entry point that opens the AI-assisted report flow.
 *
 * Rendered once per report page (above the manual form) on both the Lost
 * Report page and the Spotted Report page. Owns the modal's open/close
 * state so the surrounding page doesn't have to.
 *
 * Copy varies by variant per design.md:
 *   • `lost`    → "Create with AI from a screenshot"
 *   • `spotted` → "Post a sighting from a screenshot"
 *
 * Below the button, a small secondary line explains what the flow does.
 *
 * _Requirements: 1.1, 1.2, 1.3_
 */

export interface AiAssistButtonProps {
  variant: "lost" | "spotted";
  onApply: (values: AiAssistApplyValues) => void;
}

const BUTTON_COPY = {
  lost: "Create with AI from a screenshot",
  spotted: "Post a sighting from a screenshot",
} as const;

const HINT_COPY =
  "Have a Facebook or Instagram post? Upload the screenshot and we'll fill the form for you.";

export function AiAssistButton({ variant, onApply }: AiAssistButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleOpen = React.useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="default"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {BUTTON_COPY[variant]}
      </Button>
      <p className="text-xs text-text-secondary">{HINT_COPY}</p>

      <AiAssistModal
        open={isOpen}
        onClose={handleClose}
        variant={variant}
        onApply={onApply}
      />
    </div>
  );
}
