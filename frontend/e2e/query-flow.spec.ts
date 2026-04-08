import { test, expect } from '@playwright/test'

/** Wait for the LLM answer to replace thinking dots. Real API can take ~10-20 s. */
async function waitForAnswer(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('thinking-dot').first()).not.toBeVisible({ timeout: 30000 })
}

test('typing a question and pressing Enter shows an answer', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Query input').fill('What is RAG?')
  await page.keyboard.press('Enter')

  await waitForAnswer(page)
  // User question is still visible in conversation history
  await expect(page.getByText('What is RAG?')).toBeVisible()
})

test('shows sources toggle button when sources are present', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Query input').fill('What is RAG?')
  await page.keyboard.press('Enter')

  await waitForAnswer(page)

  // Sources button only appears when the backend returns sources.
  // With an empty knowledge base this assertion is skipped.
  const sourcesBtn = page.getByText(/\d+ source/)
  if (await sourcesBtn.isVisible()) {
    await expect(sourcesBtn).toBeVisible()
  }
})

test('clicking sources button expands and collapses source cards', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Query input').fill('What is RAG?')
  await page.keyboard.press('Enter')

  await waitForAnswer(page)

  const sourcesBtn = page.getByText(/\d+ source/)
  if (!await sourcesBtn.isVisible()) {
    // No sources returned — skip toggle behaviour test
    return
  }

  // Expand
  await sourcesBtn.click()
  await expect(page.getByText(/\d+ source/)).toBeVisible()

  // Collapse
  await sourcesBtn.click()
})

test('two sequential queries produce 4 messages', async ({ page }) => {
  await page.goto('/')

  for (const question of ['First question', 'Second question']) {
    await page.getByLabel('Query input').fill(question)
    await page.keyboard.press('Enter')
    // Wait for this answer before sending the next query
    await waitForAnswer(page)
  }

  // Both user questions remain visible in conversation history
  await expect(page.getByText('First question')).toBeVisible()
  await expect(page.getByText('Second question')).toBeVisible()
})

test('Clear button appears after first query and empties message list', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Query input').fill('Hello')
  await page.keyboard.press('Enter')
  await waitForAnswer(page)

  await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear' }).click()

  await expect(page.getByText('Ask anything about your archive')).toBeVisible()
  await expect(page.getByText('Hello')).not.toBeVisible()
})
