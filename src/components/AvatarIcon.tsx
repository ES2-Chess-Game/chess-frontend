import type { Avatar } from '../account'

export default function AvatarIcon({ avatar }: { avatar?: Avatar | null }) {
  const match = avatar?.image.match(/^(king|queen|rook|bishop|knight|pawn)\.(svg|png)$/)
  return (
    <span className="avatar-mark" aria-hidden="true">
      {match ? <img src={`/avatares/${match[1]}.svg`} alt="" width={32} height={32} /> : '♟'}
    </span>
  )
}
