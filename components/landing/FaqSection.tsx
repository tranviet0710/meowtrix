"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Is Meowtrix really free?",
    a: "Yes. Filing a report, viewing matches, and reuniting with your pet are all free for families. We operate on a humanitarian basis — no premium tiers, no paid promotions, no upsells.",
  },
  {
    q: "Does it work for both cats and dogs?",
    a: "Both. Our AI vision pipeline handles cats and dogs (with more species on the roadmap). The same heatmap, alerts, and verification flow apply.",
  },
  {
    q: "How does AI matching work?",
    a: "When you upload a photo, Gemini Vision extracts traits like breed, coat color, markings, eye color, and distinguishing features. We compare those traits against found-pet reports in your area and surface the most likely matches first.",
  },
  {
    q: "What if no one finds my pet in the first few hours?",
    a: "Our smart search timeline takes over. At 6 hours we widen the alert radius. At 24 hours we notify a broader network. At 48 hours we escalate further. The right people are notified at the right time — automatically.",
  },
  {
    q: "How do you prevent scams or false claims?",
    a: "Every claim requires owner-only verification questions and photo proof. Finders never get the owner's location or contact info until the claim is verified by both parties.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. Meowtrix runs in any modern browser on desktop or mobile. Just sign up and start.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="relative scroll-mt-20 border-b border-border bg-background"
    >
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mb-10 text-center sm:mb-12">
          <div className="text-xs font-semibold text-primary">Good questions</div>
          <h2 className="mt-4 font-[family-name:var(--font-space-grotesk)] text-4xl font-black leading-tight tracking-tight text-text-primary sm:text-5xl">
            Frequently asked
          </h2>
        </div>

        <ul className="divide-y divide-border rounded-xl border border-border bg-card/60 overflow-hidden shadow-[var(--shadow-soft)]">
          {FAQS.map((item, idx) => {
            const isOpen = open === idx;
            return (
              <li key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-6 sm:py-5"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold text-text-primary sm:text-base">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-primary transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="min-h-0">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-text-secondary sm:px-6 sm:pb-6 sm:text-[15px]">
                      {item.a}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
