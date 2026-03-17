# Get Cloudflare Tunnel working (named tunnel)

Quick tunnels are unreliable. Use a **named tunnel** with a Cloudflare account so you get a stable URL (e.g. `app.yourdomain.com`).

## Prerequisites

- A **domain** whose DNS is managed by Cloudflare (add the domain in Cloudflare Dashboard → Add site, then point your registrar’s nameservers to Cloudflare).
- **cloudflared** installed on the server (you already have it).

---

## Step 1: Create the tunnel in Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Zero Trust** (or [one.cloudflare.com](https://one.cloudflare.com)).
2. **Networks** → **Tunnels** → **Create a tunnel**.
3. Choose **Cloudflared**.
4. **Tunnel name:** e.g. `sarussiware` → **Save**.
5. On **Connect your first connector**:
   - Select **Linux**.
   - Copy the **Install command** (it contains a token), or leave the page open to copy the token in the next step.

---

## Step 2: Install connector on the server (if not already)

If you already created this tunnel before and have the credentials file, skip to Step 3.

Run the **exact** install command from the Cloudflare page. It looks like:

```bash
sudo cloudflared service install <TOKEN>
```

That installs cloudflared as a **system service** and uses the token to register the connector.  
**Or**, without installing as a service, you can run manually (Step 3 uses a config file instead).

---

## Step 3: Configure the tunnel (public hostname → your app)

You must tell Cloudflare: “when someone visits `app.yourdomain.com`, send traffic to `http://localhost:30080`”.

**Option A – In the Cloudflare UI (easiest)**

1. In **Tunnels** → click your tunnel (**sarussiware**).
2. Open the **Public Hostname** tab.
3. **Add a public hostname**:
   - **Subdomain:** `app` (or whatever you want; full hostname will be `app.yourdomain.com`).
   - **Domain:** select your domain (e.g. `yourdomain.com`).
   - **Service type:** **HTTP**.
   - **URL:** `localhost:30080` (or `127.0.0.1:30080`).
4. **Save**.

**Option B – Config file (if you run cloudflared manually)**

You need the **tunnel ID** (UUID) from the tunnel overview page. Then on the server:

```bash
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Contents (replace `YOUR_TUNNEL_ID` with the real UUID):

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /etc/cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: app.yourdomain.com
    service: http://localhost:30080
  - service: http_status:404
```

The credentials file (e.g. `/etc/cloudflared/3d780720-585a-4a3d-b5d7-1b72c7280b30.json`) should already exist if you ran `cloudflared tunnel login` and created the tunnel from this machine. If you used **Install command** with a token, the service install usually puts the credentials in place; then use the same tunnel ID in `config.yml`.

Run the tunnel:

```bash
sudo cloudflared tunnel run sarussiware
```

Or, if you use the config file by path:

```bash
sudo cloudflared tunnel --config /etc/cloudflared/config.yml run
```

Leave this running (or use the service from Step 2).

---

## Step 4: DNS (if you used the UI hostname, Cloudflare often does this for you)

For **Option A**, when you add the public hostname, Cloudflare usually creates the DNS record (CNAME `app` → `<tunnel-id>.cfargotunnel.com`). Check **DNS** → **Records** for your domain and ensure there is a CNAME for `app` (or your subdomain) pointing to the tunnel.

For **Option B**, add the CNAME yourself:

- **Type:** CNAME  
- **Name:** `app` (or your subdomain)  
- **Target:** `YOUR_TUNNEL_ID.cfargotunnel.com`  
- **Proxy status:** Proxied (orange cloud)  

---

## Step 5: Test

1. On the server, confirm the app responds:  
   `curl -s -o /dev/null -w "%{http_code}" http://localhost:30080`  
   → should be `200`.
2. Ensure the tunnel is running (you should see “Registered tunnel connection” in the cloudflared logs, or the systemd service active).
3. From your browser (or phone on cellular), open:  
   **https://app.yourdomain.com**

Use **HTTPS** (Cloudflare terminates SSL). If it still fails:

- Check **Zero Trust** → **Tunnels** → your tunnel: connector status should be **Connected**.
- Check **DNS** for the CNAME and that the tunnel ID matches.
- Try from another network (e.g. phone on mobile data) to rule out local blocking.

---

## Run tunnel permanently (systemd)

If you used **Install command** with a token, the tunnel is already a service. Otherwise:

```bash
sudo cloudflared service install
```

(when prompted, use the token from the tunnel page), or create a unit that runs:

`cloudflared tunnel --config /etc/cloudflared/config.yml run`

so the tunnel stays up after reboot.

---

## Checklist

- [ ] Domain on Cloudflare, nameservers pointed to Cloudflare.
- [ ] Tunnel created in Zero Trust, connector installed (or config + credentials on server).
- [ ] Public hostname: `app.yourdomain.com` → `http://localhost:30080`.
- [ ] DNS: CNAME `app` → `<tunnel-id>.cfargotunnel.com` (Proxied).
- [ ] `curl http://localhost:30080` returns 200 on the server.
- [ ] Tunnel process/service running, “Registered tunnel connection” in logs.
- [ ] Open **https://app.yourdomain.com** (HTTPS, not HTTP).
