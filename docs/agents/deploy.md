# Deploying

Production is the Vercel project `expense-splitter` (scope `joshlius-projects`), served at https://expense-splitter-fawn.vercel.app. A push to `main` deploys to Production; any other branch deploys a Preview. The framework is pinned in `vercel.json`. Environment variables live in the Vercel dashboard, set separately for Production and Preview; `.env.example` lists them.

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
- **Framework Preset "Other"**: the build passes, but Vercel publishes only `public/` as static files, so every page is a 404. `vercel.json` pins the framework to `nextjs`.

Environment variable changes apply only to new deployments. After changing one, redeploy the current production deployment:

```sh
npx vercel redeploy https://expense-splitter-fawn.vercel.app --scope joshlius-projects
```
