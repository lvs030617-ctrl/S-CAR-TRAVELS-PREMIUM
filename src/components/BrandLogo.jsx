export default function BrandLogo({ size = 'md', showTagline = false }) {
  const isLarge = size === 'lg';
  const isSmall = size === 'sm';

  const iconSize = isLarge ? 54 : isSmall ? 32 : 42;
  const titleSize = isLarge ? '1.5rem' : isSmall ? '1.05rem' : '1.25rem';
  const subSize = isLarge ? '0.78rem' : isSmall ? '0.62rem' : '0.7rem';

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: isSmall ? '0.5rem' : '0.75rem',
      userSelect: 'none',
      textDecoration: 'none'
    }}>
      {/* Golden stylized S emblem */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 8px rgba(224, 184, 90, 0.4))' }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF275" />
            <stop offset="30%" stopColor="#F5C518" />
            <stop offset="70%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#9A7B1C" />
          </linearGradient>
          <linearGradient id="goldSheen" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9A7B1C" />
            <stop offset="50%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#D4AF37" />
          </linearGradient>
        </defs>
        <path
          d="M72 26 C68 16 52 12 38 16 C22 21 16 35 22 47 C28 58 46 61 58 67 C72 74 76 83 70 91 C62 99 40 98 28 88 C24 84 21 78 20 74 L32 71 C34 78 44 86 54 84 C62 82 64 73 58 67 C48 57 26 55 16 43 C6 30 14 12 36 6 C56 0 76 6 82 22 Z"
          fill="url(#goldGradient)"
        />
        <path
          d="M38 18 C52 14 66 18 70 26 L58 31 C56 26 46 23 38 25 Z"
          fill="url(#goldSheen)"
          opacity="0.9"
        />
      </svg>

      {/* Brand Text — always white since used on dark backgrounds (nav, footer, hero) */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{
          color: '#ffffff',
          fontWeight: '900',
          fontSize: titleSize,
          letterSpacing: '0.04em',
          lineHeight: 1.1,
          fontFamily: "'Outfit', sans-serif"
        }}>
          S CAR TRAVELS
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          color: '#E0B85A',
          fontSize: subSize,
          fontWeight: '700',
          letterSpacing: '0.22em',
          marginTop: '2px',
          fontFamily: "'Outfit', sans-serif"
        }}>
          <span style={{ height: '1px', width: '14px', background: '#E0B85A', opacity: 0.8 }} />
          <span>PREMIUM</span>
          <span style={{ height: '1px', width: '14px', background: '#E0B85A', opacity: 0.8 }} />
        </div>
        {showTagline && (
          <div style={{
            color: '#E0B85A',
            fontSize: '0.85rem',
            fontStyle: 'italic',
            fontWeight: '600',
            marginTop: '0.25rem'
          }}>
            "Mee Prayanam… Maa Badhyata!"
          </div>
        )}
      </div>
    </div>
  );
}
