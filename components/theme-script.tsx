"use client";

import { useEffect } from "react";

const THEME_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    var dark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.add(dark ? 'dark' : 'light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch(e) {}
})();
`;

export function ThemeScript() {
  useEffect(() => {
    const script = document.createElement("script");
    script.textContent = THEME_SCRIPT;
    document.head.insertBefore(script, document.head.firstChild);
  }, []);

  return null;
}
