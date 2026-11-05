import { useState } from 'react'
import type { Choice } from '../data/categories.ts'
import story from '../data/story.ts'
import { debatePath, fillDebate } from '../lib/debate.ts'
import { showToast } from '../lib/toast.ts'
import Icon from './Icon.tsx'
import NameSheet from './NameSheet.tsx'

type Props = {
  className: string
  categoryId: string
  n: number
  pick: Choice
  prompt: string
  choice: string
  rate: number
}

// Shares a link that asks friends to take a side on one of my picks.
function DebateShareButton({ className, categoryId, n, pick, prompt, choice, rate }: Props) {
  const [open, setOpen] = useState(false)

  const share = async (name: string) => {
    setOpen(false)
    const url = `${location.origin}${debatePath(categoryId, n, pick, name)}`
    const text = fillDebate(story.debate.shareText, { name, prompt, choice, rate })
    if (navigator.share) {
      try {
        await navigator.share({ title: story.debate.title, text, url })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      showToast('링크를 복사했어요')
    } catch (err) {
      console.error(err)
      showToast('링크를 복사하지 못했어요')
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Icon name="local_fire_department" size={22} />
        논쟁 링크 보내기
      </button>
      {open && (
        <NameSheet
          title="친구에게 보여줄 이름"
          description="논쟁 화면에 이 이름과 내 선택이 보여요."
          confirmLabel="링크 공유하기"
          onSubmit={(name) => void share(name)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default DebateShareButton
