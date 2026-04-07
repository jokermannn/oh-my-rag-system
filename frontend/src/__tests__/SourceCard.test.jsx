import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SourceCard } from '../App'

const makeSource = (overrides = {}) => ({
  document_id: 'doc-abc123',
  content: 'This is the source content for testing purposes.',
  level: 'chunk',
  metadata: {},
  ...overrides,
})

describe('SourceCard', () => {
  it('shows index + 1 as the badge number', () => {
    render(<SourceCard source={makeSource()} index={2} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('uses metadata.source filename as label', () => {
    const source = makeSource({ metadata: { source: '/docs/guide.pdf' } })
    render(<SourceCard source={source} index={0} />)
    expect(screen.getByText('guide.pdf')).toBeInTheDocument()
  })

  it('falls back to truncated document_id when no metadata', () => {
    render(<SourceCard source={makeSource({ document_id: 'abcdefghij' })} index={0} />)
    expect(screen.getByText('abcdefghij')).toBeInTheDocument()
  })

  it('falls back to "Source N" label when no metadata or document_id', () => {
    render(<SourceCard source={{ content: 'x', level: 'chunk', metadata: {} }} index={4} />)
    expect(screen.getByText('Source 5')).toBeInTheDocument()
  })

  it('content is hidden by default', () => {
    const source = makeSource()
    render(<SourceCard source={source} index={0} />)
    expect(screen.queryByText(/This is the source content/)).not.toBeInTheDocument()
  })

  it('expands to show content on click', async () => {
    const source = makeSource()
    render(<SourceCard source={source} index={0} />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/This is the source content/)).toBeInTheDocument()
  })

  it('collapses content on second click', async () => {
    const source = makeSource()
    render(<SourceCard source={source} index={0} />)
    const btn = screen.getByRole('button')
    await userEvent.click(btn)
    await userEvent.click(btn)
    expect(screen.queryByText(/This is the source content/)).not.toBeInTheDocument()
  })

  it('truncates content longer than 300 chars', async () => {
    const longContent = 'A'.repeat(350)
    const source = makeSource({ content: longContent })
    render(<SourceCard source={source} index={0} />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/…/)).toBeInTheDocument()
  })
})
