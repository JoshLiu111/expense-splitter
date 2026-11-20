# Deploying

Production is the Vercel project `expense-splitter` (scope `joshlius-projects`), served at https://expense-splitter-fawn.vercel.app. A push to `main` deploys to Production; any other branch deploys a Preview. The framework is pinned in `vercel.json`. Environment variables live in the Vercel dashboard, set separately for Production and Preview; `.env.example` lists them.

## Vercel Blob (avatars)

Avatar images live in a **public** Vercel Blob store: every Member of a Group the User shares sees them, so they are not sensitive. The store must be provisioned once, by a human, before avatars work on a deployment:

1. In the Vercel dashboard, project `expense-splitter` → Storage → Create → Blob, access **Public**.
2. Connect it to both Production and Preview. Connecting sets `BLOB_READ_WRITE_TOKEN` in each.
3. Redeploy (see the end of this page), since environment variable changes apply only to new deployments.

To check: upload an avatar in Account Settings; its image URL is on `*.public.blob.vercel-storage.com`.

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
