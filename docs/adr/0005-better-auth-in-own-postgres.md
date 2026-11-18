# Better Auth with users in our own Postgres

Authentication uses Better Auth (email + password, reset via Resend) storing users and sessions in the app's own Postgres, not a hosted identity provider like Clerk. Linking Members to Users by verified email is a plain join this way, with no webhook sync; only a verified email can claim a Pending Member, so registering someone else's address never exposes their Groups.
