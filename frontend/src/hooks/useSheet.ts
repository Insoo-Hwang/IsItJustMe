import { useLocation, useNavigate, useSearchParams, type To } from 'react-router'

export type SheetName = 'share' | 'restore' | 'menu'

type SheetLocationState = { sheetPushed?: boolean } | null

// Bottom sheets live in ?sheet= so the browser back button closes them.
export function useSheet(name: SheetName) {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const pushed = (location.state as SheetLocationState)?.sheetPushed === true

  const withSheet = (value: SheetName | null) => {
    const next = new URLSearchParams(location.search)
    if (value) next.set('sheet', value)
    else next.delete('sheet')
    const search = next.toString()
    return { search: search ? `?${search}` : '', hash: location.hash }
  }

  return {
    isOpen: params.get('sheet') === name,
    open: () => navigate(withSheet(name), { state: { sheetPushed: true } }),
    close: () => (pushed ? navigate(-1) : navigate(withSheet(null), { replace: true })),
    // leave the sheet without keeping it in history
    go: (to: To) => navigate(to, { replace: true }),
  }
}
