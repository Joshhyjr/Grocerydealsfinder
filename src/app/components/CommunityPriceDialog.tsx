import { useEffect, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { submitCommunityPrice } from '../data/api';

interface CommunityPriceDialogProps {
  items: string[];
  postalCode: string;
  onSubmitted: () => void;
}

const STORES = [
  { id: 'nofrills-hfx', name: 'No Frills' },
  { id: 'loblaws-hfx', name: 'Loblaws' },
  { id: 'rcss-hfx', name: 'Real Canadian Superstore' },
  { id: 'walmart-hfx', name: 'Walmart' },
] as const;

export function CommunityPriceDialog({
  items,
  postalCode,
  onSubmitted,
}: CommunityPriceDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    productName: items[0] ?? '',
    storeId: STORES[0].id,
    price: '',
    unit: '',
    observedAt: new Date().toISOString().slice(0, 10),
    website: '',
  });

  // Keep the default product valid when the active basket changes.
  useEffect(() => {
    if (!items.includes(form.productName)) {
      setForm((previous) => ({ ...previous, productName: items[0] ?? '' }));
    }
  }, [form.productName, items]);

  const selectedStore = STORES.find((store) => store.id === form.storeId) ?? STORES[0];

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const response = await submitCommunityPrice({
        product_name: form.productName,
        store_id: selectedStore.id,
        store: selectedStore.name,
        price: Number(form.price),
        unit: form.unit.trim() || null,
        observed_at: form.observedAt,
        postal_code: postalCode,
        // This hidden honeypot should remain empty for real users.
        website: form.website,
      });
      toast.success(response.message);
      setIsOpen(false);
      setForm((previous) => ({ ...previous, price: '', unit: '', website: '' }));
      onSubmitted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit this price.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
        >
          <PlusCircle className="size-4 mr-2" />
          Report Price
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a recent price</DialogTitle>
          <DialogDescription>
            Anonymous reports expire after 14 days. Do not include names, loyalty details, or receipt images.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm" htmlFor="community-product">Product</label>
            <select
              id="community-product"
              value={form.productName}
              onChange={(event) => setForm((previous) => ({ ...previous, productName: event.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm dark:bg-gray-800"
            >
              {items.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm" htmlFor="community-store">Store</label>
            <select
              id="community-store"
              value={form.storeId}
              onChange={(event) => setForm((previous) => ({ ...previous, storeId: event.target.value as typeof form.storeId }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm dark:bg-gray-800"
            >
              {STORES.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm" htmlFor="community-price">Price (CAD)</label>
              <Input
                id="community-price"
                type="number"
                min="0.01"
                max="1000"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm((previous) => ({ ...previous, price: event.target.value }))}
                placeholder="5.79"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm" htmlFor="community-unit">Package or unit</label>
              <Input
                id="community-unit"
                value={form.unit}
                onChange={(event) => setForm((previous) => ({ ...previous, unit: event.target.value }))}
                placeholder="4 L"
                maxLength={40}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm" htmlFor="community-date">Date observed</label>
            <Input
              id="community-date"
              type="date"
              value={form.observedAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setForm((previous) => ({ ...previous, observedAt: event.target.value }))}
            />
          </div>

          {/* Visually hidden honeypot rejects simple automated submissions. */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="community-website">Website</label>
            <input
              id="community-website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) => setForm((previous) => ({ ...previous, website: event.target.value }))}
            />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Reports are anonymous, rate-limited, and labelled “Community report.” Verify prices before shopping.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.productName || !form.price || !form.observedAt || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Price'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
