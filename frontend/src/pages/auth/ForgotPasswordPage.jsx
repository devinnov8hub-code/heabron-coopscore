import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { BRAND } from '@/lib/brand';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function requestReset(e) {
    e.preventDefault();
    setSubmitting(true);
    await api.post('/auth/forgot-password', { email });
    setSubmitting(false);
    setStep(2);
  }

  async function doReset(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { email, code, newPassword });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-smoke hover:text-ink mb-8">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <img src={BRAND.logoUrl} alt={BRAND.name} className="size-10" />
          <div>
            <p className="font-display text-base font-semibold leading-tight">{BRAND.shortName}</p>
            <p className="text-[11px] uppercase tracking-widest text-smoke">Password reset</p>
          </div>
        </div>

        {done ? (
          <div className="card card-pad text-center">
            <CheckCircle2 className="size-12 text-forest-500 mx-auto mb-4" />
            <h2 className="font-display text-2xl font-semibold">Password reset</h2>
            <p className="text-smoke mt-2">You can now sign in with your new password.</p>
            <Link to="/login" className="btn-primary mt-6 inline-flex">Sign in</Link>
          </div>
        ) : step === 1 ? (
          <form onSubmit={requestReset} className="card card-pad space-y-5">
            <div>
              <h1 className="font-display text-3xl font-semibold">Forgot your password?</h1>
              <p className="text-smoke mt-2 text-sm">Enter your email and we'll send you a 6-digit code.</p>
            </div>
            <Field label="Email address" required>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organization.com" />
            </Field>
            <Button type="submit" loading={submitting} className="w-full">Send reset code</Button>
          </form>
        ) : (
          <form onSubmit={doReset} className="card card-pad space-y-5">
            <div>
              <h1 className="font-display text-3xl font-semibold">Enter your reset code</h1>
              <p className="text-smoke mt-2 text-sm">We sent a 6-digit code to <strong>{email}</strong>.</p>
            </div>
            <Field label="6-digit code" required>
              <Input required value={code} maxLength={6} pattern="\d{6}" onChange={(e) => setCode(e.target.value)} placeholder="••••••" className="tabular text-center text-xl tracking-[0.5em]" />
            </Field>
            <Field label="New password" required>
              <Input type="password" required value={newPassword} minLength={6} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
            </Field>
            <Button type="submit" loading={submitting} className="w-full">Reset password</Button>
            <button type="button" onClick={() => setStep(1)} className="block w-full text-center text-sm text-smoke hover:text-ink">
              Didn't get the code? Try again
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
