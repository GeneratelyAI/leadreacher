export const THEME_STORAGE_KEY = "lr_theme";
const LEGACY_THEME_STORAGE_KEY = "lr-theme";

export const THEME_COLOR_LIGHT = "#ffffff";
export const THEME_COLOR_DARK = "#020617";

export const themeInitScript = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(!s){s=localStorage.getItem('${LEGACY_THEME_STORAGE_KEY}');if(s){localStorage.setItem('${THEME_STORAGE_KEY}',s);localStorage.removeItem('${LEGACY_THEME_STORAGE_KEY}');}}var isDark=s==='dark';document.documentElement.classList.toggle('dark',isDark);var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute('content',isDark?'${THEME_COLOR_DARK}':'${THEME_COLOR_LIGHT}');}}catch(e){}})();`;
