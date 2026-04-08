import { test, expect } from '@playwright/test'

// Tests share backend state, so run serially to avoid race conditions.
test.describe.configure({ mode: 'serial' })

/** Ensure at least one document exists in the sidebar, ingesting one if needed. */
async function ensureDocument(page: import('@playwright/test').Page) {
  await page.goto('/')
  if (await page.getByText('Add one to begin.').isVisible()) {
    await page.getByRole('button', { name: 'Add Document' }).click()
    await page.getByRole('textbox', { name: /https:\/\/example\.com\/article/ }).fill('https://example.com')
    await page.getByRole('button', { name: 'Add to Archive' }).click()
    await expect(page.getByRole('heading', { name: 'Add to Archive' })).not.toBeVisible()
    await expect(page.getByText('example.com')).toBeVisible({ timeout: 15000 })
  }
}

test('hovering a document reveals the delete button', async ({ page }) => {
  await ensureDocument(page)

  const docName = page.getByText('example.com').first()
  await expect(docName).toBeVisible()

  await docName.hover()
  await expect(page.getByRole('button', { name: 'Delete document' })).toBeVisible()
})

test('clicking delete removes the document from the sidebar', async ({ page }) => {
  await ensureDocument(page)

  await page.getByText('example.com').first().hover()
  await page.getByRole('button', { name: 'Delete document' }).first().click()

  await expect(page.getByText('example.com')).not.toBeVisible()
})
