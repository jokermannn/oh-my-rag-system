import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures/mock-api'

test('clicking "Add Document" opens the upload modal', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Document' }).click()
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).toBeVisible()
})

test('clicking the backdrop closes the modal', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Document' }).click()
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).toBeVisible()

  await page.getByTestId('modal-backdrop').click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).not.toBeVisible()
})

test('clicking the X button closes the modal', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Document' }).click()
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
  await page.getByRole('button', { name: 'Add Document' }).click()
  await page.getByRole('textbox', { name: 'https://example.com/article' }).fill('https://example.com/page')
  await page.getByRole('button', { name: 'Add to Archive' }).click()

  // Modal closes
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).not.toBeVisible()

  // Document appears in sidebar (app calls loadDocs after 800ms)
  await expect(page.getByText('example-page.html')).toBeVisible({ timeout: 3000 })
})
