import { Link } from 'react-router-dom';

import { PolicyLayout, PolicySection } from '@/features/policies/PolicyLayout';

export default function RefundPolicyPage() {
  return (
    <PolicyLayout title="Refunds & Cancellations" updated="29 July 2026">
      <PolicySection title="Cancelling an order">
        <p>
          You can request a cancellation any time before an order is packed for shipping by
          contacting us with your order number — see{' '}
          <Link to="/contact" className="underline hover:no-underline">
            Contact us
          </Link>
          . Once an order has been packed or shipped, it can no longer be cancelled, but you may
          still be able to return it after delivery under the terms below.
        </p>
      </PolicySection>

      <PolicySection title="Returns and exchanges">
        <p>
          If a pair doesn't fit or arrives different from what you ordered, let us know within 7
          days of delivery. To be eligible for a return or exchange, shoes must be unworn,
          undamaged, and in their original box with all tags attached — footwear cannot be resold
          once it shows signs of wear. We may ask for a photo of the item and the issue before
          arranging a pickup.
        </p>
        <p>
          Sizing exchanges are offered where stock of the requested size is available; otherwise a
          refund is issued once the returned pair reaches us.
        </p>
      </PolicySection>

      <PolicySection title="Damaged or incorrect items">
        <p>
          If your order arrives damaged or you receive the wrong item, contact us within 48 hours of
          delivery with photos of the item and its packaging. We will arrange a free replacement or
          a full refund — whichever you prefer — at no cost to you.
        </p>
      </PolicySection>

      <PolicySection title="Refund method and timing">
        <p>
          Orders paid online via Razorpay are refunded to the original payment method. Refunds are
          initiated within 3-5 business days of the returned item passing inspection, and typically
          reflect in your account within 5-7 business days after that, depending on your bank.
        </p>
        <p>
          Orders paid by cash on delivery are refunded via bank transfer or UPI — we will ask for
          your account or UPI details once the return is approved. Delivery and cash-on-delivery
          charges are non-refundable except where the return is due to our error (a damaged or
          incorrect item).
        </p>
      </PolicySection>

      <PolicySection title="Non-returnable items">
        <p>
          Items marked as final sale or clearance at the time of purchase cannot be returned or
          exchanged, unless they arrive damaged or incorrect.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
