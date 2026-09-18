import {describe, test, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {AdminLoginScreen} from './AdminLoginScreen';
import {createFakeAdminAuthClient} from '../../api/adminAuthClient.fake';
import {AdminAuthApiError} from '../../api/adminAuthClient';

const VALID_EMAIL = 'admin@homemate.co.tz';
const VALID_PASSWORD = 'correct-horse-battery-staple';

describe('AdminLoginScreen — email/password login journey', () => {
  test('renders the email and password fields and a sign-in button', () => {
    render(<AdminLoginScreen client={createFakeAdminAuthClient()} onAuthenticated={vi.fn()} />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /sign in to backoffice/i})).toBeInTheDocument();
  });

  test('the password field is masked by default and can be revealed', async () => {
    const user = userEvent.setup();
    render(<AdminLoginScreen client={createFakeAdminAuthClient()} onAuthenticated={vi.fn()} />);

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', {name: /show password/i}));
    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('correct credentials call onAuthenticated with the session', async () => {
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(<AdminLoginScreen client={createFakeAdminAuthClient()} onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText(/email address/i), VALID_EMAIL);
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', {name: /sign in to backoffice/i}));

    expect(onAuthenticated).toHaveBeenCalledWith({
      token: expect.any(String),
      admin: expect.objectContaining({email: VALID_EMAIL, role: 'admin'}),
    });
  });

  test('incorrect credentials show an error and never call onAuthenticated', async () => {
    const onAuthenticated = vi.fn();
    const client = createFakeAdminAuthClient({
      login: vi.fn().mockRejectedValue(new AdminAuthApiError('INVALID_CREDENTIALS', 'Incorrect email or password', 401)),
    });
    const user = userEvent.setup();
    render(<AdminLoginScreen client={client} onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText(/email address/i), VALID_EMAIL);
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', {name: /sign in to backoffice/i}));

    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect email or password/i);
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  test('the sign-in button is disabled while the request is in flight', async () => {
    let resolveLogin: (value: unknown) => void = () => {};
    const client = createFakeAdminAuthClient({
      login: vi.fn().mockReturnValue(new Promise((resolve) => { resolveLogin = resolve; })),
    });
    const user = userEvent.setup();
    render(<AdminLoginScreen client={client} onAuthenticated={vi.fn()} />);

    await user.type(screen.getByLabelText(/email address/i), VALID_EMAIL);
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', {name: /sign in to backoffice/i}));

    expect(screen.getByRole('button', {name: /signing in/i})).toBeDisabled();
    resolveLogin({token: 'x', admin: {email: VALID_EMAIL, role: 'admin'}});
  });
});
