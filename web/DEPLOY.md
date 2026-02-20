# Deploying Clawbot World to Railway

## 1. Create Railway Project

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repo
3. Set the root directory to `web`

## 2. Add Persistent Volume

SQLite requires a persistent volume so data survives redeploys.

1. In your Railway service, go to **Settings > Volumes**
2. Add a volume:
   - Mount path: `/app/data`
3. Set the environment variable:
   - `DB_PATH=/app/data/claworld.db`

## 3. Environment Variables

Set these in Railway's **Variables** tab:

| Variable | Value | Notes |
|----------|-------|-------|
| `DB_PATH` | `/app/data/claworld.db` | Points to persistent volume |
| `NEXT_PUBLIC_API_URL` | *(leave empty)* | Empty = same-origin; set if frontend moves to Vercel |
| `NEXT_PUBLIC_WS_URL` | *(leave empty)* | Future: WebSocket server URL |

Railway automatically sets `PORT` and `NODE_ENV`.

## 4. Custom Domain (Optional)

1. Go to **Settings > Networking > Custom Domain**
2. Add your domain and configure DNS (CNAME to Railway's provided value)

## 5. Verify Deployment

After Railway finishes building:

```bash
# Health check
curl https://your-app.up.railway.app/api/health

# Should return: { "status": "ok", "timestamp": ..., "worldStats": { ... } }
```

Open `https://your-app.up.railway.app/world` in a browser to verify the PixiJS canvas loads.

## Local Docker Testing

```bash
cd web
docker build -t claworld .
docker run -p 3000:3000 -v $(pwd)/data:/app/data claworld
```

Then visit `http://localhost:3000/world`.
