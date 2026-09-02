import { Suspense } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SignInClient } from './signin-client';

export const metadata = { title: 'Sign in' };

export default function SignInPage() {
  // The form reads ?reason= and ?callbackUrl= off the URL, so it has to sit
  // behind a Suspense boundary rather than be prerendered.
  return (
    <Suspense fallback={<AuthLayout>{null}</AuthLayout>}>
      <SignInClient />
    </Suspense>
  );
}
