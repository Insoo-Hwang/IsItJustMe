import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { HttpError } from '../api/categories.ts'
import { openRoom } from '../api/rooms.ts'
import { shortName } from '../data/categories.ts'
import { minorityShare } from '../lib/rarity.ts'
import { invitePath } from '../lib/room.ts'
import type { ShareChannel } from '../lib/share.ts'
import type { ShareImageData } from '../lib/shareImage.ts'
import { useSummary } from '../lib/summary.ts'
import { showToast } from '../lib/toast.ts'
import { track } from '../lib/track.ts'
import Icon from './Icon.tsx'
import NameSheet from './NameSheet.tsx'
import ShareSheet from './ShareSheet.tsx'
import ui from './ui.module.css'

type Props = {
  className: string
  children: ReactNode
}

type Room = { name: string; token: string }

const shared = (channel: ShareChannel) => {
  track('SHARE_UNIVERSE')
  if (channel === 'kakao') track('SHARE_KAKAO')
}

// The ways to send the link of a room. The KakaoTalk picture has the sharer's hexagon in
// the middle of a universe, so the results are read here, only once the sheet is open.
function UniverseShareSheet({ room, onClose }: { room: Room; onClose: () => void }) {
  const state = useSummary()
  const summary = state.status === 'ready' ? state.summary : null
  const image: ShareImageData | undefined = summary
    ? {
        kind: 'summary',
        name: room.name,
        tier: summary.tier.tier,
        tone: summary.tier.tone,
        headline: summary.tier.headline,
        minority: summary.minority,
        picks: summary.picks,
        axes: summary.rows.map(({ category, rarity }) => ({ label: shortName(category), value: minorityShare(rarity) })),
      }
    : undefined

  return (
    <ShareSheet
      share={{
        title: '나만 그래?',
        text: `나도 테스트하고 ${room.name}의 취향 우주로 놀러 가기`,
        description: '나랑 취향이 얼마나 다른지 비교해봐',
        button: '취향 비교하기',
        url: `${location.origin}${invitePath(room.token)}`,
      }}
      image={image}
      imagePending={state.status === 'loading'}
      onShare={shared}
      onClose={onClose}
    />
  )
}

// Asks for the name friends will see, makes the link, then offers the ways to send it.
function ShareUniverseButton({ className, children }: Props) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const queryClient = useQueryClient()

  const submit = async (name: string) => {
    setBusy(true)
    try {
      const token = await openRoom(name)
      setAsking(false)
      setRoom({ name, token })
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
      <button type="button" className={`${className} ${ui.share}`} onClick={() => setAsking(true)}>
        <Icon name="ios_share" size={22} />
        {children}
      </button>
      {asking && (
        <NameSheet
          title="친구에게 보여줄 이름"
          description="초대장과 취향 우주에 이 이름으로 보여요. 다시 공유하면 이름을 바꿀 수 있어요."
          confirmLabel="링크 만들기"
          share
          busy={busy}
          onSubmit={(name) => void submit(name)}
          onClose={() => setAsking(false)}
        />
      )}
      {room && <UniverseShareSheet room={room} onClose={() => setRoom(null)} />}
    </>
  )
}

export default ShareUniverseButton
