import { Link } from 'react-router-dom';

import { useGetPublicSettingsQuery } from '@/app/api/settingsApi';
import { PolicyLayout, PolicySection } from '@/features/policies/PolicyLayout';

export default function TermsPage() {
  const { data: settings } = useGetPublicSettingsQuery();
  const shopName = settings?.shopName ?? 'Shoe Shop';

  return (
    <PolicyLayout title="Terms & Conditions" updated="29 July 2026">
      <PolicySection title="1. Acceptance of these terms">
        <p>
          These terms govern every order placed on the {shopName} website. By browsing the site or
          placing an order, you agree to them. If you do not agree, please do not use the site.
        </p>
      </PolicySection>

      <PolicySection title="2. Products and pricing">
        <p>
          All prices are listed in Indian Rupees (₹) and are inclusive of GST unless stated
          otherwise on the product page. We reserve the right to correct pricing or listing errors,
          and to change prices at any time before an order is placed. Product photos are
          representative; minor variation in colour or finish can occur between what you see on
          screen and the physical product.
        </p>
        <p>
          Stock shown on the site reflects our records at the time of viewing. Placing an item in
          your cart does not reserve it — availability is confirmed only once an order is placed.
        </p>
      </PolicySection>

      <PolicySection title="3. Orders and payment">
        <p>
          Orders can be paid for online via Razorpay (cards, UPI, netbanking and wallets) or, where
          offered, by cash on delivery. An order is confirmed once payment is captured (for online
          payment) or immediately on placement (for cash on delivery). We may decline or cancel an
          order — for example if stock runs out between browsing and checkout, if payment cannot be
          verified, or if we suspect fraudulent or abusive use of cash on delivery.
        </p>
      </PolicySection>

      <PolicySection title="4. Delivery">
        <p>
          See our{' '}
          <Link to="/policies/shipping" className="underline hover:no-underline">
            Shipping Policy
          </Link>{' '}
          for delivery areas, timelines and charges.
        </p>
      </PolicySection>

      <PolicySection title="5. Cancellations and returns">
        <p>
          See our{' '}
          <Link to="/policies/refund" className="underline hover:no-underline">
            Refunds & Cancellations
          </Link>{' '}
          policy.
        </p>
      </PolicySection>

      <PolicySection title="6. Intellectual property">
        <p>
          All content on this site — product photography, descriptions, logos and layout — belongs
          to {shopName} or its licensors and may not be copied or reused without permission.
        </p>
      </PolicySection>

      <PolicySection title="7. Limitation of liability">
        <p>
          We are not liable for indirect or consequential loss arising from use of this site or from
          a delayed or failed delivery beyond our reasonable control (courier delays, force majeure,
          an incorrect address supplied at checkout). Nothing in these terms limits any right you
          have under Indian consumer protection law that cannot be excluded.
        </p>
      </PolicySection>

      <PolicySection title="8. Governing law">
        <p>
          These terms are governed by the laws of India, and disputes are subject to the courts
          having jurisdiction at our registered place of business.
        </p>
      </PolicySection>

      <PolicySection title="9. Contact">
        <p>
          Questions about these terms can be sent to us — see{' '}
          <Link to="/contact" className="underline hover:no-underline">
            Contact us
          </Link>
          .
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
