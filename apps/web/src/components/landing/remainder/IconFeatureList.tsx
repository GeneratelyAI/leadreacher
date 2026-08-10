import type { LucideIcon } from "lucide-react";

export type IconFeature = {
  icon: LucideIcon;
  label: string;
};

type IconFeatureListProps = {
  items: readonly IconFeature[];
  className: string;
  itemClassName: string;
  iconWrapperClassName: string;
  iconClassName: string;
};

export function IconFeatureList({ items, className, itemClassName, iconWrapperClassName, iconClassName }: IconFeatureListProps) {
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
