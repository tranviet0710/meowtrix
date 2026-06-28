import Image from "next/image";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-5">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo/logo.png"
                alt="Meowtrix logo"
                width={36}
                height={36}
              />
              <span className="font-[family-name:var(--font-space-grotesk)] text-lg font-bold uppercase tracking-wider text-text-primary">
                Meowtrix
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-secondary">
              A humanitarian command center for reuniting lost cats and dogs
              with their families. Built for neighborhoods, powered by AI,
              free to use.
            </p>
          </div>

          {/* Product */}
          <div className="md:col-span-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-accent">
              Platform
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-text-secondary">
              <li>
                <a href="#features" className="hover:text-accent">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-accent">
                  How it works
                </a>
              </li>
              <li>
                <a href="#mission" className="hover:text-accent">
                  Mission
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-accent">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Get started */}
          <div className="md:col-span-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-accent">
              Get started
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-text-secondary">
              <li>
                <Link href="/register" className="hover:text-accent">
                  Create account
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-accent">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-accent">
                  Report lost pet
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-accent">
                  Report found pet
                </Link>
              </li>
            </ul>
          </div>

          {/* Comms */}
          <div className="md:col-span-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-accent">
              Comms channel
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              Tip line, partnerships, press inquiries — reach HQ at{" "}
              <a
                href="mailto:hq@meowtrix.io"
                className="font-mono text-accent hover:underline"
              >
                hq@meowtrix.io
              </a>
            </p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-text-secondary">
              Operations: 24 / 7 · Worldwide
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            © {new Date().getFullYear()} Meowtrix HQ · All rights reserved
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
            Built with intent · Hosted on Vercel · No data resale
          </p>
        </div>
      </div>
    </footer>
  );
}
