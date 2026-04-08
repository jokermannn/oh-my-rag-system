import { Page } from '@playwright/test'

export interface MockOptions {
  /** Documents returned by GET /documents. Default: [] */
  documents?: Array<{ id: string; source: string; version?: number; chunk_count: number }>
  /** Answer text returned by POST /query. Default: 'Test answer from mock' */
  queryAnswer?: string
  /** Sources returned by POST /query. Default: [] */
  querySources?: Array<{
    document_id: string
    content: string
    level: 'parent' | 'child'
    metadata: Record<string, unknown>
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
  // DELETE /documents/:id — regex requires a path segment after the slash,
  // so it cannot match the bare /documents path used by GET
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
