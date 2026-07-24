"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export type SequenceStepDraft = {
  type: string;
  message: string;
  delayHours: number;
};

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
        const isInvite = index === 0;
        return (
          <div
            key={`${step.type}-${index}`}
            className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Step {index + 1}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {isInvite ? "LinkedIn invite" : "Follow-up message"}
                </span>
              </p>
              {!isInvite && !disabled ? (
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
              Delay (hours before this step)
              <Input
                type="number"
                min={0}
                step={1}
                disabled={disabled || isInvite}
                value={step.delayHours}
                onChange={(event) =>
                  updateStep(index, {
                    delayHours: Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0),
                  })
                }
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Message
              <textarea
                className="min-h-24 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                disabled={disabled}
                value={step.message}
                onChange={(event) => updateStep(index, { message: event.target.value })}
                placeholder={isInvite ? "Connection note…" : "Follow-up message…"}
              />
            </label>
          </div>
        );
      })}
      {!disabled ? (
        <Button type="button" size="sm" variant="outline" onClick={addFollowUp}>
          <Plus className="size-3.5" />
          Add follow-up
        </Button>
      ) : null}
    </div>
  );
}
