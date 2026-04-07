import '@testing-library/jest-dom'

// jsdom doesn't implement scrollTo — stub it so App's useEffect doesn't throw
Element.prototype.scrollTo = () => {}
