import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, ArrowRight, ArrowLeft, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogin() {
  const {
    initiateLogin,
    verifyLoginOtp,
    resendLoginOtp,
    forgotPassword,
    resendResetOtp,
    verifyResetOtp,
    resetPassword,
    isAuthenticated
  } = useAuth();
  const navigate = useNavigate();

  // Multi-step authentication & recovery state:
  // 'credentials' | 'otp' | 'forgot_email' | 'forgot_otp' | 'forgot_new_password'
  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Timers and countdowns
  const [expiresIn, setExpiresIn] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(60);

  // Status feedback
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Auto-redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Countdown timers for OTP expiration and resend cooldown (for both login and reset OTPs)
  useEffect(() => {
    if (step !== 'otp' && step !== 'forgot_otp') return;

    const interval = setInterval(() => {
      setExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  if (isAuthenticated) {
    return null;
  }

  // Helper to format remaining seconds as mm:ss
  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Step 1: Submit email & password for Login
  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      const res = await initiateLogin(email, password);
      if (res?.step === 'otp_required') {
        setChallengeId(res.challengeId);
        setEmailMasked(res.emailMasked || email);
        setExpiresIn(res.expiresInSeconds || 300);
        setResendCooldown(res.resendCooldownSeconds || 60);
        setOtp('');
        setStep('otp');
        setInfoMsg(`Security code sent to ${res.emailMasked || email}`);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify 8-digit Login OTP
  const handleLoginOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setErrorMsg('Please enter the 8-digit verification code.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      await verifyLoginOtp(challengeId, otp.trim());
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend Login OTP handler
  const handleResendLoginOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setErrorMsg('');
    setInfoMsg('');
    setResending(true);

    try {
      const res = await resendLoginOtp(challengeId);
      if (res?.challengeId) {
        setChallengeId(res.challengeId);
        setExpiresIn(res.expiresInSeconds || 300);
        setResendCooldown(res.resendCooldownSeconds || 60);
        setOtp('');
        setInfoMsg(`A fresh 8-digit code has been emailed to ${emailMasked}`);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to resend verification code');
    } finally {
      setResending(false);
    }
  };

  // Step 3 (Forgot Password): Request Reset OTP
  const handleForgotEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your registered admin email.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      const res = await forgotPassword(email.trim());
      setChallengeId(res.challengeId);
      setEmailMasked(res.emailMasked || email.trim());
      setExpiresIn(res.expiresInSeconds || 300);
      setResendCooldown(res.resendCooldownSeconds || 60);
      setOtp('');
      setStep('forgot_otp');
      setInfoMsg(res.message || 'If an account matches this email, a verification code has been sent.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to request password reset code');
    } finally {
      setLoading(false);
    }
  };

  // Step 4 (Forgot Password): Verify Reset OTP -> obtain resetToken
  const handleForgotOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setErrorMsg('Please enter the 8-digit recovery code.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      const res = await verifyResetOtp(challengeId, otp.trim());
      setResetToken(res.resetToken);
      setStep('forgot_new_password');
      setNewPassword('');
      setConfirmPassword('');
      setInfoMsg('Recovery code verified. Please set your new password.');
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend Reset OTP handler
  const handleResendResetOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setErrorMsg('');
    setInfoMsg('');
    setResending(true);

    try {
      const res = await resendResetOtp(challengeId);
      if (res?.challengeId) {
        setChallengeId(res.challengeId);
        setExpiresIn(res.expiresInSeconds || 300);
        setResendCooldown(res.resendCooldownSeconds || 60);
        setOtp('');
        setInfoMsg(`A fresh 8-digit recovery code has been emailed to ${emailMasked}`);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to resend recovery code');
    } finally {
      setResending(false);
    }
  };

  // Step 5 (Forgot Password): Save New Password
  const handleNewPasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      const res = await resetPassword(resetToken, newPassword);
      setStep('credentials');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setResetToken('');
      setInfoMsg(res.message || 'Password reset successfully. Please log in with your new password.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Return to credentials step
  const handleBackToCredentials = () => {
    setStep('credentials');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
    setInfoMsg('');
  };

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div className="gold-card" style={{ maxWidth: '440px', width: '100%', padding: '2.5rem' }}>
        
        {/* Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'var(--bg-elevated)',
            border: '2px solid var(--border-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gold-bright)',
            margin: '0 auto 1rem'
          }}>
            {step === 'credentials' && <Lock size={26} />}
            {step === 'otp' && <ShieldCheck size={28} />}
            {step === 'forgot_email' && <KeyRound size={26} />}
            {step === 'forgot_otp' && <ShieldCheck size={28} />}
            {step === 'forgot_new_password' && <Lock size={26} />}
          </div>

          <h1 style={{ fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            {step === 'credentials' && 'Owner Administration'}
            {step === 'otp' && 'Security Verification'}
            {step === 'forgot_email' && 'Forgot Password'}
            {step === 'forgot_otp' && 'Reset Verification'}
            {step === 'forgot_new_password' && 'Set New Password'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {step === 'credentials' && 'S CAR TRAVELS PREMIUM • Srinu'}
            {step === 'otp' && `Enter the 8-digit security code sent to ${emailMasked}`}
            {step === 'forgot_email' && 'Enter your registered email to receive an 8-digit recovery code.'}
            {step === 'forgot_otp' && `Enter the 8-digit recovery code sent to ${emailMasked}`}
            {step === 'forgot_new_password' && 'Enter and confirm your new admin password (minimum 8 characters).'}
          </p>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div style={{
            background: 'var(--color-error-bg)',
            border: '1px solid rgba(248, 113, 113, 0.35)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: 'var(--color-error)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'slideDown 0.2s ease both'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && !errorMsg && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: '#60a5fa',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'slideDown 0.2s ease both'
          }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* STEP 1: Registered Admin Email + Password (LOGIN) */}
        {step === 'credentials' && (
          <form onSubmit={handleCredentialSubmit}>
            <div className="form-group">
              <label className="form-label">Registered Admin Email</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  autoComplete="username email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="admin@scar.com or registered email"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setInfoMsg('');
                    setStep('forgot_email');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--gold-bright)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 500
                  }}
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-gold"
              style={{ width: '100%', padding: '0.85rem', gap: '0.65rem' }}
            >
              {loading && <span className="spinner" />}
              <span>{loading ? 'Verifying Credentials...' : 'Send Verification Code'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        )}

        {/* STEP 2: 8-digit OTP Verification (LOGIN) */}
        {step === 'otp' && (
          <form onSubmit={handleLoginOtpSubmit}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>8-Digit Security Code</span>
                <span style={{
                  fontSize: '0.8rem',
                  color: expiresIn > 60 ? 'var(--gold-bright)' : 'var(--color-error)',
                  fontWeight: 600
                }}>
                  {expiresIn > 0 ? `Expires in ${formatTimer(expiresIn)}` : 'Expired'}
                </span>
              </label>

              <input
                type="text"
                required
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="form-input"
                placeholder="••••••••"
                style={{
                  textAlign: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  letterSpacing: '6px',
                  fontFamily: 'monospace',
                  padding: '0.75rem'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || expiresIn === 0 || otp.length < 6}
              className="btn btn-gold"
              style={{ width: '100%', padding: '0.85rem', gap: '0.65rem', marginBottom: '1rem' }}
            >
              {loading && <span className="spinner" />}
              <span>{loading ? 'Verifying Code...' : 'Verify & Enter Dashboard'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>

            {/* Resend and Return Actions */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.85rem'
            }}>
              <button
                type="button"
                onClick={handleBackToCredentials}
                disabled={loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '4px 0'
                }}
              >
                <ArrowLeft size={14} />
                <span>Change Email</span>
              </button>

              <button
                type="button"
                onClick={handleResendLoginOtp}
                disabled={resendCooldown > 0 || resending || loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--gold-bright)',
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '4px 0',
                  fontWeight: 500
                }}
              >
                <RefreshCw size={14} className={resending ? 'spinner' : ''} />
                <span>
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Forgot Password - Request Recovery Code */}
        {step === 'forgot_email' && (
          <form onSubmit={handleForgotEmailSubmit}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Registered Admin Email</label>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="admin@scar.com or registered email"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-gold"
              style={{ width: '100%', padding: '0.85rem', gap: '0.65rem', marginBottom: '1rem' }}
            >
              {loading && <span className="spinner" />}
              <span>{loading ? 'Sending Code...' : 'Send Recovery Code'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleBackToCredentials}
                disabled={loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  padding: '4px 0'
                }}
              >
                <ArrowLeft size={14} />
                <span>Back to Login</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: Forgot Password - 8-digit OTP Verification */}
        {step === 'forgot_otp' && (
          <form onSubmit={handleForgotOtpSubmit}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>8-Digit Recovery Code</span>
                <span style={{
                  fontSize: '0.8rem',
                  color: expiresIn > 60 ? 'var(--gold-bright)' : 'var(--color-error)',
                  fontWeight: 600
                }}>
                  {expiresIn > 0 ? `Expires in ${formatTimer(expiresIn)}` : 'Expired'}
                </span>
              </label>

              <input
                type="text"
                required
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="form-input"
                placeholder="••••••••"
                style={{
                  textAlign: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  letterSpacing: '6px',
                  fontFamily: 'monospace',
                  padding: '0.75rem'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || expiresIn === 0 || otp.length < 6}
              className="btn btn-gold"
              style={{ width: '100%', padding: '0.85rem', gap: '0.65rem', marginBottom: '1rem' }}
            >
              {loading && <span className="spinner" />}
              <span>{loading ? 'Verifying Code...' : 'Verify Recovery Code'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>

            {/* Resend and Return Actions */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.85rem'
            }}>
              <button
                type="button"
                onClick={() => {
                  setStep('forgot_email');
                  setOtp('');
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                disabled={loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '4px 0'
                }}
              >
                <ArrowLeft size={14} />
                <span>Change Email</span>
              </button>

              <button
                type="button"
                onClick={handleResendResetOtp}
                disabled={resendCooldown > 0 || resending || loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--gold-bright)',
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '4px 0',
                  fontWeight: 500
                }}
              >
                <RefreshCw size={14} className={resending ? 'spinner' : ''} />
                <span>
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 5: Forgot Password - Set New Password */}
        {step === 'forgot_new_password' && (
          <form onSubmit={handleNewPasswordSubmit}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">New Password</label>
              <input
                type="password"
                required
                autoFocus
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                placeholder="At least 8 characters"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                placeholder="Re-enter new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
              className="btn btn-gold"
              style={{ width: '100%', padding: '0.85rem', gap: '0.65rem', marginBottom: '1rem' }}
            >
              {loading && <span className="spinner" />}
              <span>{loading ? 'Updating Password...' : 'Reset & Save Password'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleBackToCredentials}
                disabled={loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  padding: '4px 0'
                }}
              >
                <ArrowLeft size={14} />
                <span>Cancel & Back to Login</span>
              </button>
            </div>
          </form>
        )}

        {/* Return to Public Website link */}
        <div style={{ textAlign: 'center', marginTop: '1.75rem' }}>
          <Link to="/" style={{ color: 'var(--gold-bright)', fontSize: '0.85rem' }}>
            ← Return to Public Website
          </Link>
        </div>
      </div>
    </div>
  );
}
