# VPS deployment checklist

These instructions assume Ubuntu 24.04, a subdomain such as `invoices.yourdomain.com`, Node.js 22, PostgreSQL, Nginx, and systemd.

## 1. DNS

Create an `A` record for the invoice subdomain pointing to the VPS public IP. Allow DNS to propagate before requesting HTTPS.

## 2. Server packages

Install Node.js 22, PostgreSQL, Nginx, Certbot, and the Certbot Nginx plugin. Create a non-root system user named `bisaani` and place this project at `/var/www/bisaani-invoice` owned by that user.

## 3. PostgreSQL

Create a dedicated database and least-privilege login:

```sql
CREATE USER bisaani_invoice WITH ENCRYPTED PASSWORD 'use-a-long-random-password';
CREATE DATABASE bisaani_invoice OWNER bisaani_invoice;
```

Do not expose PostgreSQL port 5432 publicly. Keep it bound to localhost and allow only the application user.

## 4. Environment

Copy `.env.example` to `.env`, restrict it with `chmod 600 .env`, and set:

- `DATABASE_URL` to the dedicated PostgreSQL connection.
- `INITIAL_ADMIN_NAME` and `INITIAL_ADMIN_EMAIL` to the first administrator.
- `INITIAL_ADMIN_PASSWORD` to a unique random password of at least 16 characters.

The first successful login creates the initial administrator. Afterward, change the password from **My Account**, then remove `INITIAL_ADMIN_PASSWORD` from `.env` and restart the service. Existing administrators remain in PostgreSQL and are not removed.

## 5. Build and service

```bash
cd /var/www/bisaani-invoice
npm ci
npm run build
sudo cp deploy/bisaani-invoice.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bisaani-invoice
sudo systemctl status bisaani-invoice
```

## 6. Nginx and HTTPS

Replace `invoices.example.com` in `deploy/nginx.conf` with the actual subdomain, copy it to `/etc/nginx/sites-available/bisaani-invoice`, enable it, test Nginx, and reload. Then request HTTPS:

```bash
sudo ln -s /etc/nginx/sites-available/bisaani-invoice /etc/nginx/sites-enabled/bisaani-invoice
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d invoices.yourdomain.com
```

Enable the firewall for SSH and Nginx only. Confirm automatic certificate renewal with `sudo certbot renew --dry-run`.

## 7. Backups

Run a daily `pg_dump` to a directory outside the web root and retain encrypted off-server copies. Test restoring a backup before launch. Back up the `.env` securely and separately; never commit it.

## 8. Launch checks

- Sign in with the initial administrator and immediately rotate its password.
- Create a second administrator as an emergency recovery account.
- Confirm staff roles cannot open User Management.
- Create, save, reopen, print, and mark a test invoice paid.
- Confirm the A4 PDF has no browser headers/footers and the physical-stamp area is blank.
- Confirm HTTPS, database backups, system service restart, and certificate renewal.
