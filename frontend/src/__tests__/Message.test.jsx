import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Message } from '../App'

describe('Message', () => {
  it('shows "you" avatar for user messages', () => {
    render(<Message msg={{ role: 'user', content: 'Hello', sources: [] }} />)
    expect(screen.getByText('you')).toBeInTheDocument()
  })

  it('renders user message content', () => {
    render(<Message msg={{ role: 'user', content: 'What is RAG?', sources: [] }} />)
    expect(screen.getByText('What is RAG?')).toBeInTheDocument()
  })

  it('renders assistant message content', () => {
    render(<Message msg={{ role: 'assistant', content: 'RAG stands for Retrieval-Augmented Generation.', sources: [] }} />)
    expect(screen.getByText('RAG stands for Retrieval-Augmented Generation.')).toBeInTheDocument()
  })

  it('shows thinking dots when msg.thinking is true', () => {
    const { container } = render(<Message msg={{ role: 'assistant', thinking: true, content: '', sources: [] }} />)
    // ThinkingDots renders 3 dots
    const dots = container.querySelectorAll('[style*="pulse-dot"]')
    expect(dots.length).toBe(3)
  })

  it('does not show sources button when sources array is empty', () => {
    render(<Message msg={{ role: 'assistant', content: 'Answer', sources: [] }} />)
    expect(screen.queryByText(/source/i)).not.toBeInTheDocument()
  })

  it('shows sources button when sources exist', () => {
    const sources = [{ document_id: 'id1', content: 'ctx', level: 'chunk', metadata: {} }]
    render(<Message msg={{ role: 'assistant', content: 'Answer', sources }} />)
    expect(screen.getByText(/1 source/)).toBeInTheDocument()
  })

  it('pluralises sources label correctly', () => {
    const sources = [
      { document_id: 'id1', content: 'ctx1', level: 'chunk', metadata: {} },
      { document_id: 'id2', content: 'ctx2', level: 'chunk', metadata: {} },
    ]
    render(<Message msg={{ role: 'assistant', content: 'Answer', sources }} />)
    expect(screen.getByText(/2 sources/)).toBeInTheDocument()
  })

  it('toggles source cards on sources button click', async () => {
    const sources = [{ document_id: 'abcdefghij', content: 'ctx', level: 'chunk', metadata: {} }]
    render(<Message msg={{ role: 'assistant', content: 'Answer', sources }} />)
    const btn = screen.getByText(/1 source/)
    // Cards not visible initially
    expect(screen.queryByText('abcdefghij')).not.toBeInTheDocument()
    await userEvent.click(btn)
    expect(screen.getByText('abcdefghij')).toBeInTheDocument()
  })
})
