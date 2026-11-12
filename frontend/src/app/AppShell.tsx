import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { ensureGuestSession } from '../api/guest.ts'
import Toaster from '../components/Toast.tsx'
import { INVITE_PARAM } from '../lib/room.ts'
import { setInvite, setProfile, useTestState } from '../store/testStore.ts'
import ErrorBoundary from './ErrorBoundary.tsx'
import { ScrollContainerContext } from './scrollContainer.ts'
import styles from './AppShell.module.css'

function AppShell() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const { invite } = useTestState()

  useEffect(() => {
    ensureGuestSession()
      .then((session) => setProfile(session.profile))
      .catch((err: unknown) => console.error(err))
  }, [])

  // An invited friend keeps ?invite=<token> on every page: a tagged link remembers the
  // invite, and an untagged page gets the remembered tag back.
  // The invite page carries the token in its path, so it needs no tag.
  useEffect(() => {
    if (pathname.startsWith('/invite/')) return
    const params = new URLSearchParams(search)
    const tagged = params.get(INVITE_PARAM)
    if (tagged) {
      if (tagged !== invite?.token) setInvite({ token: tagged })
      return
    }
    if (!invite) return
    params.set(INVITE_PARAM, invite.token)
    navigate({ pathname, search: `?${params}`, hash }, { replace: true })
  }, [pathname, search, hash, invite, navigate])

  // New page starts at the top, or at the #anchor when one is given.
  useLayoutEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null
    if (target) target.scrollIntoView()
    else if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [pathname, hash])

  return (
    <div className={styles.outer}>
      <div className={styles.frame}>
        <div ref={scrollRef} className={styles.scroll}>
          <ScrollContainerContext value={scrollRef}>
            <div className={styles.screen}>
              {/* a page that breaks keeps the frame; the next page starts clean */}
              <ErrorBoundary key={pathname}>
                <Outlet />
              </ErrorBoundary>
            </div>
          </ScrollContainerContext>
        </div>
      </div>
      <Toaster />
    </div>
  )
}

export default AppShell
