import { Link } from 'react-router-dom';

import { useGetPublicSettingsQuery } from '@/app/api/settingsApi';
import { Money } from '@/components/common/Money';
import { Skeleton } from '@/components/ui/primitives';
import { PolicyLayout, PolicySection } from '@/features/policies/PolicyLayout';

export default function ShippingPolicyPage() {
  const { data: settings, isLoading } = useGetPublicSettingsQuery();

  return (
    <PolicyLayout title="Shipping Policy" updated="29 July 2026">
      <PolicySection title="Delivery areas">
        <p>
          We deliver across India to every serviceable PIN code. A small number of remote PIN codes
          that our courier partners cannot reach are not serviceable — you'll see this at checkout
          if it applies to your address.
        </p>
      </PolicySection>

      <PolicySection title="Delivery time">
        {isLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : (
          <p>
            Orders are typically delivered within{' '}
            <strong className="font-medium text-foreground">
              {settings?.estimatedDeliveryDays ?? '3-7 business days'}
            </strong>{' '}
            of being placed, depending on your location. You'll receive the order number to{' '}
            <Link to="/track" className="underline hover:no-underline">
              track your order
            </Link>{' '}
            once it ships.
          </p>
        )}
      </PolicySection>

      <PolicySection title="Delivery charges">
        {isLoading ? (
          <Skeleton className="h-4 w-64" />
        ) : (
          <p>
            Delivery costs <Money paise={settings?.deliveryChargePaise ?? 0} />, and is free on
            orders over <Money paise={settings?.freeDeliveryAbovePaise ?? 0} />. The exact delivery
            charge for your order is always shown before you pay, at checkout.
          </p>
        )}
      </PolicySection>

      {settings?.codEnabled && (
        <PolicySection title="Cash on delivery">
          <p>
            Cash on delivery is available for eligible orders
            {settings.codExtraChargePaise > 0 ? (
              <>
                {' '}
                for an additional <Money paise={settings.codExtraChargePaise} />
              </>
            ) : null}
            . Please have the exact amount ready for our delivery partner — they may not be able to
            provide change.
          </p>
        </PolicySection>
      )}

      <PolicySection title="Delays">
        <p>
          Occasionally deliveries are delayed by weather, courier network disruptions, or incomplete
          address information. If your order is significantly later than the estimate above, contact
          us with your order number and we'll look into it.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
