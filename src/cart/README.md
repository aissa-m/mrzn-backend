# Cart Module

JWT-protected endpoints for the user's shopping cart. All operations use the authenticated user's ID (never from body/query). One cart per user.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cart` | Get cart (creates if not exists). Returns `{ id, items: [{ productId, quantity, product }], subtotal? }` |
| POST | `/api/cart/add` | Add item or increment quantity (upsert by cartId, productId). Body: `AddToCartDto` |
| PATCH | `/api/cart/update` | Set item quantity. If `quantity === 0`, item is removed. Body: `UpdateCartItemDto` |
| DELETE | `/api/cart/remove/:productId` | Remove item by productId |
| DELETE | `/api/cart/clear` | Empty the cart |

### DTOs

- **AddToCartDto**: `productId` (required, integer), `quantity` (optional, default 1, 1–99). Messages in English (e.g. "quantity must be at least 1").
- **UpdateCartItemDto**: `productId` (required), `quantity` (required, 0–99). Quantity 0 removes the item.

### Errors (English)

- **404** `"Product not found"` when product does not exist.
- **404** `"Cart item not found"` when removing/updating a non-existent cart item.
- **404** `"Cart not found"` when updating and user has no cart (edge case).
- **400** `"Invalid quantity"` when quantity is out of range.

## Example (curl)

```bash
# Get cart
curl -H "Authorization: Bearer YOUR_JWT" "http://localhost:3000/api/cart"

# Add to cart
curl -X POST -H "Authorization: Bearer YOUR_JWT" -H "Content-Type: application/json" \
  -d '{"productId": 1, "quantity": 2}' "http://localhost:3000/api/cart/add"

# Update quantity (0 removes item)
curl -X PATCH -H "Authorization: Bearer YOUR_JWT" -H "Content-Type: application/json" \
  -d '{"productId": 1, "quantity": 3}' "http://localhost:3000/api/cart/update"

# Remove item
curl -X DELETE -H "Authorization: Bearer YOUR_JWT" "http://localhost:3000/api/cart/remove/1"

# Clear cart
curl -X DELETE -H "Authorization: Bearer YOUR_JWT" "http://localhost:3000/api/cart/clear"
```

See project root `requests.http` for more examples.
