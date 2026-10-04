import type { ArtKind } from '../domain/types'

/**
 * Hand-drawn style placeholder illustration, used until someone adds a real
 * photo. Keeps the catalogue warm without borrowing creators' photos.
 */
const BACKGROUNDS = [
  ['#F4E2C6', '#E7B987'],
  ['#EFDCC8', '#D9A57E'],
  ['#F2E6CC', '#DDB574'],
  ['#ECDDD0', '#CF9F83'],
  ['#E9E3D0', '#C2B98E'],
]

function hash(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

const CRUST = '#B5672F'
const CRUST_DARK = '#8A4B22'
const CRUMB = '#F0D3A6'
const CHOC = '#4A2A1A'

function Motif({ kind }: { kind: ArtKind }) {
  switch (kind) {
    case 'boule':
      return (
        <g>
          <path d="M105 205 Q102 98 200 92 Q298 98 295 205 Z" fill={CRUST} />
          <path d="M105 205 Q200 222 295 205 Q296 196 293 188 Q200 206 107 188 Q104 196 105 205Z" fill={CRUST_DARK} opacity=".5" />
          <path d="M150 150 Q200 112 255 138" stroke={CRUMB} strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d="M152 156 Q200 122 252 145" stroke={CRUST_DARK} strokeWidth="3" fill="none" opacity=".45" />
          <Specks />
        </g>
      )
    case 'loaf':
      return (
        <g>
          <rect x="95" y="140" width="210" height="72" rx="10" fill={CRUST_DARK} opacity=".85" />
          <path d="M92 150 Q95 95 200 92 Q305 95 308 150 Z" fill={CRUST} />
          {[140, 190, 240].map((x) => (
            <path key={x} d={`M${x} 135 L${x + 28} 108`} stroke={CRUMB} strokeWidth="7" strokeLinecap="round" />
          ))}
        </g>
      )
    case 'cake':
      return (
        <g>
          <rect x="88" y="140" width="224" height="70" rx="12" fill="#D9A15F" />
          <ellipse cx="200" cy="140" rx="112" ry="30" fill="#E8BE7D" />
          {[-70, -35, 0, 35, 70].map((dx, i) => (
            <path key={i} d={`M${200 + dx - 16} ${140 + (i % 2 ? 8 : -6)} q16 -18 32 0`} stroke="#9E5A2A" strokeWidth="6" fill="none" strokeLinecap="round" />
          ))}
          <ellipse cx="200" cy="140" rx="112" ry="30" fill="#fff" opacity=".28" />
        </g>
      )
    case 'cookie':
      return (
        <g>
          <circle cx="175" cy="160" r="68" fill="#D49A57" />
          <circle cx="252" cy="185" r="42" fill="#C98C4B" />
          {[
            [150, 135],
            [190, 128],
            [205, 170],
            [160, 185],
            [130, 165],
            [180, 205],
            [245, 175],
            [262, 198],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="13" height="11" rx="4" fill={CHOC} transform={`rotate(${i * 37} ${x} ${y})`} />
          ))}
        </g>
      )
    case 'muffin':
      return (
        <g>
          <path d="M140 160 L260 160 L248 222 L152 222 Z" fill="#E9D8C0" />
          {[160, 180, 200, 220, 240].map((x) => (
            <path key={x} d={`M${x} 160 L${x - (x - 200) * 0.1} 222`} stroke="#CDB596" strokeWidth="3" />
          ))}
          <path d="M128 165 Q122 96 200 92 Q278 96 272 165 Z" fill="#D9A05C" />
          {[
            [165, 125],
            [205, 112],
            [235, 135],
            [185, 148],
            [220, 152],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="8" fill="#4B4A7A" />
          ))}
        </g>
      )
    case 'roll':
      return (
        <g>
          <circle cx="200" cy="155" r="72" fill="#D49A57" />
          <path
            d="M200 155 m0 -8 a8 8 0 1 1 -8 8 a16 16 0 1 1 16 16 a26 26 0 1 1 -26 -26 a38 38 0 1 1 38 38 a50 50 0 1 1 -50 -50"
            stroke="#8A4B22"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M150 115 Q180 100 220 108" stroke="#FFF7EA" strokeWidth="9" fill="none" strokeLinecap="round" opacity=".85" />
        </g>
      )
    case 'crescent':
      return (
        <g>
          {[
            [140, 140, -15],
            [230, 125, 20],
            [195, 195, 5],
          ].map(([x, y, r], i) => (
            <path
              key={i}
              d={`M${x - 45} ${y} Q${x} ${y - 55} ${x + 45} ${y} Q${x} ${y - 25} ${x - 45} ${y} Z`}
              fill="#EAC48D"
              stroke="#FFF8EC"
              strokeWidth="4"
              transform={`rotate(${r} ${x} ${y})`}
            />
          ))}
        </g>
      )
    case 'braid':
      return (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse key={i} cx={120 + i * 40} cy={150 + (i % 2 ? -12 : 12)} rx="34" ry="26" fill={i % 2 ? CRUST : '#C47B3C'} transform={`rotate(${i % 2 ? 25 : -25} ${120 + i * 40} ${150})`} />
          ))}
          {[[140, 130], [190, 160], [230, 128], [260, 150]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" fill="#fff" />
          ))}
        </g>
      )
    case 'flat':
      return (
        <g>
          <ellipse cx="200" cy="168" rx="125" ry="52" fill="#E6C08A" />
          <ellipse cx="200" cy="160" rx="125" ry="52" fill="#F0D3A6" />
          {[
            [140, 150, 9],
            [185, 135, 6],
            [240, 158, 10],
            [205, 182, 7],
            [270, 140, 5],
            [150, 180, 6],
          ].map(([x, y, rr], i) => (
            <ellipse key={i} cx={x} cy={y} rx={rr} ry={rr * 0.6} fill="#9C5B2A" opacity=".55" />
          ))}
        </g>
      )
    case 'bar':
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${95 + i * 72} ${i % 2 ? 120 : 135})`}>
              <rect width="64" height="64" rx="6" fill={i === 1 ? '#5B3420' : '#C99050'} />
              <rect width="64" height="14" rx="6" fill={i === 1 ? '#6E4128' : '#D9A766'} />
              {i !== 1 && <circle cx="22" cy="36" r="5" fill={CHOC} />}
              {i !== 1 && <circle cx="44" cy="48" r="4" fill={CHOC} />}
            </g>
          ))}
        </g>
      )
    case 'ring':
      return (
        <g>
          <circle cx="200" cy="155" r="72" fill={CRUST} />
          <circle cx="200" cy="155" r="20" fill="#E9CFA8" />
          <path d="M148 120 Q200 95 252 120" stroke={CRUMB} strokeWidth="8" fill="none" strokeLinecap="round" opacity=".7" />
          {[[160, 135], [235, 140], [215, 200], [170, 190], [250, 175]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="3" ry="1.6" fill="#FFF4E0" transform={`rotate(${i * 50} ${x} ${y})`} />
          ))}
        </g>
      )
    case 'stick':
      return (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={90} y={115 + i * 26} width="230" height="18" rx="9" fill={i % 2 ? CRUST : '#C98A4C'} transform={`rotate(-8 200 ${125 + i * 26})`} />
          ))}
        </g>
      )
  }
}

function Specks() {
  return (
    <g fill="#fff" opacity=".55">
      <circle cx="175" cy="120" r="2.5" />
      <circle cx="230" cy="115" r="2" />
      <circle cx="210" cy="170" r="2.5" />
      <circle cx="140" cy="175" r="2" />
      <circle cx="265" cy="170" r="2" />
    </g>
  )
}

export function RecipeArt({ kind, seed, className }: { kind: ArtKind; seed: string; className?: string }) {
  const [a, b] = BACKGROUNDS[hash(seed) % BACKGROUNDS.length]
  const id = `g${hash(seed)}`
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="90%">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id})`} />
      <ellipse cx="200" cy="228" rx="140" ry="16" fill="#5A3418" opacity=".14" />
      <Motif kind={kind} />
    </svg>
  )
}
