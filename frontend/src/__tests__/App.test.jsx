import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve([]),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App', () => {
  it('renders the brand name "Archive"', async () => {
    render(<App />)
    expect(screen.getByText('Archive')).toBeInTheDocument()
  })

  it('shows the empty-state heading after documents load', async () => {
    render(<App />)
    await waitFor(() =>
      expect(screen.getByText('Ask anything about your archive')).toBeInTheDocument()
    )
  })

  it('shows "Add Document" button in sidebar', async () => {
    render(<App />)
    expect(screen.getByText('Add Document')).toBeInTheDocument()
  })

  it('shows upload modal when "Add Document" is clicked', async () => {
    render(<App />)
    await userEvent.click(screen.getByText('Add Document'))
    expect(screen.getByRole('heading', { name: 'Add to Archive' })).toBeInTheDocument()
  })

  it('closes upload modal when backdrop is clicked', async () => {
    render(<App />)
    await userEvent.click(screen.getByText('Add Document'))
    expect(screen.getByRole('heading', { name: 'Add to Archive' })).toBeInTheDocument()

    const backdrop = document.querySelector('[style*="position: fixed"]')
    await userEvent.click(backdrop)
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Add to Archive' })).not.toBeInTheDocument()
    )
  })

  it('shows document count in header after load', async () => {
    render(<App />)
    await waitFor(() =>
      expect(screen.getByText(/0 documents indexed/)).toBeInTheDocument()
    )
  })

  it('fetches documents on mount', async () => {
    render(<App />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/documents'))
  })

  it('appends user and assistant messages on query', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve([]) })   // documents
      .mockResolvedValueOnce({ json: () => Promise.resolve({ answer: 'Paris', sources: [] }) })

    globalThis.fetch = mockFetch

    render(<App />)
    await waitFor(() => screen.getByText('Ask anything about your archive'))

    const textarea = screen.getByPlaceholderText(/Ask anything about your documents/)
    await userEvent.type(textarea, 'What is the capital of France?')
    await userEvent.keyboard('{Enter}')

    await waitFor(() =>
      expect(screen.getByText('Paris')).toBeInTheDocument()
    )
    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument()
  })

  it('shows error message when query fails', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve([]) })
      .mockRejectedValueOnce(new Error('Network error'))

    render(<App />)
    await waitFor(() => screen.getByText('Ask anything about your archive'))

    const textarea = screen.getByPlaceholderText(/Ask anything about your documents/)
    await userEvent.type(textarea, 'test question')
    await userEvent.keyboard('{Enter}')

    await waitFor(() =>
      expect(screen.getByText(/Could not reach the server/)).toBeInTheDocument()
    )
  })

  it('shows Clear button after messages exist', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ answer: 'test answer', sources: [] }) })

    render(<App />)
    await waitFor(() => screen.getByText('Ask anything about your archive'))

    const textarea = screen.getByPlaceholderText(/Ask anything about your documents/)
    await userEvent.type(textarea, 'question')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByText('Clear')).toBeInTheDocument())
  })
})
