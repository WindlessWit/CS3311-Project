//Theme Toggle System with Cookie Storage
const THEME_COOKIE = "siteTheme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; //1 year

const AUTH_STORAGE_KEY = "employeeAuth";
const ACCESS_CODE = "buildsafe";
const JOBS_ENDPOINT = "data/jobs.json";
const EMPLOYEES_ENDPOINT = "data/employees.json";
const ASSIGN_ENDPOINT = "submit.php";
const ASSIGN_STORAGE_KEY = "employeeAssignments";

let authOverlayEl = null;
let jobDataCache = [];
let employeeDataCache = [];
let assignmentLog = [];

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

function getTodayISO() {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const local = new Date(today.getTime() - offset * 60 * 1000);
    return local.toISOString().split("T")[0];
}

function loadAssignmentLog() {
    try {
        const raw = localStorage.getItem(ASSIGN_STORAGE_KEY);
        assignmentLog = raw ? JSON.parse(raw) : [];
    } catch (error) {
        assignmentLog = [];
    }
}

function persistAssignmentLog() {
    localStorage.setItem(ASSIGN_STORAGE_KEY, JSON.stringify(assignmentLog));
}

function renderJobCount(countEl) {
    if (!countEl) return;
    const count = jobDataCache.length;
    countEl.textContent = count ? `${count} open jobs` : "No jobs loaded";
}

function renderJobSelect(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = "";

    if (!jobDataCache.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No jobs available";
        selectEl.appendChild(option);
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a job";
    selectEl.appendChild(placeholder);

    jobDataCache.forEach((job) => {
        const option = document.createElement("option");
        option.value = job.id;
        option.textContent = `${job.id} — ${job.project} (${job.location})`;
        option.dataset.shift = job.shift;
        option.dataset.start = job.startDate;
        selectEl.appendChild(option);
    });
}

function renderEmployeeSelect(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = "";

    if (!employeeDataCache.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No employees available";
        selectEl.appendChild(option);
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose an employee";
    selectEl.appendChild(placeholder);

    employeeDataCache.forEach((employee) => {
        const option = document.createElement("option");
        option.value = employee.id;
        option.textContent = `${employee.name} — ${employee.role}`;
        option.dataset.email = employee.email;
        option.dataset.name = employee.name;
        selectEl.appendChild(option);
    });
}

function renderFilterOptions(locationSelect) {
    if (!locationSelect) return;
    const locations = Array.from(new Set(jobDataCache.map((job) => job.location)));
    locationSelect.innerHTML = '<option value="">All locations</option>';

    locations.forEach((loc) => {
        const option = document.createElement("option");
        option.value = loc;
        option.textContent = loc;
        locationSelect.appendChild(option);
    });
}

function renderJobList(listEl, filters = {}) {
    if (!listEl) return;
    listEl.innerHTML = "";

    const filtered = jobDataCache.filter((job) => {
        const shiftMatch = !filters.shift || job.shift === filters.shift;
        const locationMatch = !filters.location || job.location === filters.location;
        return shiftMatch && locationMatch;
    });

    if (!filtered.length) {
        const li = document.createElement("li");
        li.className = "job-row muted";
        li.textContent = "No jobs match the current filters.";
        listEl.appendChild(li);
        return;
    }

    filtered.forEach((job) => {
        const li = document.createElement("li");
        li.className = "job-row";

        const heading = document.createElement("div");
        heading.className = "job-meta";
        heading.innerHTML = `<strong>${job.project}</strong><span class="badge">${job.id}</span><span class="badge neutral">${job.location}</span>`;
        li.appendChild(heading);

        const details = document.createElement("p");
        details.className = "muted";
        details.textContent = job.scope;
        li.appendChild(details);

        const meta = document.createElement("div");
        meta.className = "job-meta";
        meta.innerHTML = `<small>Shift: ${job.shift}</small><small>Start: ${job.startDate}</small><small>Foreman: ${job.foreman}</small><small>Priority: ${job.priority}</small>`;
        li.appendChild(meta);

        listEl.appendChild(li);
    });
}

function renderAssignmentLog(logEl) {
    if (!logEl) return;
    logEl.innerHTML = "";

    if (!assignmentLog.length) {
        const empty = document.createElement("li");
        empty.className = "job-row muted";
        empty.textContent = "No submissions yet.";
        logEl.appendChild(empty);
        return;
    }

    assignmentLog.forEach((entry) => {
        const li = document.createElement("li");
        li.className = "job-row";
        li.innerHTML = `<div class="job-meta"><strong>${entry.jobId} — ${entry.project}</strong><span class="badge neutral">${entry.shift}</span></div>
        <p class="muted">${entry.notes || "No notes provided"}</p>
        <div class="job-meta"><small>${entry.name} · ${entry.email}</small><small>Start: ${entry.startDate}</small><small>Submitted: ${new Date(entry.submittedAt).toLocaleString()}</small></div>`;
        logEl.appendChild(li);
    });
}

async function fetchJobData({ listEl, selectEl, countEl, filterEls }) {
    if (listEl) {
        listEl.innerHTML = '<li class="job-row loading">Fetching jobs…</li>';
    }

    try {
        const response = await fetch(JOBS_ENDPOINT, { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load jobs");
        const data = await response.json();
        jobDataCache = Array.isArray(data.jobs) ? data.jobs : [];
    } catch (error) {
        jobDataCache = [];
        if (listEl) {
            listEl.innerHTML = '<li class="job-row muted">Could not load jobs right now. Check your connection.</li>';
        }
        renderJobCount(countEl);
        renderJobSelect(selectEl);
        renderFilterOptions(filterEls?.location);
        return;
    }

    renderJobCount(countEl);
    renderJobSelect(selectEl);
    renderFilterOptions(filterEls?.location);
    renderJobList(listEl, {
        shift: filterEls?.shift?.value,
        location: filterEls?.location?.value,
    });
}

async function fetchEmployeeData(selectEl) {
    if (selectEl) {
        selectEl.innerHTML = '<option value="">Loading employees…</option>';
    }

    try {
        const response = await fetch(EMPLOYEES_ENDPOINT, { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load employees");
        const data = await response.json();
        employeeDataCache = Array.isArray(data.employees) ? data.employees : [];
    } catch (error) {
        employeeDataCache = [];
    }

    renderEmployeeSelect(selectEl);
}

async function submitAssignment(form, feedbackEl) {
    const formData = new FormData(form);
    const jobId = formData.get("jobId");
    const job = jobDataCache.find((item) => item.id === jobId);
    const submission = {
        employeeId: formData.get("employeeId") || "",
        name: formData.get("name")?.trim() || "",
        email: formData.get("email")?.trim() || "",
        jobId,
        shift: formData.get("shift") || job?.shift || "",
        startDate: formData.get("startDate") || job?.startDate || getTodayISO(),
        notes: formData.get("notes")?.trim() || "",
        project: job?.project || "",
    };

    if (!submission.employeeId || !submission.name || !submission.email || !submission.jobId || !submission.shift || !submission.startDate) {
        if (feedbackEl) {
            feedbackEl.textContent = "Please complete all required fields.";
            feedbackEl.className = "auth-feedback error";
        }
        return false;
    }

    if (feedbackEl) {
        feedbackEl.textContent = "Submitting via AJAX…";
        feedbackEl.className = "auth-feedback";
    }

    try {
        const payload = new URLSearchParams(submission);
        const response = await fetch(ASSIGN_ENDPOINT, {
            method: "POST",
            body: payload,
        });

        if (!response.ok) {
            throw new Error("Dispatch did not accept the request");
        }

        return true;
    } catch (error) {
        if (feedbackEl) {
            feedbackEl.textContent = "Saved locally while offline. Dispatch will pick this up when back online.";
            feedbackEl.className = "auth-feedback error";
        }
        return false;
    }
}

function saveAssignment(submission) {
    assignmentLog.unshift({ ...submission, submittedAt: new Date().toISOString() });
    assignmentLog = assignmentLog.slice(0, 8);
    persistAssignmentLog();
}

function initAssignments() {
    const assignmentForm = document.getElementById("assignmentForm");
    const jobListEl = document.querySelector("[data-job-list]");
    const jobSelectEl = document.querySelector("[data-job-select]");
    const employeeSelectEl = document.querySelector("[data-employee-select]");
    const jobCountEl = document.querySelector("[data-job-count]");
    const feedbackEl = document.querySelector("[data-assign-feedback]");
    const filterShiftEl = document.querySelector("[data-filter-shift]");
    const filterLocationEl = document.querySelector("[data-filter-location]");
    const assignmentLogEl = document.querySelector("[data-assignment-log]");
    const clearLogBtn = document.querySelector("[data-clear-assignments]");
    const refreshBtn = document.querySelector("[data-refresh-jobs]");
    const startDateEl = document.getElementById("startDate");

    loadAssignmentLog();
    renderAssignmentLog(assignmentLogEl);

    if (startDateEl) {
        startDateEl.min = getTodayISO();
        startDateEl.value = getTodayISO();
    }

    const auth = getAuthState();
    if (auth?.email) {
        const emailField = document.getElementById("assignEmail");
        if (emailField && !emailField.value) {
            emailField.value = auth.email;
        }
    }

    fetchJobData({
        listEl: jobListEl,
        selectEl: jobSelectEl,
        countEl: jobCountEl,
        filterEls: { shift: filterShiftEl, location: filterLocationEl },
    });
    fetchEmployeeData(employeeSelectEl).then(() => {
        if (auth?.email && employeeSelectEl) {
            const match = employeeDataCache.find((person) => person.email === auth.email);
            if (match) {
                employeeSelectEl.value = match.id;
                employeeSelectEl.dispatchEvent(new Event("change"));
            }
        }
    });

    refreshBtn?.addEventListener("click", () => {
        fetchJobData({
            listEl: jobListEl,
            selectEl: jobSelectEl,
            countEl: jobCountEl,
            filterEls: { shift: filterShiftEl, location: filterLocationEl },
        });
    });

    [filterShiftEl, filterLocationEl].forEach((filterEl) => {
        filterEl?.addEventListener("change", () => {
            renderJobList(jobListEl, {
                shift: filterShiftEl?.value,
                location: filterLocationEl?.value,
            });
        });
    });

    clearLogBtn?.addEventListener("click", () => {
        assignmentLog = [];
        persistAssignmentLog();
        renderAssignmentLog(assignmentLogEl);
    });

    jobSelectEl?.addEventListener("change", (event) => {
        const selected = event.target.options[event.target.selectedIndex];
        if (selected?.dataset.start && startDateEl && !startDateEl.value) {
            startDateEl.value = selected.dataset.start;
        }
        if (selected?.dataset.shift) {
            const shift = selected.dataset.shift;
            if (shift && filterShiftEl) filterShiftEl.value = "";
            const shiftInput = document.getElementById("shiftSelect");
            if (shiftInput && !shiftInput.value) {
                shiftInput.value = shift;
            }
        }
    });

    employeeSelectEl?.addEventListener("change", (event) => {
        const selected = event.target.options[event.target.selectedIndex];
        const nameInput = document.getElementById("assignName");
        const emailInput = document.getElementById("assignEmail");

        if (selected?.dataset.name && nameInput) {
            nameInput.value = selected.dataset.name;
        }

        if (selected?.dataset.email && emailInput) {
            emailInput.value = selected.dataset.email;
        }
    });

    assignmentForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = assignmentForm.querySelector("[data-submit-assignment]");
        submitButton?.setAttribute("disabled", "true");

        const success = await submitAssignment(assignmentForm, feedbackEl);
        const formData = new FormData(assignmentForm);
        const job = jobDataCache.find((item) => item.id === formData.get("jobId"));
        const submission = {
            name: formData.get("name")?.trim() || "",
            email: formData.get("email")?.trim() || "",
            employeeId: formData.get("employeeId") || "",
            jobId: formData.get("jobId") || "",
            shift: formData.get("shift") || job?.shift || "",
            startDate: formData.get("startDate") || job?.startDate || getTodayISO(),
            notes: formData.get("notes")?.trim() || "",
            project: job?.project || "",
        };

        if (submission.jobId) {
            saveAssignment(submission);
            renderAssignmentLog(assignmentLogEl);
        }

        if (success && feedbackEl) {
            feedbackEl.textContent = "Assignment sent! Dispatch has your request.";
            feedbackEl.className = "auth-feedback success";
        }

        assignmentForm.reset();
        if (startDateEl) startDateEl.value = getTodayISO();
        submitButton?.removeAttribute("disabled");
    });
}

function initApp() {
    initTheme();
    initAuth();

    if (document.getElementById("assignments")) {
        initAssignments();
    }
}

//Run when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
