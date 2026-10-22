import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { ensureGuestSession } from '../api/guest.ts'
import Toaster from '../components/Toast.tsx'
import MenuSheet from '../components/sheets/MenuSheet.tsx'
import RestoreSheet from '../components/sheets/RestoreSheet.tsx'
import { setProfile } from '../store/testStore.ts'
import BottomTab from './BottomTab.tsx'
import { ScrollContainerContext } from './scrollContainer.ts'
import styles from './AppShell.module.css'

const TAB_PATHS = ['/main', '/dex', '/stats']

function AppShell() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { pathname, hash } = useLocation()

  useEffect(() => {
    ensureGuestSession()
      .then((session) => setProfile(session.profile))
      .catch((err: unknown) => console.error(err))
  }, [])

  // New page starts at the top, or at the #anchor when one is given.
  useLayoutEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null
    if (target) target.scrollIntoView()
    else if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [pathname, hash])

  const showTabs = TAB_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  return (
    <div className={styles.outer}>
      <div className={styles.frame}>
        <div ref={scrollRef} className={styles.scroll}>
          <ScrollContainerContext value={scrollRef}>
            <div className={styles.screen}>
              <Outlet />
            </div>
          </ScrollContainerContext>
          {showTabs && <BottomTab />}
        </div>
      </div>
      <RestoreSheet />
      <MenuSheet />
      <Toaster />
    </div>
  )
}

export default AppShell
