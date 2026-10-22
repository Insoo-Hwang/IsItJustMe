import { createContext, useContext, type RefObject } from 'react'

export const ScrollContainerContext = createContext<RefObject<HTMLDivElement | null>>({ current: null })

// The app scrolls inside the mobile frame, not the window.
export function useScrollContainer() {
  return useContext(ScrollContainerContext)
}

export function scrollToCategories(): boolean {
  const target = document.getElementById('categories')
  target?.scrollIntoView({ behavior: 'smooth' })
  return target != null
}
