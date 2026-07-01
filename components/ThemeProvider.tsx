"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * ThemeProvider — locks the app to dark mode.
 *
 * Per the Meowtrix design steering, dark mode is the ONLY supported mode.
 * We keep next-themes in place so any legacy `useTheme()` calls still resolve,
 * but `forcedTheme="dark"` prevents anything from flipping the html class.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
