//Theme Toggle System with Cookie Storage
const THEME_COOKIE = "siteTheme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; //1 year

function setCookie(name, value, maxAgeSeconds) {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[$()*+./?[\\\]^{|}-]/g, '\\$&') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

function applyTheme(theme) {
    const root = document.documentElement;
    const isDark = theme === "dark";
    root.classList.toggle("theme-dark", isDark);

    const switchEl = document.getElementById("themeSwitch");
    if (switchEl) {
        switchEl.checked = isDark;
        switchEl.setAttribute("aria-checked", String(isDark));
    }
}

function detectSystemPref() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initTheme() {
    const saved = getCookie(THEME_COOKIE);
    const theme = saved === "light" || saved === "dark" ? saved : detectSystemPref();
    applyTheme(theme);

    const switchEl = document.getElementById("themeSwitch");
    if (switchEl) {
        switchEl.addEventListener("change", () => {
            const chosen = switchEl.checked ? "dark" : "light";
            applyTheme(chosen);
            setCookie(THEME_COOKIE, chosen, COOKIE_MAX_AGE);
        });
    }

    //If no cookie, update on system change
    if (!saved && window.matchMedia) {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        mq.addEventListener("change", (e) => {
            applyTheme(e.matches ? "dark" : "light");
        });
    }
}

//Run when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
} else {
    initTheme();
}
