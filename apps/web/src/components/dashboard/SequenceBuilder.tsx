"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export type SequenceStepDraft = {
  type: string;
  message: string;
  delayHours: number;
  subject?: string;
};

const STEP_TYPE_OPTIONS = [
  { value: "linkedin_invite", label: "LinkedIn invite" },
  { value: "linkedin_message", label: "LinkedIn message" },
  { value: "whatsapp_message", label: "WhatsApp message" },
  { value: "facebook_message", label: "Facebook message" },
  { value: "instagram_message", label: "Instagram message" },
  { value: "email", label: "Email" },
] as const;

export function defaultSequenceDraft(): SequenceStepDraft[] {
  return [
    {
      type: "linkedin_invite",
      message: "Hi {{FirstName}}, I'd love to connect.",
      delayHours: 0,
    },
    {
      type: "linkedin_message",
      message: "Thanks for connecting — quick note on how we help teams like yours.",
      delayHours: 24,
    },
  ];
}

type SequenceBuilderProps = {
  value: SequenceStepDraft[];
  onChange: (next: SequenceStepDraft[]) => void;
  disabled?: boolean;
  className?: string;
};

export function SequenceBuilder({ value, onChange, disabled = false, className }: SequenceBuilderProps) {
  function updateStep(index: number, patch: Partial<SequenceStepDraft>) {
    const next = value.map((step, stepIndex) =>
      stepIndex === index ? { ...step, ...patch } : step,
    );
    onChange(next);
  }

  function addFollowUp() {
    onChange([
      ...value,
      {
        type: "linkedin_message",
        message: "",
        delayHours: 48,
      },
    ]);
  }

  function removeStep(index: number) {
    if (index === 0) return;
    onChange(value.filter((_, stepIndex) => stepIndex !== index));
  }

  return (
    <div className={cn("space-y-3", className)}>
      {value.map((step, index) => {
        const isFirst = index === 0;
        const isEmail = step.type === "email";
        return (
          <div
            key={`${step.type}-${index}`}
            className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Step {index + 1}</p>
              {!isFirst && !disabled ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={() => removeStep(index)}
                  aria-label={`Remove step ${index + 1}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Channel / action
              <select
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                disabled={disabled}
                value={step.type}
                onChange={(event) => {
                  const type = event.target.value;
                  updateStep(index, {
                    type,
                    subject: type === "email" ? step.subject || "Quick note" : undefined,
                  });
                }}
              >
                {STEP_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Delay (hours before this step)
              <Input
                type="number"
                min={0}
                step={1}
                disabled={disabled || isFirst}
                value={step.delayHours}
                onChange={(event) =>
                  updateStep(index, {
                    delayHours: Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0),
                  })
                }
              />
            </label>
            {isEmail ? (
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Subject
                <Input
                  disabled={disabled}
                  value={step.subject ?? ""}
                  onChange={(event) => updateStep(index, { subject: event.target.value })}
                  placeholder="Email subject…"
                />
              </label>
            ) : null}
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              {isEmail ? "Body" : "Message"}
              <textarea
                className="min-h-24 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                disabled={disabled}
                value={step.message}
                onChange={(event) => updateStep(index, { message: event.target.value })}
                placeholder={isEmail ? "Email body…" : "Message…"}
              />
            </label>
          </div>
        );
      })}
      {!disabled ? (
        <Button type="button" size="sm" variant="outline" onClick={addFollowUp}>
          <Plus className="size-3.5" />
          Add step
        </Button>
      ) : null}
    </div>
  );
}
