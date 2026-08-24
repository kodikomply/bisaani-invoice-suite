# Bisaani Invoice Suite

A responsive invoice management interface for Bisaani Logistics Company Limited. It includes a live A4 invoice editor, print/PDF output, dashboard, invoice register, customer directory, company settings, bank accounts, VAT handling, amount-in-words conversion, and automatic local draft saving.

## VPS deployment

Requires Node.js 22.13 or newer and PostgreSQL 14 or newer.

```bash
npm ci
nano .env
npm run build
npm run start
```

Copy `.env.example` to `.env` and set `DATABASE_URL` to the production PostgreSQL connection. The application creates its required tables and indexes on first database access. Place the application behind Nginx or Caddy and proxy requests to the port printed by the start command. Use a process supervisor such as systemd or PM2 for continuous operation.

PostgreSQL is the authoritative store. Browser storage is used only as a temporary safety backup if the network drops.

On first login, the initial administrator is created from `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD`. The initial password must contain at least 10 characters; a value such as `ADMIN` is deliberately rejected. Remove the bootstrap password from the server environment after that account exists. Administrators can then use **User Management** to create staff, manager, viewer, or additional administrator accounts and can reset passwords later.

Passwords are hashed with bcrypt. Database sessions store only SHA-256 token hashes, while browsers receive secure HTTP-only cookies. Invoice APIs enforce authentication and role permissions on the server. Configure HTTPS before exposing the system publicly.

For the complete Nginx, systemd, PostgreSQL, HTTPS, firewall, backup, and subdomain checklist, see [DEPLOY.md](./DEPLOY.md).

## Render deployment

The included `render.yaml` pins Node.js 22, provisions PostgreSQL, and configures the standard Next.js web service. When configuring a service manually, use `npm ci && npm run build` as the build command and `npm run start` as the start command. Set `NODE_VERSION=22.22.0` on Render to prevent Render from selecting a newer, untested Node major.
