// GameStateManager has been removed.
// All game state is now stored in PostgreSQL (Neon) via Drizzle ORM.
// See party/db/schema.ts for table definitions.
// See party/db/queries.ts for query functions.
// See party/db/transactions.ts for atomic multi-entity operations.
//
// The addNotification and addActivity helper logic has moved to:
// - insertNotification() in party/db/queries.ts
// - insertActivity() in party/db/queries.ts
//
// Grid is kept in-memory in party/main.ts and reconstructed from DB on startup.
