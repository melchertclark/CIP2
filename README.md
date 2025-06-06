# CIP2 Electron Application

CIP2 is a macOS-focused Electron application for visually managing JSON data structured around Fields of Interest (FoIs) and their associated Programs. It provides an interactive, nested collapsible card interface and inline editing capabilities, replacing manual JSON editing with an intuitive UI.

## Quick Guide: Create a macOS Desktop App

Non-technical users can quickly build and install a native macOS application bundle for CIP2 by following these steps:

1. **Install Node.js & npm**  
   Download and install Node.js (which includes npm) from https://nodejs.org/ if you haven't already.

2. **Install dependencies**  
   Open Terminal, navigate to this repository folder, and run:
   ```bash
   npm install
   ```

3. **Package the app**  
   ```bash
   npm run package
   ```

4. **Install the app**  
   After the build completes, open the generated `.dmg` file in the `release/` directory and drag the `CIP2.app` into your Applications folder (or onto your Desktop).

5. **Launch**  
   Open CIP2 from Launchpad, Spotlight, or by double-clicking the app icon.

## Features

*   **Nested Collapsible Cards Interface:** Renders FoIs and Programs as nested, collapsible cards for improved readability and simplicity.
*   **Interactive Cards:** FoI and Program cards expand/collapse on click to reveal details. Card sizes and internal content scaling have been adjusted for readability.
*   **Inline Editing:** Edit Program details (name, degree, description, link) directly within fully expanded cards.
*   **Program Movement:** Change a Program's parent FoI via a dropdown menu.
*   **File Handling:** Opens user-selected JSON files on launch, validates against schema (PRD 4.2), saves changes explicitly or automatically on program moves.
*   **State Management:** Uses Redux Toolkit with integrated Undo/Redo functionality (`redux-undo`).
*   **Save on Close:** Prompts user to save unsaved changes before quitting.
*   **Search:** Filters displayed FoI and Program cards based on user input, highlighting matches.
*   **Styling:** Implements "Light Academia Minimalism" aesthetic (beige tones, dot grid backgrounds) as defined in the PRD.
*   **Keyboard Shortcuts:** Standard macOS shortcuts for Save (Cmd+S), Undo (Cmd+Z), Redo (Cmd+Shift+Z), and Escape key handling for collapsing views/cards.
*   **Export to Word (.docx):** Generate a variation list document (population & programs) using a Jinja-enabled Word template (`docxtpl`) via the new "Export FOI to Word" button. Only FoIs and Programs toggled **included: true** will be included in the exported table. When a CIP2 JSON file is loaded, its filename (without the `.json` extension) is passed to the Python helper and used to populate the `{{ school }}` placeholder in the template.
  
### Word Template: Table Loop Setup

To have the FOI entries rendered into a Word table, your `.docx` template must include an actual Word table with Jinja loop markers. For example:

| Rank | FOI | Programs |
|:---:|:----|:-------------------------|
| {% for entry in foi_entries %} | | |
| {{ entry.rank }} | {{ entry.foi_name }} | {{ entry.programs | join('; ') }} |
| {% endfor %} | | |

Make sure that:
1. The `{% for entry in foi_entries %}` and `{% endfor %}` tags each occupy their own table row in the first column.
2. The placeholder expressions (`{{ entry.rank }}`, etc.) are in the corresponding cells of the template row.
3. Save this table in your `.docx` template before exporting via the “Export FOI to Word” button.

This allows **docxtpl** to duplicate the template row for each entry in `foi_entries`.

**Note:** The export script now configures Jinja2 to trim whitespace around loop tags and automatically removes any table rows containing only empty cells, eliminating extra blank rows. If you still see spacing issues, you can also use Jinja whitespace-control tags in your template, for example:

```jinja
{%- for entry in foi_entries -%}
| {{ entry.rank }} | {{ entry.foi_name }} | {{ entry.programs | join('; ') }} |
{%- endfor -%}
```
## Getting Started

Prerequisites:

*   Node.js (>= 16)
*   npm (usually included with Node.js)
*   Python 3
*   docxtpl (install via `pip install docxtpl`)

Install dependencies:

```bash
npm install
```

Run in development mode (with hot-reloading for the renderer process):

```bash
npm run dev
```

## Project Structure

*   `src/main.ts` – Electron main process (file handling, validation, quit logic)
*   `src/preload.ts` – Preload script exposing secure IPC APIs
*   `src/renderer/` – React renderer process (UI)
    *   `App.tsx` – Root component, handles layout, top bar, view switching
    *   `CollapsibleCardsView.tsx` – Nested collapsible card interface for FoIs and Programs
    *   `FoiCard.tsx` / `ProgramCard.tsx` – Individual card components with state handling
    *   `HighlightText.tsx` - Utility for search highlighting
    *   `store.ts` – Redux store setup with `redux-undo`
    *   `index.tsx`, `index.html`, `global.css`
*   `PRD` – Product Requirements Document detailing features and specifications.
*   `gemini-progress` – Detailed build log and current project status.

## Testing

The application implements most features from the PRD. Testing should focus on:

*   **Core Interactions:** Opening files, expanding/collapsing FoI and Program cards, inline editing, saving.
*   **Undo/Redo:** Verify undo/redo works correctly for all data modifications (toggles, text edits, program moves). Pay special attention to the interaction between moving a program (which auto-saves) and the undo stack.
*   **Save on Close:** Test the prompt logic thoroughly (quitting with/without changes, saving/discarding/canceling).
*   **Search:** Verify filtering works correctly in both FoI and Program views. Check highlighting.
*   **Validation & Error Handling:** Test loading valid, invalid (schema errors, invalid JSON), and edge-case (empty, missing optional fields) files. Check error/warning messages.
*   **State Management & Layout:** Ensure card collapse/expand states and LIFO behaviors work as expected.
*   **Aesthetics/Styling:** Verify colors, fonts, grid backgrounds match the PRD. Check readability and responsiveness.
*   **Keyboard Shortcuts:** Verify Cmd/Ctrl+S, Cmd/Ctrl+Z, Cmd/Shift+Z/Ctrl+Y, and Esc key behaviors.

Refer to the `gemini-progress` document for a detailed breakdown of implemented features and known remaining refinements.

## Deployment

To create a distributable macOS application package (DMG):

```bash
npm run package
```

This command utilizes `electron-builder` (configured via `package.json`) to create optimized builds for both Apple Silicon (arm64) and Intel (x64) architectures, packaged into a single DMG file located in the `release/` directory.

## Publishing to GitLab

To push this repository to the private GitLab instance at https://gitlab.devops.eab.com/CMelchert/cip2.1, follow these steps:

### Prerequisites

- Ensure you are connected to your corporate network (VPN) so you can access the GitLab server.
- You have been granted access to the `CMelchert/cip2.1` project.

### 1. Add your SSH key to GitLab

If you don’t already have an SSH key on this machine, generate one with:
```bash
ssh-keygen -t ed25519 -C "your.email@domain.com"
```
Copy the public key to your clipboard and add it in GitLab under **Profile ▶ Settings ▶ SSH Keys**:
```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

### 2. (Alternative) Create a Personal Access Token

If you prefer HTTPS or need API access, create a Personal Access Token in GitLab under **Profile ▶ Settings ▶ Access Tokens**, granting `read_repository` and `write_repository` scopes. Store it securely (e.g. via the macOS Keychain).

### 3. Configure the Git remote

In this repository, add the GitLab remote (using SSH or HTTPS):
```bash
# SSH (recommended)
git remote add origin git@gitlab.devops.eab.com:CMelchert/cip2.1.git

# HTTPS (if using a Personal Access Token)
git remote add origin https://gitlab.devops.eab.com/CMelchert/cip2.1.git
```

### 4. Push your changes

Commit any local changes, then push the `main` branch:
```bash
git push -u origin main
```

If you encounter permission errors, verify your access rights in GitLab or contact your repository administrator.