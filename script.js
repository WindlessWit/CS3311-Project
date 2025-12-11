//Theme Toggle System with Cookie Storage
const THEME_COOKIE = "siteTheme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; //1 year

const AUTH_STORAGE_KEY = "employeeAuth";
const ACCESS_CODE = "classtest";

let authOverlayEl = null;

const JOB_ASSIGNMENTS_KEY = "jobAssignments";

let EMPLOYEES = [];


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

function getAuthState() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch (err) {
        return null;
    }
}

function setAuthState(state) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

function clearAuthState() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

function updateAuthUI() {
    const auth = getAuthState();
    const isSignedIn = Boolean(auth && auth.email);

    document.querySelectorAll("[data-auth-link]").forEach((link) => {
        link.hidden = !isSignedIn;
        link.setAttribute("aria-hidden", String(!isSignedIn));
    });

    document.querySelectorAll("[data-auth-status]").forEach((status) => {
        status.hidden = !isSignedIn;
        status.textContent = isSignedIn ? `Signed in as ${auth.email}` : "";
    });

    document.querySelectorAll("[data-open-auth]").forEach((button) => {
        button.hidden = isSignedIn;
    });

    document.querySelectorAll("[data-sign-out]").forEach((button) => {
        button.hidden = !isSignedIn;
    });

    document.querySelectorAll("[data-auth-required]").forEach((alert) => {
        alert.style.display = isSignedIn ? "none" : "block";
    });
}

function openAuthModal() {
    if (!authOverlayEl) return;
    authOverlayEl.classList.add("show");
    authOverlayEl.setAttribute("aria-hidden", "false");

    const emailInput = authOverlayEl.querySelector("#authEmail");
    if (emailInput) {
        emailInput.focus();
    }
}

function closeAuthModal() {
    if (!authOverlayEl) return;
    authOverlayEl.classList.remove("show");
    authOverlayEl.setAttribute("aria-hidden", "true");
}

function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.elements.email.value.trim();
    const accessCode = form.elements.accessCode.value.trim();
    const feedback = form.querySelector("[data-auth-feedback]");

    if (!email || !accessCode) {
        if (feedback) {
            feedback.textContent = "Please fill in both fields.";
            feedback.className = "auth-feedback error";
        }
        return;
    }

    if (accessCode.toLowerCase() !== ACCESS_CODE) {
        if (feedback) {
            feedback.textContent = "That access code is incorrect. Try again or ask your supervisor for a new code.";
            feedback.className = "auth-feedback error";
        }
        return;
    }

    setAuthState({ email, signedInAt: new Date().toISOString() });
    updateAuthUI();

    if (feedback) {
        feedback.textContent = "Signed in! Redirecting you to the dashboard.";
        feedback.className = "auth-feedback success";
    }

    setTimeout(() => {
        closeAuthModal();
    }, 500);
}

function initAuth() {
    authOverlayEl = document.getElementById("authOverlay");
    const form = document.getElementById("authForm");
    const openButtons = document.querySelectorAll("[data-open-auth]");
    const closeButtons = document.querySelectorAll("[data-close-auth]");
    const signOutButtons = document.querySelectorAll("[data-sign-out]");

    openButtons.forEach((button) => button.addEventListener("click", openAuthModal));
    closeButtons.forEach((button) => button.addEventListener("click", closeAuthModal));

    if (authOverlayEl) {
        authOverlayEl.addEventListener("click", (event) => {
            if (event.target === authOverlayEl) {
                closeAuthModal();
            }
        });
    }

    if (form) {
        form.addEventListener("submit", handleAuthSubmit);
    }

    signOutButtons.forEach((button) => {
        button.addEventListener("click", () => {
            clearAuthState();
            updateAuthUI();
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAuthModal();
        }
    });

    updateAuthUI();
}

async function loadEmployees() {
    try {
        const response = await fetch("employees.php");
        if (!response.ok) {
            throw new Error("Failed to load employees");
        }

        const data = await response.json();
        const employees = Array.isArray(data.employees) ? data.employees : [];

        
        EMPLOYEES = employees.map(emp => ({
            id: String(emp.id),
            name: emp.name
        }));
    } catch (err) {
        console.error("Error loading employees:", err);
        EMPLOYEES = []; 
    }
}

async function initJobAssignments() {
    const tableBody = document.getElementById("jobTableBody");
    if (!tableBody) return;

    const statusEl = document.getElementById("jobAssignmentStatus");

    try {
        await loadEmployees();

        const response = await fetch("data/jobs.json");
        if (!response.ok) {
            throw new Error("Failed to load jobs.json");
        }

        const data = await response.json();
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];

        const storedAssignments = JSON.parse(
            localStorage.getItem(JOB_ASSIGNMENTS_KEY) || "{}"
        );

        tableBody.innerHTML = "";

        jobs.forEach((job) => {
            const tr = document.createElement("tr");

            const jobId = job.id;
            const project = job.project;
            const location = job.location;
            const shift = job.shift;
            const startDate = job.startDate;
            const priority = job.priority;
            const foreman = job.foreman;
            const scope = job.scope;

            tr.innerHTML = `
                <td>${jobId}</td>
                <td>${project}</td>
                <td>${location}</td>
                <td>${shift}</td>
                <td>${startDate}</td>
                <td>${priority}</td>
                <td>${foreman}</td>
                <td>${scope}</td>
                <td>
                    <select class="employee-select" data-job-id="${jobId}" multiple size="4">
                        ${EMPLOYEES.map(emp => `
                            <option value="${emp.id}">${emp.name}</option>
                        `).join("")}
                    </select>
                </td>
                <td>
                    <button type="button"
                            class="btn secondary assign-btn"
                            data-job-id="${jobId}">
                        Assign
                    </button>
                </td>
            `;

            tableBody.appendChild(tr);
        });

        //Apply saved assignments
        document.querySelectorAll(".employee-select").forEach((select) => {
            const jobId = select.getAttribute("data-job-id");
            const assigned = storedAssignments[jobId] || [];

            Array.from(select.options).forEach((opt) => {
                if (assigned.includes(opt.value)) {
                    opt.selected = true;
                }
            });
        });

        //Wire up Assign buttons
        document.querySelectorAll(".assign-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const jobId = btn.getAttribute("data-job-id");
                const select = document.querySelector(
                    `.employee-select[data-job-id="${jobId}"]`
                );
                if (!select) return;

                const selectedIds = Array.from(select.selectedOptions).map(
                    (opt) => opt.value
                );

                const assignments = JSON.parse(
                    localStorage.getItem(JOB_ASSIGNMENTS_KEY) || "{}"
                );
                assignments[jobId] = selectedIds;
                localStorage.setItem(
                    JOB_ASSIGNMENTS_KEY,
                    JSON.stringify(assignments)
                );

                if (statusEl) {
                    const names = EMPLOYEES
                        .filter((e) => selectedIds.includes(e.id))
                        .map((e) => e.name)
                        .join(", ") || "no one";

                    statusEl.textContent = `Assigned ${names} to job ${jobId}.`;
                }
            });
        });
    } catch (err) {
        console.error(err);
        if (statusEl) {
            statusEl.textContent =
                "Error loading jobs. Please refresh or try again later.";
        }
    }
}


function initApp() {
    initTheme();
    initAuth();
    initJobAssignments(); 
}

//Run when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
