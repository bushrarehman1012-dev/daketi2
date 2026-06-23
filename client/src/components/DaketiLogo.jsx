export function DaketiLogo({ className = '' }) {
  return (
    <svg
      viewBox="0 0 60 80"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="dl-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0e2252"/>
          <stop offset="100%" stopColor="#050c22"/>
        </linearGradient>
        <linearGradient id="dl-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f8ee9a"/>
          <stop offset="45%"  stopColor="#D4AF37"/>
          <stop offset="100%" stopColor="#7a5c08"/>
        </linearGradient>
        <linearGradient id="dl-hat" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%"   stopColor="#f2dc68"/>
          <stop offset="100%" stopColor="#a87808"/>
        </linearGradient>
        <linearGradient id="dl-bag" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%"   stopColor="#f4dc58"/>
          <stop offset="100%" stopColor="#c09010"/>
        </linearGradient>
        <radialGradient id="dl-head" cx="0.4" cy="0.35" r="0.6">
          <stop offset="0%"   stopColor="#f6e084"/>
          <stop offset="100%" stopColor="#d4a840"/>
        </radialGradient>
      </defs>

      {/* ── Card body ── */}
      <rect x="0.75" y="0.75" width="58.5" height="78.5" rx="7.5" fill="url(#dl-bg)"/>
      <rect x="0.75" y="0.75" width="58.5" height="78.5" rx="7.5"
            fill="none" stroke="url(#dl-gold)" strokeWidth="1.5"/>
      <rect x="3.5" y="3.5" width="53" height="73" rx="5.5"
            fill="none" stroke="rgba(212,175,55,0.18)" strokeWidth="0.6"/>

      {/* Subtle background spade */}
      <text x="30" y="56" fill="rgba(212,175,55,0.05)"
            fontFamily="serif" fontSize="44" textAnchor="middle">♠</text>

      {/* ── Top-left corner pip ── */}
      <text x="8" y="13" fill="#D4AF37"
            fontFamily="Georgia,serif" fontSize="8.5" fontWeight="bold" textAnchor="middle">A</text>
      <text x="8" y="21.5" fill="#D4AF37"
            fontFamily="serif" fontSize="8" textAnchor="middle">♠</text>

      {/* ── Bottom-right pip (180° rotation around card centre 30,40) ── */}
      <g transform="translate(60,80) rotate(180)">
        <text x="8" y="13" fill="#D4AF37"
              fontFamily="Georgia,serif" fontSize="8.5" fontWeight="bold" textAnchor="middle">A</text>
        <text x="8" y="21.5" fill="#D4AF37"
              fontFamily="serif" fontSize="8" textAnchor="middle">♠</text>
      </g>

      {/* ══ TOP HAT ══ */}
      {/* Crown */}
      <rect x="22" y="10" width="16" height="13.5" rx="2" fill="url(#dl-hat)"/>
      {/* Highlight on crown */}
      <rect x="23" y="11" width="6.5" height="5" rx="1.2" fill="rgba(255,255,255,0.13)"/>
      {/* Band */}
      <rect x="22" y="20" width="16" height="3.5" fill="#7a5200"/>
      {/* Brim — wide, prominent */}
      <rect x="11" y="23" width="38" height="5" rx="2.5" fill="url(#dl-hat)"/>
      {/* Brim top highlight */}
      <rect x="11" y="23" width="38" height="1.5" rx="2.5" fill="rgba(255,255,255,0.13)"/>

      {/* ══ HEAD ══ */}
      <ellipse cx="30" cy="36.5" rx="9" ry="8.8" fill="url(#dl-head)"/>

      {/* ══ DOMINO MASK ══ */}
      <rect x="21.5" y="32.5" width="7.5" height="6" rx="3" fill="#08081e"/>
      <rect x="31" y="32.5"   width="7.5" height="6" rx="3" fill="#08081e"/>
      {/* Bridge */}
      <rect x="29" y="34.5" width="2" height="2" fill="#08081e"/>

      {/* Eye whites */}
      <circle cx="25.3" cy="35.5" r="2.3" fill="rgba(255,255,255,0.93)"/>
      <circle cx="34.7" cy="35.5" r="2.3" fill="rgba(255,255,255,0.93)"/>
      {/* Pupils */}
      <circle cx="25.8" cy="35.5" r="1.05" fill="#111"/>
      <circle cx="35.2" cy="35.5" r="1.05" fill="#111"/>
      {/* Gleam */}
      <circle cx="26.3" cy="34.8" r="0.42" fill="rgba(255,255,255,0.7)"/>
      <circle cx="35.7" cy="34.8" r="0.42" fill="rgba(255,255,255,0.7)"/>

      {/* Smirk */}
      <path d="M27.5 42 Q30 45 32.5 42"
            stroke="#8a5800" strokeWidth="1.3" fill="none" strokeLinecap="round"/>

      {/* ══ PINSTRIPE COAT ══ */}
      <rect x="21" y="45" width="18" height="21" rx="2.5" fill="#0c1840"/>
      {/* Pinstripes */}
      <rect x="25.5" y="45" width="1.8" height="21" fill="rgba(212,175,55,0.38)"/>
      <rect x="30.6" y="45" width="1.8" height="21" fill="rgba(212,175,55,0.38)"/>
      <rect x="35.7" y="45" width="1.6" height="19" fill="rgba(212,175,55,0.38)"/>
      {/* Collar V */}
      <path d="M23 45 L27.5 51.5 L30 48.5 L32.5 51.5 L37 45" fill="#090d1e"/>
      {/* Lapel gold trim */}
      <path d="M24 45 L28 51 L30 48.8"
            stroke="rgba(212,175,55,0.45)" strokeWidth="0.8" fill="none"/>
      <path d="M36 45 L32 51 L30 48.8"
            stroke="rgba(212,175,55,0.45)" strokeWidth="0.8" fill="none"/>

      {/* ══ LEFT ARM ══ */}
      <rect x="12" y="48.5" width="10" height="3.5" rx="1.75" fill="#0c1840"/>

      {/* ══ MONEY BAG ══ */}
      <circle cx="11" cy="59.5" r="7" fill="url(#dl-bag)"/>
      {/* Bag neck */}
      <rect x="8.5" y="52" width="5" height="2.5" rx="1.25" fill="#9a7800"/>
      {/* Bag shine */}
      <ellipse cx="9.5" cy="57" rx="2.6" ry="1.9" fill="rgba(255,255,255,0.15)"/>
      {/* $ */}
      <text x="11" y="64" fill="#3a2400"
            fontFamily="Arial,Helvetica,sans-serif" fontSize="8.5"
            fontWeight="bold" textAnchor="middle">$</text>
    </svg>
  );
}
