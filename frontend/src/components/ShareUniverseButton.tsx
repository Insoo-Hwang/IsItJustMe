import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { HttpError } from '../api/categories.ts'
import { openRoom } from '../api/rooms.ts'
import { invitePath } from '../lib/room.ts'
import { showToast } from '../lib/toast.ts'
import Icon from './Icon.tsx'
import NameSheet from './NameSheet.tsx'
import ui from './ui.module.css'

type Props = {
  className: string
  children: ReactNode
}

async function share(name: string) {
  const token = await openRoom(name)
  const url = `${location.origin}${invitePath(token)}`
  const text = `${name}의 취향 우주에 놀러 와!`
  if (navigator.share) {
    try {
      await navigator.share({ title: '나만 그래?', text, url })
      return
    } catch (err) {
      // closed the share sheet
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  await navigator.clipboard.writeText(`${text}\n${url}`)
  showToast('링크를 복사했어요')
}

// Asks for the name friends will see, then shares the guest's taste universe.
function ShareUniverseButton({ className, children }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  const submit = async (name: string) => {
    setBusy(true)
    try {
      await share(name)
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['room', 'mine'] })
    } catch (err) {
      console.error(err)
      showToast(
        err instanceof HttpError && err.status === 409
          ? '테스트 6개를 모두 끝내야 공유할 수 있어요'
          : '링크를 만들지 못했어요. 다시 시도해주세요',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={`${className} ${ui.share}`} onClick={() => setOpen(true)}>
        <Icon name="ios_share" size={22} />
        {children}
      </button>
      {open && (
        <NameSheet
          title="친구에게 보여줄 이름"
          description="초대장과 취향 우주에 이 이름으로 보여요. 다시 공유하면 이름을 바꿀 수 있어요."
          confirmLabel="링크 공유하기"
          share
          busy={busy}
          onSubmit={(name) => void submit(name)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default ShareUniverseButton
