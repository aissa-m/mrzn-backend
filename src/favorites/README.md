# Favorites (Likes) Module

JWT-protected endpoints for user favorites. All operations use the authenticated user's ID (never from body/query).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/favorites` | List favorite products (paginated). Query: `page`, `limit` |
| GET | `/api/favorites/ids` | List favorite product IDs only (for quick heart state) |
| POST | `/api/favorites/toggle/:productId` | Toggle favorite: if exists remove and return `{ liked: false }`, else add and return `{ liked: true }` |

- **404** if product does not exist: `"Product not found"`.
- **productId** in path must be a valid integer (product id).

## Example (curl)

```bash
# List favorites (requires JWT)
curl -H "Authorization: Bearer YOUR_JWT" "http://localhost:3000/api/favorites?page=1&limit=20"

# Toggle favorite for product 1
curl -X POST -H "Authorization: Bearer YOUR_JWT" "http://localhost:3000/api/favorites/toggle/1"

# Get favorite IDs only
curl -H "Authorization: Bearer YOUR_JWT" "http://localhost:3000/api/favorites/ids"
```

See project root `requests.http` for more examples.
