import { Nav } from "@/components/ui/Nav";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { LightWipe } from "@/components/ui/LightWipe";
import { Hero } from "@/components/chapters/Hero";
import { Chapter1 } from "@/components/chapters/Chapter1";
import { Chapter2 } from "@/components/chapters/Chapter2";
import { Chapter3 } from "@/components/chapters/Chapter3";
import { Chapter4 } from "@/components/chapters/Chapter4";
import { Chapter5 } from "@/components/chapters/Chapter5";
import { Chapter6 } from "@/components/chapters/Chapter6";
import { Chapter7 } from "@/components/chapters/Chapter7";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative">
      <Nav />
      <ScrollProgress />
      <LightWipe />
      <Hero />
      <Chapter1 />
      <Chapter2 />
      <Chapter3 />
      <Chapter4 />
      <Chapter5 />
      <Chapter6 />
      <Chapter7 />
      <footer className="border-t border-[var(--rule)] py-16 px-6 text-center">
        <p className="font-serif text-[var(--ink-2)] text-sm">
          Continue to the capstone:{" "}
          <Link
            href="/your-life"
            className="text-[var(--ember)] underline underline-offset-4"
          >
            a life in the block
          </Link>
          {"  "}·{"  "}
          <Link
            href="/references"
            className="text-[var(--ink-1)] hover:text-[var(--ink-0)]"
          >
            references &amp; further reading
          </Link>
        </p>
      </footer>
    </main>
  );
}
