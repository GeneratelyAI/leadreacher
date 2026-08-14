import type { AppIcon } from "@/components/ui/icons";

export type IconFeature = {
  icon: AppIcon;
  label: string;
};

type FeatureListProps = {
  items: readonly IconFeature[];
  className: string;
  itemClassName: string;
  iconWrapperClassName: string;
  iconClassName: string;
};

export function FeatureList({ items, className, itemClassName, iconWrapperClassName, iconClassName }: FeatureListProps) {
  return (
    <ul className={className}>
      {items.map(({ icon: Icon, label }) => (
        <li key={label} className={itemClassName}>
          <span className={iconWrapperClassName}><Icon className={iconClassName} /></span>
          {label}
        </li>
      ))}
    </ul>
  );
}
