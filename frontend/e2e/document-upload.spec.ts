import { test, expect } from '@playwright/test'

test('clicking "Add Document" opens the upload modal', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Document' }).click()
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).toBeVisible()
})

test('clicking the backdrop closes the modal', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Document' }).click()
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).toBeVisible()

  await page.getByTestId('modal-backdrop').click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).not.toBeVisible()
})

test('clicking the X button closes the modal', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Document' }).click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).not.toBeVisible()
})

test('submitting a URL ingests it and shows the document in sidebar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Document' }).click()
  await page.getByRole('textbox', { name: /https:\/\/example\.com\/article/ }).fill('https://example.com')
  await page.getByRole('button', { name: 'Add to Archive' }).click()

  // Modal closes after successful submission
  await expect(page.getByRole('heading', { name: 'Add to Archive' })).not.toBeVisible()

  // Document appears in sidebar — backend processes the URL asynchronously,
  // app polls after 800 ms. Allow extra time for real network + processing.
  await expect(page.getByText('example.com')).toBeVisible({ timeout: 15000 })
})
