import { test, expect } from '@playwright/test'

test('shows error message when query API returns 500', async ({ page }) => {
  // Intercept only the query endpoint to simulate a server error.
  // All other requests (e.g. /documents on load) hit the real backend.
  await page.route('/query', route => route.fulfill({ status: 500, body: 'Internal Server Error' }))
  await page.goto('/')

  await page.getByLabel('Query input').fill('Will this work?')
  await page.keyboard.press('Enter')

  await expect(page.getByText('Could not reach the server. Is it running?')).toBeVisible()
})

test('shows error inside modal when ingest fails with network error', async ({ page }) => {
  // Intercept only the ingest endpoint to simulate a network failure.
  await page.route('/ingest', route => route.abort())
  await page.goto('/')

  await page.getByRole('button', { name: 'Add Document' }).click()
  await page.getByRole('textbox', { name: /https:\/\/example\.com\/article/ }).fill('https://example.com/bad')
  await page.getByRole('button', { name: 'Add to Archive' }).click()

  await expect(page.getByText('Failed to ingest. Check the path or URL.')).toBeVisible()
  // Modal stays open on error
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).toBeVisible()
})
