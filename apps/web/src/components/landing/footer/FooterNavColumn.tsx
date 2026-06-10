type FooterNavColumnProps = {
  title: string;
  links: readonly string[];
};

export default function FooterNavColumn({ title, links }: FooterNavColumnProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-footer-heading">{title}</h3>
      <ul className="mt-5 space-y-3.5">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="text-base text-footer-text hover:opacity-80">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
