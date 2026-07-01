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
                className="rounded-lg"
              />
              <span className="font-[family-name:var(--font-space-grotesk)] text-lg font-bold tracking-tight text-text-primary">
                Meowtrix
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-secondary">
              A warm, community-powered app for reuniting lost cats and dogs
              with their families. Built for neighborhoods, powered by AI,
              free to use.
            </p>
          </div>

          {/* Product */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">
              Platform
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-text-secondary">
              <li>
                <a href="#features" className="hover:text-primary transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-primary transition-colors">
                  How it works
                </a>
              </li>
              <li>
                <a href="#mission" className="hover:text-primary transition-colors">
                  Mission
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-primary transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Get started */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">
              Get started
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-text-secondary">
              <li>
                <Link href="/register" className="hover:text-primary transition-colors">
                  Create account
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-primary transition-colors">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-primary transition-colors">
                  Report missing pet
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-primary transition-colors">
                  Report sighting
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">
              Contact
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              Tips, partnerships, press — reach us at{" "}
              <a
                href="mailto:hello@meowtrix.io"
                className="text-primary hover:underline"
              >
                hello@meowtrix.io
              </a>
            </p>
            <p className="mt-4 text-xs text-text-secondary">
              Support: worldwide, always free
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-text-secondary">
            © {new Date().getFullYear()} Meowtrix · All rights reserved
          </p>
          <p className="text-xs text-text-secondary">
            Built with care · Hosted on Vercel · No data resale
          </p>
        </div>
      </div>
    </footer>
  );
}
