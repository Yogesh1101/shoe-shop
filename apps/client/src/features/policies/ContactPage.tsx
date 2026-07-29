import { Camera, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useGetPublicSettingsQuery } from '@/app/api/settingsApi';
import { Skeleton } from '@/components/ui/primitives';
import { PolicyLayout, PolicySection } from '@/features/policies/PolicyLayout';

export default function ContactPage() {
  const { data: settings, isLoading } = useGetPublicSettingsQuery();

  return (
    <PolicyLayout title="Contact us" updated="29 July 2026">
      <PolicySection title="Get in touch">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-56" />
          </div>
        ) : (
          <ul className="space-y-3">
            {settings?.contactPhone && (
              <li>
                <a
                  href={`tel:+91${settings.contactPhone}`}
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <Phone className="size-4 shrink-0" aria-hidden />
                  +91 {settings.contactPhone}
                </a>
              </li>
            )}
            {settings?.contactEmail && (
              <li>
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <Mail className="size-4 shrink-0" aria-hidden />
                  {settings.contactEmail}
                </a>
              </li>
            )}
            {settings?.instagramUrl && (
              <li>
                <a
                  href={settings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <Camera className="size-4 shrink-0" aria-hidden />
                  Message us on Instagram
                </a>
              </li>
            )}
          </ul>
        )}
      </PolicySection>

      <PolicySection title="Already have an order?">
        <p>
          For the fastest response on an existing order, have your order number ready — you can look
          it up yourself any time on the{' '}
          <Link to="/track" className="underline hover:no-underline">
            order tracking page
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection title="Response time">
        <p>
          We aim to reply to phone, email and Instagram messages within one business day. For order
          issues, mentioning your order number in the first message helps us help you faster.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
