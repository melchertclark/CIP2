# CIP2 Electron Application

CIP2 is a macOS-focused Electron application for visually managing JSON data structured around Fields of Interest (FoIs) and their associated Programs. It provides interactive, force-directed graph visualizations and inline editing capabilities, replacing manual JSON editing with an intuitive UI.

## Features

*   **Visual Graph Interface:** Uses D3.js force-directed layouts to display FoIs and Programs.
*   **Interactive Cards:** FoI and Program cards expand/collapse on click to reveal details. Card sizes and internal content scaling have been adjusted for readability.
*   **Inline Editing:** Edit Program details (name, degree, description, link) directly within fully expanded cards.
*   **Program Movement:** Change a Program's parent FoI via a dropdown menu.
*   **File Handling:** Opens user-selected JSON files on launch, validates against schema (PRD 4.2), saves changes explicitly or automatically on program moves.
*   **State Management:** Uses Redux Toolkit with integrated Undo/Redo functionality (`redux-undo`).
*   **Save on Close:** Prompts user to save unsaved changes before quitting.
*   **Search:** Filters FoI or Program graphs based on user input, highlighting matches.
*   **Styling:** Implements "Light Academia Minimalism" aesthetic (beige tones, dot grid backgrounds) as defined in the PRD.
*   **Keyboard Shortcuts:** Standard macOS shortcuts for Save (Cmd+S), Undo (Cmd+Z), Redo (Cmd+Shift+Z), and Escape key handling for collapsing views/cards.

## Getting Started

Prerequisites:

*   Node.js (>= 16)
*   npm (usually included with Node.js)

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
    *   `FoIGraph.tsx` / `ProgramGraph.tsx` – D3 graph visualization components
    *   `FoiCard.tsx` / `ProgramCard.tsx` – Individual node components with state handling
    *   `ExpandedFoiView.tsx` – View container for the program graph
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
*   **State Management & Layout:** Ensure card states (minimal, partial, full) and LIFO collapse behaviors work as expected. Check D3 physics behavior with current card sizes.
*   **Aesthetics/Styling:** Verify colors, fonts, grid backgrounds match the PRD. Check readability and responsiveness.
*   **Keyboard Shortcuts:** Verify Cmd/Ctrl+S, Cmd/Ctrl+Z, Cmd/Shift+Z/Ctrl+Y, and Esc key behaviors.

Refer to the `gemini-progress` document for a detailed breakdown of implemented features and known remaining refinements.

## Deployment

To create a distributable macOS application package (DMG):

```bash
npm run package
```

This command utilizes `electron-builder` (configured via `package.json`) to create optimized builds for both Apple Silicon (arm64) and Intel (x64) architectures, packaged into a single DMG file located in the `release/` directory.