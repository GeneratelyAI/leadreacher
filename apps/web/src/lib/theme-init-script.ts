export const THEME_STORAGE_KEY = "lr_theme";
const LEGACY_THEME_STORAGE_KEY = "lr-theme";

export const THEME_COLOR_LIGHT = "#ffffff";
export const THEME_COLOR_DARK = "#0a0e14";

export const themeInitScript = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(!s){s=localStorage.getItem('${LEGACY_THEME_STORAGE_KEY}');}var isDark=s==='dark'||s==='light'?s==='dark':(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',isDark);var metas=document.querySelectorAll('meta[name="theme-color"]');metas.forEach(function(m){m.remove();});var meta=document.createElement('meta');meta.name='theme-color';meta.content=isDark?'${THEME_COLOR_DARK}':'${THEME_COLOR_LIGHT}';document.head.appendChild(meta);}catch(e){}})();`;
