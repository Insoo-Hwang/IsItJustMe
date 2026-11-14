import { useState } from 'react'
import type { Choice } from '../data/categories.ts'
import story from '../data/story.ts'
import { debatePath, fillDebate } from '../lib/debate.ts'
import type { ShareChannel } from '../lib/share.ts'
import { track } from '../lib/track.ts'
import Icon from './Icon.tsx'
import NameSheet from './NameSheet.tsx'
import ShareSheet from './ShareSheet.tsx'
import ui from './ui.module.css'

type Props = {
  className: string
  categoryId: string
  n: number
  pick: Choice
  prompt: string
  // the two options of the question
  a: string
  b: string
  rate: number
}

// Shares a link that asks friends to take a side on one of my picks.
function DebateShareButton({ className, categoryId, n, pick, prompt, a, b, rate }: Props) {
  const [asking, setAsking] = useState(false)
  const [name, setName] = useState<string | null>(null)

  const shared = (channel: ShareChannel) => {
    track('SHARE_DEBATE', categoryId)
    if (channel === 'kakao') track('SHARE_KAKAO', categoryId)
  }

  return (
    <>
      <button type="button" className={`${className} ${ui.share}`} onClick={() => setAsking(true)}>
        <Icon name="ios_share" size={22} />
        공유하기
      </button>
      {asking && (
        <NameSheet
          title="친구에게 보여줄 이름"
          description="논쟁 화면에 이 이름과 내 선택이 보여요."
          confirmLabel="다음"
          share
          onSubmit={(value) => {
            setAsking(false)
            setName(value)
          }}
          onClose={() => setAsking(false)}
        />
      )}
      {name != null && (
        <ShareSheet
          share={{
            title: story.debate.title,
            text: fillDebate(story.debate.shareText, { name, prompt, a, b, choice: pick === 'a' ? a : b, rate }),
            button: '내 편 고르기',
            url: `${location.origin}${debatePath(categoryId, n, pick, name)}`,
          }}
          image={{ kind: 'debate', name, prompt, a, b, pick }}
          onShare={shared}
          onClose={() => setName(null)}
        />
      )}
    </>
  )
}

export default DebateShareButton
