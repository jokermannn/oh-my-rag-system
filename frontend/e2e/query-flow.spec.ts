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
      level: 'child',
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
      level: 'child',
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
