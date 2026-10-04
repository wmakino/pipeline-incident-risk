import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const read = (): Theme => {
  if (typeof document === "undefined") return "dark";
  return (document.documentElement.getAttribute("data-theme") as Theme | null) ?? "dark";
};

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(read);

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeState(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  return { theme, setTheme };
}
