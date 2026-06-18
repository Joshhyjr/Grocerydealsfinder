# Provider snapshot contract

Provider endpoints and authenticated uploads use the same normalized JSON structure.

```json
{
  "region": "halifax-metro",
  "generated_at": "2026-06-18T00:00:00.000Z",
  "expires_at": "2026-06-18T06:00:00.000Z",
  "data_source": "live",
  "provider_status": [
    {
      "provider": "licensed-provider",
      "success": true,
      "error": null
    }
  ],
  "products": [
    {
      "id": "provider-product-123",
      "store_id": "nofrills-hfx",
      "store": "No Frills",
      "name": "2% Milk",
      "aliases": ["milk", "2% milk"],
      "brand": "Example Dairy",
      "price": 5.79,
      "was_price": 6.29,
      "unit": "4 L",
      "image": "https://cdn.example/milk.jpg",
      "link": "https://retailer.example/product/123",
      "source": "licensed-provider",
      "source_kind": "provider",
      "observed_at": "2026-06-18",
      "attribution_url": "https://provider.example/terms",
      "valid_until": "2026-06-24",
      "address": "3601 Joseph Howe Dr, Halifax, NS",
      "coordinates": {
        "lat": 44.6528,
        "lng": -63.6268
      }
    }
  ]
}
```

## Validation rules

- `region` is required.
- `products` must contain 1–20,000 entries.
- IDs, store names, product names, and source names must be non-empty strings.
- Prices must be finite, non-negative numbers.
- `source_kind` must identify `provider`, `open-prices`, `community`, or `estimate`.
- Open/community records should include `observed_at` and expire after 14 days.
- Open data should include its public attribution URL.
- Missing optional fields should be `null`.
- Provider HTTP payloads and uploads are limited to 5 MiB.

## Provider endpoint authentication

When `PROVIDER_API_TOKEN` is installed, the Worker sends:

```text
Authorization: Bearer <PROVIDER_API_TOKEN>
```

Use retailer-specific adapter services when upstream response formats differ. The adapter should translate the retailer or licensed-provider response into this contract before the Worker consumes it.
