import { Link } from 'react-router-dom';
import { Phone, MessageCircle, CalendarCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function BottomBar() {
  const { t } = useLanguage();

  return (
    <aside aria-label="Quick mobile contacts" className="mobile-bottom-bar">
      <a
        href="tel:+919550641408"
        className="btn btn-phone btn-sm"
        style={{ flex: 1, padding: '0.65rem 0.5rem', fontSize: '0.82rem' }}
      >
        <Phone size={15} />
        <span>{t.callNow}</span>
      </a>

      <a
        href="https://wa.me/919550641408?text=Hello%20Srinu%20Garu%2C%20I%20am%20inquiring%20about%20booking%20the%20white%20Suzuki%20Ertiga%20from%20Kotananduru."
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-whatsapp btn-sm"
        style={{ flex: 1, padding: '0.65rem 0.5rem', fontSize: '0.82rem' }}
      >
        <MessageCircle size={15} />
        <span>WhatsApp</span>
      </a>

      <Link
        to="/book"
        className="btn btn-gold btn-sm"
        style={{ flex: 1.1, padding: '0.65rem 0.5rem', fontSize: '0.82rem' }}
      >
        <CalendarCheck size={15} />
        <span>{t.navBook}</span>
      </Link>
    </aside>
  );
}
