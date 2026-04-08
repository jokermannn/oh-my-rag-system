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
