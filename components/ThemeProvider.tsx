"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * ThemeProvider — Meowtrix supports two themes: dark (default) and light.
 *
 * We use next-themes' class-based strategy. The <html> element gets a
 * `dark` or `light` class, and `app/globals.css` defines both palettes.
 *
 * `enableSystem` is intentionally false — users pick a theme explicitly
 * from the Settings page. `disableTransitionOnChange` avoids a flash
 * when toggling.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      themes={["dark", "light"]}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
