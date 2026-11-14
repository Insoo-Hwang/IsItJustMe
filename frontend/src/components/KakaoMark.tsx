// A speech bubble with a tail, drawn here: the Material icon font has no KakaoTalk mark.
function KakaoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3.6c-5.2 0-9.4 3.3-9.4 7.4 0 2.6 1.7 4.9 4.3 6.2l-.9 3.3c-.1.4.3.7.6.5l3.9-2.6c.5.1 1 .1 1.5.1 5.2 0 9.4-3.3 9.4-7.5S17.2 3.6 12 3.6z" />
    </svg>
  )
}

export default KakaoMark
