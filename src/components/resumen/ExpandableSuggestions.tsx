"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";

type ExpandableSuggestionsProps = {
  children: ReactNode;
  showMoreLabel: string;
  showLessLabel: string;
};

export default function ExpandableSuggestions({
  children,
  showMoreLabel,
  showLessLabel,
}: Readonly<ExpandableSuggestionsProps>) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <div className="mt-4">
      <div className="relative">
        <div
          id={contentId}
          className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
            expanded ? "max-h-[500rem]" : "max-h-[20rem]"
          }`}
        >
          <div className="space-y-4">{children}</div>
        </div>

        {!expanded ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/95 to-transparent"
          />
        ) : null}
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          aria-controls={contentId}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
        >
          {expanded ? showLessLabel : showMoreLabel}
          <span
            className={`material-symbols-outlined text-base transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            expand_more
          </span>
        </button>
      </div>
    </div>
  );
}
