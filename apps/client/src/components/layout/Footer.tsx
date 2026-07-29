import { Camera, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useGetPublicSettingsQuery } from '@/app/api/settingsApi';

/**
 * The policy links are not decoration: Razorpay's activation review requires
 * Terms, Privacy, Refund, Shipping and Contact pages to be reachable on the
 * live site. The pages themselves arrive in phase 10.
 */
const POLICY_LINKS = [
  { to: '/policies/terms', label: 'Terms & conditions' },
  { to: '/policies/privacy', label: 'Privacy policy' },
  { to: '/policies/refund', label: 'Refunds & cancellations' },
  { to: '/policies/shipping', label: 'Shipping policy' },
  { to: '/contact', label: 'Contact us' },
] as const;

export function Footer() {
  const { data: settings } = useGetPublicSettingsQuery();

  return (
    <footer className="mt-20 border-t">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <h2 className="text-sm font-semibold">{settings?.shopName ?? 'Shoe Shop'}</h2>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Handpicked shoes, delivered across India.
          </p>
          {settings?.instagramUrl && (
            <a
              href={settings.instagramUrl}
              target="_blank"
              // noreferrer alongside noopener: the target page should not learn
              // where its traffic came from, and cannot touch window.opener.
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm hover:underline"
            >
              {/* lucide-react 1.x removed brand marks, so a generic camera
                  stands in for the Instagram glyph. */}
              <Camera className="size-4" aria-hidden />
              Follow on Instagram
            </a>
          )}
        </div>

        <nav aria-label="Policies">
          <h2 className="text-sm font-semibold">Information</h2>
          <ul className="mt-3 space-y-2">
            {POLICY_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-muted-foreground hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/track" className="text-sm text-muted-foreground hover:underline">
                Track your order
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold">Get in touch</h2>
          <ul className="mt-3 space-y-2">
            {settings?.contactPhone && (
              <li>
                <a
                  href={`tel:+91${settings.contactPhone}`}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
                >
                  <Phone className="size-4" aria-hidden />
                  +91 {settings.contactPhone}
                </a>
              </li>
            )}
            {settings?.contactEmail && (
              <li>
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
                >
                  <Mail className="size-4" aria-hidden />
                  {settings.contactEmail}
                </a>
              </li>
            )}
          </ul>
          {settings?.estimatedDeliveryDays && (
            <p className="mt-4 text-sm text-muted-foreground">
              Delivery in {settings.estimatedDeliveryDays}.
            </p>
          )}
        </div>
      </div>

      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {settings?.shopName ?? 'Shoe Shop'}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
