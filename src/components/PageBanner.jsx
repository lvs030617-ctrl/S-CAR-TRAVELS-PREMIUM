export default function PageBanner({ title, subtitle }) {
  return (
    <div className="page-banner">
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        {/* Left Title & Subtitle */}
        <div style={{ maxWidth: '640px' }} className="anim-fade-up delay-0">
          <h1 style={{
            fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)',
            color: '#ffffff',
            fontWeight: '800',
            marginBottom: '0.4rem',
            lineHeight: 1.2
          }}>
            {title}
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '1rem',
            lineHeight: 1.55
          }}>
            {subtitle}
          </p>
        </div>

        {/* Right Ertiga Banner Thumbnail */}
        <div className="anim-fade-up delay-2" style={{
          width: '280px',
          height: '140px',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--border-gold)',
          flexShrink: 0,
          transition: 'box-shadow 0.2s, transform 0.2s'
        }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 14px 30px rgba(0,0,0,0.6)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
          }}
        >
          <img
            src="/images/ertiga-banner.jpg"
            alt="White Maruti Suzuki Ertiga on Highway"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transition: 'transform 0.5s ease'
            }}
          />
        </div>
      </div>
    </div>
  );
}
