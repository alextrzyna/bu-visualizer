"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const links = [
  { href: "/", label: "Walkthrough" },
  { href: "/your-life", label: "A Life" },
  { href: "/references", label: "References" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md bg-[color-mix(in_oklab,var(--void-0)_70%,transparent)] border-b border-[var(--rule)]">
      <nav className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--ember)] shadow-[0_0_12px_var(--ember)]" />
          <span className="font-serif text-[15px] tracking-tight text-[var(--ink-0)]">
            The Block Universe
          </span>
        </Link>
        <ul className="flex items-center gap-1 text-[13px]">
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "px-3 py-1.5 rounded-full transition-colors",
                    active
                      ? "text-[var(--ink-0)] bg-[var(--void-2)]"
                      : "text-[var(--ink-2)] hover:text-[var(--ink-0)]",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
