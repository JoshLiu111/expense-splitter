# Deploying

Production is the Vercel project `expense-splitter` (scope `joshlius-projects`), served at https://expense-splitter-fawn.vercel.app. A push to `main` deploys to Production; any other branch deploys a Preview. The framework is pinned in `vercel.json`. Environment variables live in the Vercel dashboard, set separately for Production and Preview; `.env.example` lists them.

## Vercel Blob (avatars)

Avatar images live in a **public** Vercel Blob store: every Member of a Group the User shares sees them, so they are not sensitive. The store must be provisioned once, by a human, before avatars work on a deployment:

1. In the Vercel dashboard, project `expense-splitter` → Storage → Create → Blob, access **Public**.
2. Connect it to both Production and Preview. Connecting sets `BLOB_READ_WRITE_TOKEN` in each.
3. Redeploy (see the end of this page), since environment variable changes apply only to new deployments.

To check: upload an avatar in Account Settings; its image URL is on `*.public.blob.vercel-storage.com`.

## Before merging a migration, confirm Production has it

Deploys never migrate. If a PR adds a file under `drizzle/`, a human applies it to the Production database before the merge; otherwise the new code queries columns that don't exist yet. Apply it just before merging, since the old deployment runs against the new schema until the new one is Ready.

Before merging, from a checkout of the PR's head, with the Production `DATABASE_URL` (Vercel dashboard, Production) in `DATABASE_URL`:

```sh
ls drizzle/*.sql | wc -l
shasum -a 256 "$(ls drizzle/*.sql | tail -1)"
PGSSLROOTCERT=system psql "$DATABASE_URL" -XAt -c "set default_transaction_read_only = on" \
  -c "select count(*), (select hash from drizzle.__drizzle_migrations order by id desc limit 1) from drizzle.__drizzle_migrations"
```

The count of rows must equal the count of files, and the last row's hash must equal the latest file's SHA-256. If not, stop and tell the user; don't merge. `PGSSLROOTCERT=system` makes psql trust the system root certificates; without it psql looks for `~/.postgresql/root.crt` and fails.

To apply a missing migration, run `npm run db:migrate` with the Production `DATABASE_URL`, from a checkout that has the migration file. A checkout of an older commit applies only the migrations it has, and reports success. Then run the check again.

## After a push or merge, confirm the deployment

A push is done when its deployment is Ready and its logs are clean, not when `git push` succeeds.

1. Wait for the deployment and check its status:
   ```sh
   npx vercel ls expense-splitter --scope joshlius-projects
   npx vercel inspect <deployment-url> --wait --scope joshlius-projects
   ```
   On `● Error`, read the build log: `npx vercel inspect <deployment-url> --logs --scope joshlius-projects`.
2. Exercise a path that queries the database. A page that loads proves nothing about the database. Ask the user to sign up or sign in if you can't do it without creating real data.
3. Read the logs:
   ```sh
   npx vercel logs --scope joshlius-projects --project expense-splitter --environment production --since 10m
   ```
   Clean means no `"level":"error"` entries whose `deploymentId` is the new deployment. Errors from older deployment IDs belong to those deployments.

## Known failures

- **Malformed `DATABASE_URL`**: builds fine, then fails at the first query with `getaddrinfo ENOTFOUND <host>`. The value must be the bare `postgresql://…` URL.
- **`column "…" does not exist`** (Postgres code `42703`) after a deploy: the Production database is missing a migration. Run the check in "Before merging a migration, confirm Production has it" above, then apply the missing migration as described there.
- **Missing environment variable**: compare the dashboard against `.env.example`.
- **pg SSL mode warning** (`SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'`, logged at level `error`): `DATABASE_URL` uses `sslmode=require`. Change it to `sslmode=verify-full`; pg already behaves that way, so only the warning goes away.
  - pg doesn't read `channel_binding` from the connection string; it ignores it.
  - pg turns channel binding on only with the client option `enableChannelBinding: true` (`node_modules/pg/lib/client.js:87`), which defaults to `false`.
- **Avatar upload fails with `BLOB_READ_WRITE_TOKEN is not set`**: no Blob store is connected to that environment. Provision it as in "Vercel Blob (avatars)" above.
- **Framework Preset "Other"**: the build passes, but Vercel publishes only `public/` as static files, so every page is a 404. `vercel.json` pins the framework to `nextjs`.

Environment variable changes apply only to new deployments. After changing one, redeploy the current production deployment:

```sh
npx vercel redeploy https://expense-splitter-fawn.vercel.app --scope joshlius-projects
```
