import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { BRAND } from '@/lib/brand';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await login(email, password);
      if (data.user?.mustChangePassword) {
        navigate('/change-password');
        return;
      }
      const dest = data.user?.role?.startsWith('partner')
        ? '/partner'
        : data.user?.role === 'field_agent'
        ? '/no-web-access'
        : '/admin';
      navigate(location.state?.from?.pathname || dest);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — Form */}
      <div className="flex flex-col px-6 py-10 md:px-12 lg:px-20">
        <div className="flex items-center gap-3 mb-12">
          <img src={BRAND.logoUrl} alt={BRAND.name} className="size-11" />
          <div>
            <p className="font-display text-lg font-semibold leading-tight">{BRAND.shortName}</p>
            <p className="text-[11px] uppercase tracking-widest text-smoke">by Heabron Farm</p>
          </div>
        </div>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-md">
            <p className="eyebrow mb-3">Welcome back</p>
            <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight text-ink">
              Sign in to your account
            </h1>
            <p className="text-smoke mt-3 max-w-sm">
              Admin and partner access to the {BRAND.shortName} platform.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <Field label="Email address" required>
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@organization.com"
                />
              </Field>

              <Field label="Password" required>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-smoke hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
                  {error}
                </div>
              )}

              <Button type="submit" loading={submitting} className="w-full">
                Sign in <ArrowRight className="size-4" />
              </Button>

              <div className="flex items-center justify-between text-sm">
                <Link to="/forgot" className="text-forest-500 hover:text-forest-700 font-medium">
                  Forgot password?
                </Link>
                <a href={BRAND.website} className="text-smoke hover:text-ink">Visit website</a>
              </div>
            </form>
          </div>
        </div>

        <p className="text-xs text-smoke mt-8">
          © {new Date().getFullYear()} Heabron Farm Limited · <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-ink">{BRAND.supportEmail}</a>
        </p>
      </div>

      {/* Right — Decorative panel */}
      <div className="hidden lg:flex relative bg-forest-500 overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 50%), radial-gradient(circle at 70% 80%, rgba(224,168,46,0.25), transparent 50%)',
        }} />
        <svg className="absolute inset-0 size-full text-white/5" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <pattern id="dots" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.4" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#dots)" />
        </svg>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-harvest-400" />
            <span className="text-[11px] uppercase tracking-widest text-white/70">Cooperative credit infrastructure</span>
          </div>

          <div>
            <p className="font-display text-3xl md:text-5xl font-semibold leading-[1.08] max-w-md">
              Replacing collateral with verified production data.
            </p>
            <p className="mt-6 text-white/80 max-w-md text-base leading-relaxed">
              CoopScore turns smallholder yield, repayment, and cooperative discipline into a
              credit score that lenders can actually trust — even when borrowers have no
              traditional history.
            </p>

            <div className="grid grid-cols-3 gap-4 mt-12 max-w-lg">
              <Stat number="50%" label="Production" />
              <Stat number="50%" label="Repayment" />
              <Stat number="4" label="Risk tiers" />
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-widest text-white/50">
            Powered by NIMC NIN verification · Cooperative-grade data
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ number, label }) {
  return (
    <div>
      <p className="font-display text-4xl font-semibold tabular text-harvest-300">{number}</p>
      <p className="text-xs uppercase tracking-widest text-white/60 mt-1">{label}</p>
    </div>
  );
}
