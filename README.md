# Construction Solutions Website

This repository contains a static marketing site for a construction company with an employee-facing dashboard. The site includes themed marketing pages, quote and contact forms, and a lightweight employee sign-in flow that reveals staff-only navigation once authenticated.

## Project Structure
- `index.html` – Landing page with service overview, CTA buttons, and theme toggle.
- `services.html`, `projects.html`, `contact.html`, `quote.html` – Supporting marketing pages with shared navigation and footer.
- `employee-dashboard.html` – Employee-only area surfaced after sign-in with quick links, checklists, updates, and job assignment tools.
- `style.css` – Global styling, responsive layout rules, theme support, and modal styling.
- `script.js` – Handles theme toggling, form enhancements, sign-in modal behavior, and dynamic navigation state.
- `submit.php` – Server-side handler stub for form submissions.
- `data/jobs.json` – Static data source that feeds the AJAX-driven job assignment list on the employee dashboard.
- `data/employees.json` – Roster used to populate the job assignment employee selector.

## Running the Site
Because the project is a static website, you can open `index.html` directly in a browser. For consistent relative-link behavior, you can also serve the directory with any static server:

```bash
python3 -m http.server 8000
# Then visit http://localhost:8000/
```

## Employee Sign-In
Use the "Employee" button in the site navigation to open the sign-in modal. After providing credentials (stored locally in the browser for demo purposes), the "Employee Dashboard" link becomes visible across the site and grants access to `employee-dashboard.html`. A status badge on the button indicates whether you are signed in or signed out.

## Development Notes
- The theme toggle persists the selected mode using local storage.
- Form inputs include basic client-side enhancements but server handling is minimal and should be expanded before production use.
- Authentication is front-end only and intended for demonstration; replace with a secure backend before deploying to a live environment.
- Job assignments load via AJAX from `data/jobs.json` and post to `submit.php`; responses are cached locally to support offline-first behavior.
- Employee selections for assignments are pulled from `data/employees.json` via AJAX and auto-fill the name/email fields to speed dispatch requests.

## Contributing
1. Fork the repository and create a feature branch.
2. Make your changes and ensure pages render correctly in the browser.
3. Submit a pull request with a clear summary of updates and any testing performed.
