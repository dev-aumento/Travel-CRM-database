# How to view MongoDB collections

This project uses **MongoDB Atlas** (cloud). Use the `MONGODB_URI` value from your project `.env` file.

Database name: **`Travel-crm`**

## Option 1: MongoDB Compass (recommended GUI)

1. Download [MongoDB Compass](https://www.mongodb.com/try/download/compass)
2. Open Compass → **New Connection**
3. Paste your `MONGODB_URI` from `.env`
4. Click **Connect**
5. Open database **`Travel-crm`**
6. Browse collections:

| Collection        | Contents                    |
|-------------------|-----------------------------|
| `leads`           | Lead records                |
| `bookings`        | Booking records             |
| `quotations`      | Quotation records           |
| `customers`       | Customer records            |
| `destinations`    | Destination records         |
| `hotels`          | Hotel records               |
| `activities`      | Activity records            |
| `travel_agents`   | Travel agent records        |
| `staff`           | Staff records               |
| `plans`           | Subscription plans          |
| `settings`        | Agency settings             |
| `custom_presets`  | Custom package presets      |
| `quote_terms`     | Quote terms & conditions    |
| `crmdatabases`    | Full app snapshot (1 doc)   |

## Option 2: mongosh (command line)

If `mongosh` is not installed, install [MongoDB Shell](https://www.mongodb.com/try/download/shell).

```powershell
mongosh "<paste MONGODB_URI from .env>"
```

```javascript
use Travel-crm
show collections

db.leads.find().limit(3)
db.bookings.countDocuments()
db.crmdatabases.findOne({ key: "crm_database" }, { key: 1, updatedAt: 1 })
```

## Re-seed collections

```powershell
npm run seed
```

This recreates all collections from the app's default sample data.
