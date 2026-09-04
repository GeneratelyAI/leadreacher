"use client";

import { Plus, Trash2 } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { channelDisplayName } from "@/components/dashboard/ChannelIdentity";

export type SequenceStepDraft = {
  type: string;
  message: string;
  delayHours: number;
  subject?: string;
};

const STEP_TYPE_OPTIONS = [
  { value: "linkedin_invite", label: "LinkedIn invite", channel: "linkedin" },
  { value: "linkedin_message", label: "LinkedIn message", channel: "linkedin" },
  { value: "whatsapp_message", label: "WhatsApp message", channel: "whatsapp" },
  { value: "facebook_message", label: "Facebook message", channel: "facebook" },
  { value: "instagram_message", label: "Instagram message", channel: "instagram" },
  { value: "email", label: "Email", channel: "email" },
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
      message: "Thanks for connecting - quick note on how we help teams like yours.",
      delayHours: 24,
    },
  ];
}

type SequenceBuilderProps = {
  value: SequenceStepDraft[];
  onChange: (next: SequenceStepDraft[]) => void;
  /** Limits new step actions to channels with an active sender. */
  availableChannels?: readonly string[];
  disabled?: boolean;
  className?: string;
};

export function SequenceBuilder({
  value,
  onChange,
  availableChannels,
  disabled = false,
  className,
}: SequenceBuilderProps) {
  const availableOptions = availableChannels
    ? STEP_TYPE_OPTIONS.filter((option) => availableChannels.includes(option.channel))
    : STEP_TYPE_OPTIONS;

  function updateStep(index: number, patch: Partial<SequenceStepDraft>) {
    const next = value.map((step, stepIndex) =>
      stepIndex === index ? { ...step, ...patch } : step,
    );
    onChange(next);
  }

  function addFollowUp() {
    const followUpOption = availableOptions.find((option) => option.value === "linkedin_message")
      ?? availableOptions.find((option) => option.value !== "linkedin_invite")
      ?? availableOptions[0];
    if (!followUpOption) return;
    onChange([
      ...value,
      {
        type: followUpOption.value,
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
        const selectedOption = STEP_TYPE_OPTIONS.find((option) => option.value === step.type);
        const selectedOptionUnavailable = Boolean(
          selectedOption && !availableOptions.some((option) => option.value === selectedOption.value),
        );
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
                disabled={disabled || availableOptions.length === 0}
                value={step.type}
                onChange={(event) => {
                  const type = event.target.value;
                  updateStep(index, {
                    type,
                    subject: type === "email" ? step.subject || "Quick note" : undefined,
                  });
                }}
              >
                {selectedOptionUnavailable ? (
                  <option value={selectedOption?.value} disabled>
                    {selectedOption?.label} (sender unavailable)
                  </option>
                ) : null}
                {availableOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {selectedOptionUnavailable ? (
                <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
                  Connect a {selectedOption ? channelDisplayName(selectedOption.channel) : "channel"} account before changing this step.
                </span>
              ) : null}
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
        <Button type="button" size="sm" variant="outline" disabled={availableOptions.length === 0} onClick={addFollowUp}>
          <Plus className="size-3.5" />
          Add step
        </Button>
      ) : null}
    </div>
  );
}
