import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/primitives';

export default function TrackOrderPage() {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = orderNumber.trim();
    if (!trimmed || !phone.trim()) return;
    void navigate(
      `/order/${encodeURIComponent(trimmed)}?phone=${encodeURIComponent(phone.trim())}`,
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Track your order</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter your order number and the mobile number you placed it with.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="orderNumber">Order number</Label>
          <Input
            id="orderNumber"
            className="mt-1.5"
            placeholder="SS-20260729-0001"
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            type="tel"
            className="mt-1.5"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="w-full">
          Track order
        </Button>
      </form>
    </div>
  );
}
