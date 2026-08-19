export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  if (code === 'auth/missing-email') return 'Enter your email address first.';
  if (code === 'auth/too-many-requests') return 'Too many sign-in attempts. Wait a few minutes, then try again or reset your password.';
  if (code === 'auth/invalid-credential') return 'Incorrect email address or password.';
  if (code === 'auth/user-not-found') return 'No account was found for that email address.';
  return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
}
