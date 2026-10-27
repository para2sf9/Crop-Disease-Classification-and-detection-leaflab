export default function LeafSpecimen() {
  return (
    <figure className="specimen reveal" aria-label="Stylized leaf specimen diagram">
      <svg viewBox="0 0 440 280" role="img" aria-label="Botanical leaf with classification scan line">
        <defs>
          <linearGradient id="leafFill" x1="80" y1="220" x2="340" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6F9C72" />
            <stop offset="1" stopColor="#194D34" />
          </linearGradient>
          <clipPath id="leafClip">
            <path d="M83 222C78 150 117 70 327 48c-5 156-101 210-244 174Z" />
          </clipPath>
        </defs>
        <path d="M83 222C78 150 117 70 327 48c-5 156-101 210-244 174Z" fill="url(#leafFill)" stroke="#123B27" strokeWidth="2" />
        <g clipPath="url(#leafClip)" fill="none" stroke="#D7E8D5" strokeOpacity=".55" strokeWidth="2">
          <path d="M82 222C170 155 244 95 326 50" />
          <path d="m145 175-7-57m37 31 4-71m12 50 42-58m-29 94 72-42m-91 55 80-6m-112-12-41 22m92-57 42 16m-78-37 59 3" />
        </g>
        <g fill="#BB6542" opacity=".87">
          <ellipse cx="190" cy="153" rx="8" ry="5" transform="rotate(-37 190 153)" />
          <ellipse cx="226" cy="130" rx="5" ry="3.4" transform="rotate(-30 226 130)" />
          <ellipse cx="252" cy="177" rx="7" ry="4.5" transform="rotate(-18 252 177)" />
          <ellipse cx="162" cy="191" rx="5" ry="3" transform="rotate(-42 162 191)" />
        </g>
        <path d="M82 222c-15 13-25 25-31 39" stroke="#264A33" strokeWidth="3" strokeLinecap="round" />
        <path d="M51 50h18M51 50v18m338-18h-18m18 0v18M51 240v-18m0 18h18m320 0h-18m18 0v-18" stroke="#1E6B4A" strokeWidth="1.6" />
        <g className="scan">
          <path d="M52 0h336" stroke="#A8401F" strokeWidth="1.5" strokeDasharray="5 5" />
          <rect x="52" y="-8" width="336" height="16" fill="#A8401F" opacity=".09" />
        </g>
        <g fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="#415C49" letterSpacing="1">
          <text x="58" y="37">SPECIMEN 04 / SOLANUM</text>
          <text x="298" y="262">LEAF SURFACE · RGB</text>
        </g>
        <circle cx="190" cy="153" r="12" fill="none" stroke="#F5F7EF" strokeWidth="1.2" strokeDasharray="2 3" />
        <circle cx="190" cy="153" r="2.2" fill="#F5F7EF" />
      </svg>
      <figcaption>
        <span>FIELD NOTE 04 · VISUAL CLASSIFICATION</span>
        <span>EST. 2025</span>
      </figcaption>
    </figure>
  );
}
