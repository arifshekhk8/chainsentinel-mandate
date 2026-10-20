# Private hosting access

Updated 20 October 2026. Both saved API keys are verified and were used for the authorized Free deployment. Render plugin reads also work; the Neon app connector reports not connected, so no plugin repair is needed for this completed task. The user connected GitHub deployment credentials and delegated My Workspace as the target. [Mandate](https://chainsentinel-mandate.onrender.com) is live and restart-tested. User login details remain only in ignored `local-data/hosting/owner-login.txt`. The instructions below preserve earlier access setup/failures; they are not current blockers.

1. In [Render account settings](https://dashboard.render.com/u/settings), find **API Keys**, create a key named `Mandate deployment` and copy its value. [Official Render instructions](https://render.com/docs/api).
2. In the [Neon Console](https://console.neon.tech), open the profile menu, then **Account settings → API keys**. Create a personal API key named `Mandate deployment`. This permits creating the project if it does not exist. [Official Neon instructions](https://neon.com/docs/manage/api-keys).
3. Open the local private file `/Users/arif/Documents/chaina/local-data/hosting/cloud-access.env` in a plain-text editor. Paste each key after its matching equals sign and save:

   ```dotenv
   RENDER_API_KEY=
   NEON_API_KEY=
   ```

4. Tell the agent that the keys are saved. Do not paste their values into chat. The agent will check API access without logging the credentials, then continue the free deployment.

These are account-management keys. Render keys can access the user's workspaces; Neon personal keys inherit the user's project access. Use these credentials only for this requested Mandate deployment and revoke them after setup. Do not upload this access file to Render, include it in a submission archive, commit it or send it to a model. Application runtime credentials are separate from these management keys.

The file was created with owner-only `0600` permissions in a `0700` directory, and `git check-ignore` confirms it is ignored. Existing local configuration, keys and databases were preserved. A plugin connection is optional; no integration installation is required for this API route. If Render later requires its GitHub integration for the private source repository, the user should authorize only `arifshekhk8/chainsentinel-mandate` and keep the repository private.

Neon and Render access, encrypted migration, actual deployment and restart persistence are now verified. See [current project status](../PROGRESS.md) and [hosting checks](../evidence/HOSTING_RESULTS.md).

## Required GitHub deployment access

The management keys now work, but Render rejected the private repository as unfetchable. In Render Account Settings → Account Security → Git Deployment Credentials, add GitHub. In GitHub, allow only `arifshekhk8/chainsentinel-mandate`. If an installation already exists, [configure the Render GitHub app](https://github.com/apps/render/installations/new) and check that repository access includes Mandate. The user should complete this browser authorization; no repository visibility change is needed. [Official provider setup](https://render.com/docs/git-provider). This initial blocker was resolved by the user; service creation and live/restart verification have since passed.
