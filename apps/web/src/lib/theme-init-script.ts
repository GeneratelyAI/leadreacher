export const THEME_STORAGE_KEY = "lr_theme";
const LEGACY_THEME_STORAGE_KEY = "lr-theme";

export const themeInitScript = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(!s){s=localStorage.getItem('${LEGACY_THEME_STORAGE_KEY}');if(s){localStorage.setItem('${THEME_STORAGE_KEY}',s);localStorage.removeItem('${LEGACY_THEME_STORAGE_KEY}');}}if(s==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`;
