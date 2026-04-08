# Playwright E2E Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright E2E tests covering all core user flows, running locally against the real docker-compose stack and in CI against a mocked backend.

**Architecture:** Playwright lives inside `frontend/` as a second test layer alongside Vitest. A `playwright.config.ts` defines two projects — `local` (real backend) and `ci` (Vite dev server + `page.route()` mocks). A shared `mockApi()` helper in `e2e/fixtures/mock-api.ts` intercepts all API calls in CI mode. Each spec file owns one user flow.

**Tech Stack:** `@playwright/test` ^1.44, Chromium only, TypeScript, existing Vite dev server for CI mode.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/playwright.config.ts` | Two projects (local/ci), webServer for CI mode |
| Modify | `frontend/package.json` | Add `@playwright/test` dep + 3 new scripts |
| Create | `frontend/e2e/fixtures/mock-api.ts` | `mockApi(page, opts)` — `page.route()` for all endpoints |
| Create | `frontend/e2e/page-load.spec.ts` | Initial render, empty state, sidebar |
| Create | `frontend/e2e/document-upload.spec.ts` | Modal open/close, successful ingest flow |
| Create | `frontend/e2e/query-flow.spec.ts` | Send query, answer, sources toggle, Clear |
| Create | `frontend/e2e/document-delete.spec.ts` | Hover reveal, delete removes from list |
| Create | `frontend/e2e/error-states.spec.ts` | 500 on query, network error on ingest |
| Modify | `.github/workflows/ci-frontend.yml` | Add `e2e` job after `build` |

---

## Task 1: Install Playwright and create config

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/playwright.config.ts`

- [ ] **Step 1: Install `@playwright/test`**

```bash
cd frontend
npm install -D @playwright/test
npx playwright install chromium
```

Expected: `chromium` downloads and installs successfully.

- [ ] **Step 2: Add scripts to `package.json`**

In `frontend/package.json`, add to `"scripts"`:

```json
"test:e2e":        "playwright test --project=local",
"test:e2e:ci":     "USE_MOCK=true playwright test --project=ci",
"test:e2e:report": "playwright show-report"
```

- [ ] **Step 3: Create `frontend/playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test'

const USE_MOCK = !!process.env.CI || !!process.env.USE_MOCK

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'local',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost',
      },
    },
    {
      name: 'ci',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
    },
  ],
  webServer: USE_MOCK
    ? {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: true,
      }
    : undefined,
})
```

- [ ] **Step 4: Verify Playwright can find the config**

```bash
cd frontend
npx playwright test --list --project=ci 2>&1 | head -5
```

Expected: output mentions "No tests found" or lists 0 tests (config is valid, no spec files yet).

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/playwright.config.ts
git commit -m "feat: install Playwright and add config with local/ci projects"
git push
```

---

## Task 2: Create mock-api fixture

**Files:**
- Create: `frontend/e2e/fixtures/mock-api.ts`

- [ ] **Step 1: Create the fixtures directory and `mock-api.ts`**

```bash
mkdir -p frontend/e2e/fixtures
```

Create `frontend/e2e/fixtures/mock-api.ts`:

```typescript
import { Page } from '@playwright/test'

export interface MockOptions {
  /** Documents returned by GET /documents. Default: [] */
  documents?: Array<{ id: string; source: string; chunk_count: number }>
  /** Answer text returned by POST /query. Default: 'Test answer from mock' */
  queryAnswer?: string
  /** Sources returned by POST /query. Default: [] */
  querySources?: Array<{
    document_id: string
    content: string
    level: string
    metadata: Record<string, string>
  }>
  /** If true, POST /ingest aborts (network error). Default: false */
  ingestError?: boolean
  /** If true, POST /query returns HTTP 500. Default: false */
  queryError?: boolean
}

/**
 * Registers page.route() handlers that intercept all backend API calls.
 * Call this before page.goto() in each test that runs in CI mode.
 */
export async function mockApi(page: Page, opts: MockOptions = {}) {
  // DELETE /documents/:id  (regex to avoid matching GET /documents)
  await page.route(/\/documents\/.+/, route =>
    route.fulfill({ status: 204, body: '' })
  )

  // GET /documents
  await page.route('/documents', route =>
    route.fulfill({ json: opts.documents ?? [] })
  )

  // POST /ingest
  await page.route('/ingest', route => {
    if (opts.ingestError) return route.abort()
    return route.fulfill({ json: { job_id: 'test-123' } })
  })

  // POST /query
  await page.route('/query', route => {
    if (opts.queryError) {
      return route.fulfill({ status: 500, body: 'Internal Server Error' })
    }
    return route.fulfill({
      json: {
        answer: opts.queryAnswer ?? 'Test answer from mock',
        sources: opts.querySources ?? [],
      },
    })
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/e2e/fixtures/mock-api.ts
git commit -m "feat: add mockApi fixture for Playwright CI mode"
git push
```

---

## Task 3: page-load spec

**Files:**
- Create: `frontend/e2e/page-load.spec.ts`

- [ ] **Step 1: Create `frontend/e2e/page-load.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures/mock-api'

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test('shows brand name "Archive"', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Archive').first()).toBeVisible()
})

test('shows empty-state heading after documents load', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Ask anything about your archive')).toBeVisible()
})

test('shows "Add Document" button in sidebar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Add Document')).toBeVisible()
})
```

- [ ] **Step 2: Run spec in CI mode and verify all 3 pass**

```bash
cd frontend
npm run test:e2e:ci -- e2e/page-load.spec.ts
```

Expected output:
```
✓  page-load.spec.ts:7 › shows brand name "Archive" (Xms)
✓  page-load.spec.ts:12 › shows empty-state heading after documents load (Xms)
✓  page-load.spec.ts:17 › shows "Add Document" button in sidebar (Xms)
3 passed
```

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/page-load.spec.ts
git commit -m "test(e2e): add page-load spec"
git push
```

---

## Task 4: document-upload spec

**Files:**
- Create: `frontend/e2e/document-upload.spec.ts`

- [ ] **Step 1: Create `frontend/e2e/document-upload.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures/mock-api'

test('clicking "Add Document" opens the upload modal', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.getByText('Add Document').click()
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).toBeVisible()
})

test('clicking the backdrop closes the modal', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.getByText('Add Document').click()
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).toBeVisible()

  await page.getByTestId('modal-backdrop').click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).not.toBeVisible()
})

test('clicking the X button closes the modal', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.getByText('Add Document').click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).not.toBeVisible()
})

test('submitting a URL ingests it and shows the document in sidebar', async ({ page }) => {
  // Start with empty docs; after upload mock returns the new document
  let uploadDone = false
  await page.route('/documents', route =>
    route.fulfill({
      json: uploadDone
        ? [{ id: 'doc1', source: '/path/to/example-page.html', chunk_count: 4 }]
        : [],
    })
  )
  await page.route('/ingest', route => {
    uploadDone = true
    return route.fulfill({ json: { job_id: 'test-123' } })
  })

  await page.goto('/')
  await page.getByText('Add Document').click()
  await page.getByRole('textbox').fill('https://example.com/page')
  await page.getByRole('button', { name: 'Add to Archive' }).click()

  // Modal closes
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).not.toBeVisible()

  // Document appears in sidebar (app calls loadDocs after 800ms)
  await expect(page.getByText('example-page.html')).toBeVisible({ timeout: 3000 })
})
```

- [ ] **Step 2: Run spec in CI mode and verify all 4 pass**

```bash
cd frontend
npm run test:e2e:ci -- e2e/document-upload.spec.ts
```

Expected: `4 passed`

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/document-upload.spec.ts
git commit -m "test(e2e): add document-upload spec"
git push
```

---

## Task 5: query-flow spec

**Files:**
- Create: `frontend/e2e/query-flow.spec.ts`

- [ ] **Step 1: Create `frontend/e2e/query-flow.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures/mock-api'

test('typing a question and pressing Enter shows an answer', async ({ page }) => {
  await mockApi(page, { queryAnswer: 'RAG stands for Retrieval-Augmented Generation.' })
  await page.goto('/')

  await page.getByLabel('Query input').fill('What is RAG?')
  await page.keyboard.press('Enter')

  await expect(page.getByText('RAG stands for Retrieval-Augmented Generation.')).toBeVisible()
  await expect(page.getByText('What is RAG?')).toBeVisible()
})

test('shows sources toggle button when sources are present', async ({ page }) => {
  await mockApi(page, {
    querySources: [{
      document_id: 'doc-abc',
      content: 'Source content about RAG.',
      level: 'chunk',
      metadata: { source: '/docs/rag-overview.md' },
    }],
  })
  await page.goto('/')

  await page.getByLabel('Query input').fill('What is RAG?')
  await page.keyboard.press('Enter')

  await expect(page.getByText(/1 source/)).toBeVisible()
})

test('clicking sources button expands and collapses source cards', async ({ page }) => {
  await mockApi(page, {
    querySources: [{
      document_id: 'doc-abc',
      content: 'Source content about RAG.',
      level: 'chunk',
      metadata: { source: '/docs/rag-overview.md' },
    }],
  })
  await page.goto('/')

  await page.getByLabel('Query input').fill('What is RAG?')
  await page.keyboard.press('Enter')

  const sourcesBtn = page.getByText(/1 source/)
  await expect(sourcesBtn).toBeVisible()

  // Expand
  await sourcesBtn.click()
  await expect(page.getByText('rag-overview.md')).toBeVisible()

  // Collapse
  await sourcesBtn.click()
  await expect(page.getByText('rag-overview.md')).not.toBeVisible()
})

test('two sequential queries produce 4 messages', async ({ page }) => {
  await mockApi(page, { queryAnswer: 'Answer' })
  await page.goto('/')

  for (const question of ['First question', 'Second question']) {
    await page.getByLabel('Query input').fill(question)
    await page.keyboard.press('Enter')
    await expect(page.getByText('Answer').last()).toBeVisible()
  }

  // 2 user + 2 assistant = 4 messages
  await expect(page.getByText('First question')).toBeVisible()
  await expect(page.getByText('Second question')).toBeVisible()
  await expect(page.getByText('Answer')).toHaveCount(2)
})

test('Clear button appears after first query and empties message list', async ({ page }) => {
  await mockApi(page, { queryAnswer: 'Some answer' })
  await page.goto('/')

  await page.getByLabel('Query input').fill('Hello')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Some answer')).toBeVisible()

  await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear' }).click()

  await expect(page.getByText('Ask anything about your archive')).toBeVisible()
  await expect(page.getByText('Hello')).not.toBeVisible()
})
```

- [ ] **Step 2: Run spec in CI mode and verify all 5 pass**

```bash
cd frontend
npm run test:e2e:ci -- e2e/query-flow.spec.ts
```

Expected: `5 passed`

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/query-flow.spec.ts
git commit -m "test(e2e): add query-flow spec"
git push
```

---

## Task 6: document-delete spec

**Files:**
- Create: `frontend/e2e/document-delete.spec.ts`

- [ ] **Step 1: Create `frontend/e2e/document-delete.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures/mock-api'

const DOC = { id: 'doc1', source: '/path/to/notes.md', chunk_count: 5 }

test('hovering a document reveals the delete button', async ({ page }) => {
  await mockApi(page, { documents: [DOC] })
  await page.goto('/')

  const docName = page.getByText('notes.md')
  await expect(docName).toBeVisible()

  await docName.hover()
  await expect(page.getByRole('button', { name: 'Delete document' })).toBeVisible()
})

test('clicking delete removes the document from the sidebar', async ({ page }) => {
  await mockApi(page, { documents: [DOC] })
  await page.goto('/')

  await expect(page.getByText('notes.md')).toBeVisible()

  await page.getByText('notes.md').hover()
  await page.getByRole('button', { name: 'Delete document' }).click()

  await expect(page.getByText('notes.md')).not.toBeVisible()
  await expect(page.getByText('No documents yet.')).toBeVisible()
})
```

- [ ] **Step 2: Run spec in CI mode and verify both tests pass**

```bash
cd frontend
npm run test:e2e:ci -- e2e/document-delete.spec.ts
```

Expected: `2 passed`

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/document-delete.spec.ts
git commit -m "test(e2e): add document-delete spec"
git push
```

---

## Task 7: error-states spec

**Files:**
- Create: `frontend/e2e/error-states.spec.ts`

- [ ] **Step 1: Create `frontend/e2e/error-states.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures/mock-api'

test('shows error message when query API returns 500', async ({ page }) => {
  await mockApi(page, { queryError: true })
  await page.goto('/')

  await page.getByLabel('Query input').fill('Will this work?')
  await page.keyboard.press('Enter')

  await expect(page.getByText('Could not reach the server. Is it running?')).toBeVisible()
})

test('shows error inside modal when ingest fails with network error', async ({ page }) => {
  await mockApi(page, { ingestError: true })
  await page.goto('/')

  await page.getByText('Add Document').click()
  await page.getByRole('textbox').fill('https://example.com/bad')
  await page.getByRole('button', { name: 'Add to Archive' }).click()

  await expect(page.getByText('Failed to ingest. Check the path or URL.')).toBeVisible()
  // Modal stays open on error
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).toBeVisible()
})
```

- [ ] **Step 2: Run spec in CI mode and verify both tests pass**

```bash
cd frontend
npm run test:e2e:ci -- e2e/error-states.spec.ts
```

Expected: `2 passed`

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/error-states.spec.ts
git commit -m "test(e2e): add error-states spec"
git push
```

---

## Task 8: CI workflow update and full suite verification

**Files:**
- Modify: `.github/workflows/ci-frontend.yml`

- [ ] **Step 1: Run the full E2E suite in CI mode locally to confirm green**

```bash
cd frontend
npm run test:e2e:ci
```

Expected: `16 passed` (3 + 4 + 5 + 2 + 2)

- [ ] **Step 2: Add `e2e` job to `.github/workflows/ci-frontend.yml`**

Append the following job after the `build` job (keep the existing `test` and `build` jobs intact):

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

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 7
```

- [ ] **Step 3: Commit everything and push**

```bash
git add .github/workflows/ci-frontend.yml frontend/package-lock.json
git commit -m "ci: add Playwright E2E job to frontend CI workflow"
git push
```

- [ ] **Step 4: Verify CI passes on GitHub**

Open the repository on GitHub → Actions → CI — Frontend → confirm the `E2E Tests` job is green.
