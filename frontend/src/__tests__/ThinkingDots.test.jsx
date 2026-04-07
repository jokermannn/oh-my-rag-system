import { render } from '@testing-library/react'
import { ThinkingDots } from '../App'

// ThinkingDots renders: <div><div/><div/><div/></div>
// container.firstChild is the wrapper; its children are the three dots
const getDots = (container) => Array.from(container.firstChild.children)

describe('ThinkingDots', () => {
  it('renders three animated dots', () => {
    const { container } = render(<ThinkingDots />)
    expect(getDots(container)).toHaveLength(3)
  })

  it('each dot has pulse-dot animation', () => {
    const { container } = render(<ThinkingDots />)
    getDots(container).forEach(dot => {
      expect(dot.style.animation).toContain('pulse-dot')
    })
  })

  it('dots have staggered animation delays', () => {
    const { container } = render(<ThinkingDots />)
    const delays = getDots(container).map(d => d.style.animation)
    // Each dot should have a different delay in its animation string
    expect(new Set(delays).size).toBe(3)
  })
})
