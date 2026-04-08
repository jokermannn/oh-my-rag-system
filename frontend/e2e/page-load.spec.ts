import { test, expect } from '@playwright/test'

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
  await expect(page.getByRole('button', { name: 'Add Document' })).toBeVisible()
})
