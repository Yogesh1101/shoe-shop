import { Link } from 'react-router-dom';

import { useGetPublicSettingsQuery } from '@/app/api/settingsApi';
import { PolicyLayout, PolicySection } from '@/features/policies/PolicyLayout';

export default function PrivacyPage() {
  const { data: settings } = useGetPublicSettingsQuery();
  const shopName = settings?.shopName ?? 'Shoe Shop';

  return (
    <PolicyLayout title="Privacy Policy" updated="29 July 2026">
      <PolicySection title="What we collect">
        <p>
          There are no user accounts on this site. When you place an order, we collect your name,
          phone number, email address and delivery address — everything needed to deliver the order,
          confirm it with you, and issue a GST invoice. Your cart contents are stored only in your
          own browser, not on our servers, until you check out.
        </p>
      </PolicySection>

      <PolicySection title="How we use it">
        <p>
          Order details are used to fulfil, confirm and, where cash on delivery is chosen, verify
          the order is genuine. Your email may be used to send order confirmations and delivery
          updates. We do not sell or rent your information to third parties, and we do not use it
          for marketing without your consent.
        </p>
      </PolicySection>

      <PolicySection title="Who we share it with">
        <p>Order data is shared only with the services that need it to complete your order:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Razorpay, to process online payments — we never see or store your card or UPI details.
          </li>
          <li>Our delivery partner, to ship your order to the address you provide.</li>
          <li>Brevo, our email provider, to send order confirmations.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Tracking your own order">
        <p>
          Because there are no accounts, your order number together with your phone number acts as a
          shared secret to look up an order on our{' '}
          <Link to="/track" className="underline hover:no-underline">
            order tracking page
          </Link>
          . Keep your order number private if you do not want someone else to view it.
        </p>
      </PolicySection>

      <PolicySection title="Cookies and local storage">
        <p>
          We use your browser's local storage to remember your cart between visits, and to keep you
          signed in to the admin panel if you are the shop owner. We do not use third-party
          advertising or tracking cookies.
        </p>
      </PolicySection>

      <PolicySection title="Data retention">
        <p>
          Order records, including the GST invoice, are kept for as long as required under Indian
          tax law. You can ask us to delete personal information we hold that is not required for a
          legal or accounting purpose by contacting us.
        </p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>
          For any privacy question or request, see{' '}
          <Link to="/contact" className="underline hover:no-underline">
            Contact us
          </Link>
          . This policy may be updated from time to time; the date at the top of this page shows the
          last revision to {shopName}'s policy.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
