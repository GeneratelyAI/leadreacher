import Link from "next/link";
import { ArrowRight, Check, Minus } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface ComparisonPlan {
  id: string;
  name: string;
  price: string;
  priceSuffix?: string;
  featured?: boolean;
  href: string;
}

export interface ComparisonRow {
  label: string;
  values: (boolean | string)[];
}

interface PricingComparisonProps {
  eyebrow?: string;
  heading: string;
  plans: ComparisonPlan[];
  rows: ComparisonRow[];
  ctaLabel?: string;
}

export default function PricingComparison({ eyebrow, heading, plans, rows, ctaLabel = "Choose plan" }: PricingComparisonProps) {
  const gridTemplateColumns = `minmax(240px,1.15fr) repeat(${plans.length}, minmax(220px,1fr))`;
  const featuredIndex = plans.findIndex((plan) => plan.featured);

  return (
    <div className="mx-auto max-w-[1180px]">
      {eyebrow ? <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#6b5fbf]">{eyebrow}</p> : null}
      <h2 className="mt-3 text-center text-3xl font-semibold sm:text-[2.6rem]">{heading}</h2>

      <div className="mt-8 space-y-4 lg:hidden" data-testid="pricing-comparison-mobile">
        {plans.map((plan, planIndex) => (
          <article key={plan.id} className={cn("overflow-hidden rounded-[20px] border bg-white/85 shadow-[0_16px_40px_rgba(66,42,148,0.07)] backdrop-blur-xl", plan.featured ? "border-[#5a32ed]/25" : "border-white")}>
            <header className={cn("flex items-start justify-between gap-4 border-b px-5 py-5", plan.featured ? "border-[#5a32ed]/15 bg-[#5a32ed]/[0.04]" : "border-[#e8e6ed]")}>
              <div>
                <p className="text-lg font-semibold leading-6 text-[#111322]">{plan.name}</p>
                <p className="mt-1 text-sm font-medium text-[#777784]">{plan.price}<span className="ml-1 text-xs font-normal">{plan.priceSuffix ?? ""}</span></p>
              </div>
              {plan.featured ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#171223] px-2.5 py-1.5 text-[11px] font-semibold text-[#d9cfff]"><Check className="size-3" aria-hidden />Best value</span> : null}
            </header>
            <dl className="divide-y divide-[#e8e6ed] px-5">
              {rows.map((row) => {
                const value = row.values[planIndex];
                return (
                  <div key={row.label} className="flex min-h-12 items-center justify-between gap-4 py-3">
                    <dt className="text-sm font-medium text-[#3f4252]">{row.label}</dt>
                    <dd className="shrink-0">
                      {typeof value === "boolean" ? (
                        value ? <span className="flex size-7 items-center justify-center rounded-full bg-[#eeeaff] text-[#5a32ed]"><Check className="size-4" aria-hidden /><span className="sr-only">Included</span></span>
                          : <span className="flex size-7 items-center justify-center rounded-full bg-[#f4f3f6] text-[#aaa8b1]"><Minus className="size-4" aria-hidden /><span className="sr-only">Not included</span></span>
                      ) : <span className="text-sm font-medium text-[#30313d]">{value}</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <div className="p-5">
              <Link href={plan.href} className={cn("inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors", plan.featured ? "border-[#5a32ed] bg-[#5a32ed] text-white" : "border-[#5a32ed]/25 text-[#4e28df]")}>{ctaLabel}<ArrowRight className="size-4" aria-hidden /></Link>
            </div>
          </article>
        ))}
      </div>

      <div data-testid="pricing-comparison-scroll" className="mt-12 hidden overflow-x-auto lg:block lg:overflow-visible" role="region" aria-label={heading} tabIndex={0}>
        <div className="relative min-w-[980px]" role="table" aria-label={`${heading} details`}>
          {featuredIndex >= 0 ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -z-10 rounded-2xl bg-[#5a32ed]/[0.05]"
              style={{ left: `calc((100% / ${plans.length + 1.15}) * ${1.15 + featuredIndex})`, width: `calc(100% / ${plans.length + 1.15})` }}
            />
          ) : null}

          <div data-testid="pricing-comparison-header" className="grid border-b border-[#111]/85" style={{ gridTemplateColumns }} role="row">
            <div className="flex items-end px-7 pb-8 text-base font-semibold text-[#30313d]" role="columnheader">Features</div>
            {plans.map((plan) => (
              <div key={plan.id} className="flex flex-col items-start justify-end gap-1.5 px-7 pb-8" role="columnheader">
                <div className="mb-1 h-6">
                  {plan.featured ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#171223] px-3 py-1.5 text-xs font-semibold text-[#d9cfff]">
                      <Check className="size-3.5" aria-hidden /> Best value
                    </span>
                  ) : null}
                </div>
                <p className="text-lg font-semibold leading-6 text-[#111322]">{plan.name}</p>
                <p className="text-base font-medium text-[#8a8a93]">{plan.price}<span className="ml-1 text-sm font-normal">{plan.priceSuffix ?? ""}</span></p>
              </div>
            ))}
          </div>

          <div role="rowgroup">
            {rows.map((row, rowIndex) => (
              <div key={row.label} className={cn("grid items-center", rowIndex < rows.length - 1 && "border-b border-[#e5e3ea]")} style={{ gridTemplateColumns }} role="row">
                <div className="px-7 py-7 text-base font-medium text-[#30313d]" role="rowheader">{row.label}</div>
                {row.values.map((value, index) => (
                  <div key={`${row.label}-${plans[index]?.id ?? index}`} className="flex items-center px-7 py-7" role="cell">
                    {typeof value === "boolean" ? (
                      value ? (
                        <span className="text-[#171b2c]" title={`${row.label} included`}>
                          <Check className="size-5" strokeWidth={2.4} aria-hidden />
                          <span className="sr-only">Included</span>
                        </span>
                      ) : (
                        <span className="text-[#c7c5d0]" title={`${row.label} not included`}>
                          <Minus className="size-5" strokeWidth={2.2} aria-hidden />
                          <span className="sr-only">Not included</span>
                        </span>
                      )
                    ) : (
                      <span className="text-base font-medium text-[#30313d]">{value}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="grid border-t border-[#111]/85 pt-8" style={{ gridTemplateColumns }} role="row">
            <div role="cell" />
            {plans.map((plan) => (
              <div key={plan.id} className="px-7" role="cell">
                <Link
                  href={plan.href}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#111] bg-white px-4 text-base font-semibold text-[#111] transition-[background-color,transform] hover:-translate-y-px hover:bg-[#f5f4f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c58ed] focus-visible:ring-offset-2"
                >
                  {ctaLabel} <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
