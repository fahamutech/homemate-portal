import {useState} from 'react';
import type {FormEvent} from 'react';
import {httpAdminAuthClient, AdminAuthApiError, type AdminAuthClient, type AdminLoginResult} from '../../api/adminAuthClient';
import homeIcon from '../../assets/icons/home.svg';
import eyeOffIcon from '../../assets/icons/eye-off.svg';
import styles from './AdminLoginScreen.module.css';

export interface AdminLoginScreenProps {
  /** Defaults to the real backend client; tests inject a fake. */
  client?: AdminAuthClient;
  onAuthenticated: (session: AdminLoginResult) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof AdminAuthApiError) return error.message;
  return 'Something went wrong. Please try again.';
}

/**
 * Pixel reference: Figma node 86:8 "BO-LOGIN - Backoffice Login - Default -
 * Desktop 1440" (fileKey joLKZpKfnOx26AQUUeVPEC). "Forgot Password?" is
 * rendered per the design but has no handler yet — password reset isn't
 * built (there is exactly one predefined admin account for now).
 */
export function AdminLoginScreen({client = httpAdminAuthClient, onAuthenticated}: AdminLoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await client.login(email, password);
      onAuthenticated(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoRow}>
            <div className={styles.logoIcon}>
              <img src={homeIcon} alt="" />
            </div>
            <div className={styles.logoText}>
              <p className={styles.logoTitle}>HomeMate</p>
              <p className={styles.logoSubtitle}>Africa Admin</p>
            </div>
          </div>
          <div className={styles.subHeadings}>
            <p className={styles.title}>Admin Backoffice Portal</p>
            <p className={styles.subtitle}>Sign in to manage listings, brokers &amp; settlements</p>
          </div>
        </div>

        {error && (
          <div className={styles.alert} role="alert">
            {error}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email Address</label>
            <div className={styles.inputBox}>
              <input
                id="email"
                type="email"
                placeholder="you@homemate.co.tz"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="password">Password</label>
              <button type="button" className={styles.forgotLink} disabled>
                Forgot Password?
              </button>
            </div>
            <div className={styles.inputBox}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <img src={eyeOffIcon} alt="" />
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.signInButton} type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign In to Backoffice'}
            </button>
            <p className={styles.disclaimer}>Access restricted to authorized personnel only. IP address logged.</p>
          </div>
        </form>
      </div>

      <p className={styles.copyright}>
        © {new Date().getFullYear()} HomeMate Africa. All rights reserved. Dar es Salaam, Tanzania.
      </p>
    </div>
  );
}
