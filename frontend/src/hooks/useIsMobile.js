import { useEffect, useState } from 'react'

export default function useIsMobile(breakpoint = 900) {
  const getMatches = () => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= breakpoint
  }

  const [isMobile, setIsMobile] = useState(getMatches)

  useEffect(() => {
    const onResize = () => setIsMobile(getMatches())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])

  return isMobile
}
