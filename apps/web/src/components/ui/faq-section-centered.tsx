"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type FaqItem = readonly [question: string, answer: string];

type FaqSectionCenteredProps = {
  items: readonly FaqItem[];
  eyebrow?: string;
  heading: string;
  description: string;
  supportEmail?: string;
  className?: string;
};

export function FaqSectionCentered({
  items,
  eyebrow = "FAQ",
  heading,
  description,
  supportEmail,
  className,
}: FaqSectionCenteredProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className={cn("mx-auto flex w-full max-w-3xl flex-col items-center", className)}>
      <p className="text-xs font-semibold uppercase text-[#5b39d5]">{eyebrow}</p>
      <h2 className="mt-4 max-w-2xl text-balance text-center text-4xl font-semibold leading-tight text-[#111527] sm:text-5xl">{heading}</h2>
      <p className="mt-4 max-w-xl text-pretty text-center text-base leading-7 text-[#62697e]">{description}</p>

      <div className="mt-10 w-full border-y border-[#e1deea]">
        {items.map(([question, answer], index) => {
          const isOpen = openIndex === index;
          const panelId = `faq-panel-${index}`;
          const triggerId = `faq-trigger-${index}`;
          return (
            <div key={question} className="border-b border-[#e1deea] last:border-b-0">
              <button
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex min-h-16 w-full items-center justify-between gap-5 py-4 text-left text-base font-medium text-[#1a1e30] outline-none transition-colors hover:text-[#4e28df] focus-visible:text-[#4e28df] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8b7fd4]"
              >
                <span>{question}</span>
                <ChevronDown className={cn("size-5 shrink-0 text-[#6c7284] transition-transform duration-500 ease-in-out", isOpen && "rotate-180 text-[#4e28df]")} aria-hidden />
              </button>
              <div id={panelId} role="region" aria-labelledby={triggerId} className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-in-out", isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden"><p className="max-w-2xl pb-5 pr-10 text-sm leading-6 text-[#62697e]">{answer}</p></div>
              </div>
            </div>
          );
        })}
      </div>

      {supportEmail ? (
        <p className="mt-7 flex items-center gap-2 text-sm text-[#6a7082]">
          <MessageCircle className="size-4" aria-hidden /> Still have questions?
          <a href={`mailto:${supportEmail}`} className="font-semibold text-[#4e28df] hover:underline">Contact support</a>
        </p>
      ) : null}
    </div>
  );
}
