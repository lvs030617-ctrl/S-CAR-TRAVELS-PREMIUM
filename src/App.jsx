import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import BottomBar from './components/BottomBar';

// Public Pages
import Home from './pages/Home';
import Services from './pages/Services';
import Pricing from './pages/Pricing';
import Destinations from './pages/Destinations';
import Booking from './pages/Booking';
import Confirmation from './pages/Confirmation';
import TrackBooking from './pages/TrackBooking';
import AboutContact from './pages/AboutContact';
import PrivacyTerms from './pages/PrivacyTerms';

// Admin Pages
import AdminLogin from './pages/admin/Login';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import BookingsList from './pages/admin/BookingsList';
import PricingManager from './pages/admin/PricingManager';
import DestinationsManager from './pages/admin/DestinationsManager';
import VehicleManager from './pages/admin/VehicleManager';
import BlockedDatesManager from './pages/admin/BlockedDatesManager';
import SettingsManager from './pages/admin/SettingsManager';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <button
      className={`back-to-top${visible ? ' visible' : ''}`}
      onClick={scrollTop}
      aria-label="Back to top"
      title="Back to top"
    >
      <ChevronUp size={20} />
    </button>
  );
}

export default function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <>
      <ScrollToTop />
      {!isAdminRoute && <Navbar />}

      <main
        key={location.pathname}
        style={{
          minHeight: '80vh',
          animation: 'fadeUp 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) both'
        }}
      >
        <Routes>
          {/* Public Website Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/destinations" element={<Destinations />} />
          <Route path="/book" element={<Booking />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/track" element={<TrackBooking />} />
          <Route path="/about" element={<AboutContact />} />
          <Route path="/contact" element={<AboutContact />} />
          <Route path="/privacy-terms" element={<PrivacyTerms />} />

          {/* Admin Authentication */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Protected Admin Portal */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="bookings" element={<BookingsList />} />
            <Route path="pricing" element={<PricingManager />} />
            <Route path="destinations" element={<DestinationsManager />} />
            <Route path="vehicle" element={<VehicleManager />} />
            <Route path="blocked-dates" element={<BlockedDatesManager />} />
            <Route path="settings" element={<SettingsManager />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!isAdminRoute && (
        <>
          <Footer />
          <BottomBar />
          <BackToTop />
        </>
      )}
    </>
  );
}
