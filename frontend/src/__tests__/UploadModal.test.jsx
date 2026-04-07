import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadModal } from '../App'

describe('UploadModal', () => {
  const noop = () => {}

  it('renders the modal title', () => {
    render(<UploadModal onClose={noop} onSuccess={noop} />)
    expect(screen.getByRole('heading', { name: 'Add to Archive' })).toBeInTheDocument()
  })

  it('shows URL tab as default', () => {
    render(<UploadModal onClose={noop} onSuccess={noop} />)
    expect(screen.getByPlaceholderText(/https:\/\/example\.com/)).toBeInTheDocument()
  })

  it('switches to file path tab on click', async () => {
    render(<UploadModal onClose={noop} onSuccess={noop} />)
    await userEvent.click(screen.getByText('File Path'))
    expect(screen.getByPlaceholderText(/\/Users\/you\/docs/)).toBeInTheDocument()
  })

  it('submit button is disabled when input is empty', () => {
    render(<UploadModal onClose={noop} onSuccess={noop} />)
    const btn = screen.getByRole('button', { name: 'Add to Archive' })
    expect(btn).toBeDisabled()
  })

  it('submit button enables when input has value', async () => {
    render(<UploadModal onClose={noop} onSuccess={noop} />)
    await userEvent.type(screen.getByRole('textbox'), 'https://example.com')
    const btn = screen.getByRole('button', { name: 'Add to Archive' })
    expect(btn).not.toBeDisabled()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(<UploadModal onClose={onClose} onSuccess={noop} />)
    const backdrop = screen.getByTestId('modal-backdrop')
    await userEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when X button is clicked', async () => {
    const onClose = vi.fn()
    render(<UploadModal onClose={onClose} onSuccess={noop} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls api.ingest and onSuccess on valid submission', async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ job_id: '123' }) })

    render(<UploadModal onClose={onClose} onSuccess={onSuccess} />)
    await userEvent.type(screen.getByRole('textbox'), 'https://example.com/page')
    await userEvent.click(screen.getByRole('button', { name: 'Add to Archive' }))

    expect(fetch).toHaveBeenCalledWith('/ingest', expect.objectContaining({ method: 'POST' }))
    expect(onSuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('shows error message when ingest fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    render(<UploadModal onClose={noop} onSuccess={noop} />)
    await userEvent.type(screen.getByRole('textbox'), 'https://bad.url')
    await userEvent.click(screen.getByRole('button', { name: 'Add to Archive' }))

    expect(await screen.findByText(/Failed to ingest/)).toBeInTheDocument()
  })
})
