# Playwright E2E Testing — Design Spec

**Date:** 2026-04-08  
**Project:** oh-my-rag-system  
**Status:** Approved

---

## Overview

Add Playwright E2E tests to the frontend, covering all core user flows. Tests run locally against the real docker-compose stack and in CI against a mocked backend (no external API keys required).

---

## Directory Structure

```
frontend/
├── e2e/
│   ├── fixtures/
│   │   └── mock-api.ts        # page.route() mock responses for CI
│   ├── page-load.spec.ts
│   ├── document-upload.spec.ts
│   ├── query-flow.spec.ts
│   ├── document-delete.spec.ts
│   └── error-states.spec.ts
├── playwright.config.ts
└── package.json               # updated with playwright deps and scripts
```

---

## Playwright Configuration

`playwright.config.ts` defines two projects selected via environment variable:

- **`local`** — runs against `http://localhost` (real docker-compose stack must be running)
- **`ci`** — starts Vite dev server on port 5173 and intercepts all API calls with `page.route()` mocks

```ts
projects: [
  {
    name: 'local',
    use: { baseURL: 'http://localhost' },
  },
  {
    name: 'ci',
    use: { baseURL: 'http://localhost:5173' },
    webServer: { command: 'npm run dev', port: 5173 },
  },
]
```

Environment variable `CI=true` selects the `ci` project automatically in GitHub Actions. Local default is `local`.

---

## Mock API Fixture

`e2e/fixtures/mock-api.ts` exports a `mockApi(page)` helper that registers `page.route()` handlers for all backend endpoints:

| Endpoint | Method | Mock response |
|----------|--------|---------------|
| `/documents` | GET | `[]` (empty list, overridable per test) |
| `/ingest` | POST | `{ job_id: "test-123" }` |
| `/query` | POST | `{ answer: "Test answer", sources: [] }` |
| `/documents/:id` | DELETE | `204 No Content` |

Individual tests can override specific routes to simulate error states.

---

## Test Cases

### `page-load.spec.ts`
- Brand name "Archive" is visible
- Empty-state heading "Ask anything about your archive" appears after load
- "Add Document" button is present in sidebar

### `document-upload.spec.ts`
- Clicking "Add Document" opens the upload modal
- Clicking the backdrop closes the modal
- Clicking the X button closes the modal
- Typing a URL and submitting: modal closes, document appears in sidebar

### `query-flow.spec.ts`
- Typing a question and pressing Enter shows thinking dots, then an answer
- When sources are present, the sources toggle button appears
- Clicking sources button expands/collapses source cards
- Two sequential queries produce 4 messages in the list
- Clear button appears after first query; clicking it empties the message list

### `document-delete.spec.ts`
- Hovering a document item reveals the delete button
- Clicking delete removes the document from the sidebar

### `error-states.spec.ts`
- `/query` returns 500 → "Could not reach the server. Is it running?" is shown
- `/ingest` returns network error → error message appears inside the modal

---

## npm Scripts

```json
"test:e2e":        "playwright test --project=local",
"test:e2e:ci":     "playwright test --project=ci",
"test:e2e:report": "playwright show-report"
```

---

## CI Integration

New `e2e` job added to `.github/workflows/ci-frontend.yml`, runs after `build`:

```yaml
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  needs: build
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: npm
        cache-dependency-path: frontend/package-lock.json
    - name: Install dependencies
      run: npm ci
      working-directory: frontend
    - name: Install Playwright browsers
      run: npx playwright install --with-deps chromium
      working-directory: frontend
    - name: Run E2E tests (CI mode)
      run: npm run test:e2e:ci
      working-directory: frontend
    - name: Upload test report
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report
        path: frontend/playwright-report/
```

On failure, the HTML report is uploaded as a CI artifact for debugging.

---

## Local Usage

```bash
# Prerequisites: docker-compose must be running
docker-compose up -d

# Run E2E tests against real stack
cd frontend && npm run test:e2e

# Open HTML report after a run
npm run test:e2e:report
```

---

## Dependencies Added

- `@playwright/test` — test runner and browser automation
- Chromium only (no Firefox/WebKit) to keep CI fast and install size small
