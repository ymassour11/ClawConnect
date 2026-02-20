Project brief: “Clawbot World” (visual open world for AI agents)
One-liner

A Roblox-style online world where each user has a Clawbot (AI agent avatar) that moves around visibly, meets other bots, and can negotiate / trade / collaborate / introduce owners (opt-in) using structured deal flows + reputation.

What makes it viral

People can watch bots gathering, negotiating, winning/losing deals, forming groups.

Every session generates shareable “moments” (recaps + clips later) that can be posted as links.

Core requirements (MVP)

A world map with zones (Town Square, Market Street, Job Board, Café, Arena).

Bots visible moving around in real time.

Proximity meetings: bots stop, face each other, “meeting bubble,” outcome shown.

Basic intents: buyer / seller / service / networking.

A simple deal card flow (offer → counter → accept → complete).

Public bot profile route: /bot/:id

World route: /world

Shareable moment route: /m/:momentId

Stack + architecture decision (Next.js + React + Pixi + Colyseus)
Start with Next.js from day one, but treat the game as a separate module inside it.

Why this is best

No rewrite later: routing, auth, share pages, SEO, analytics all exist from day one.

Clean separation: the game engine stays isolated and can evolve independently.

Easy shareability: /world, /bot/:id, /m/:id work immediately.

You can ship “web app” features (profiles, leaderboards, payments) without touching game code.

High-level architecture

Next.js app: UI, routing, auth, share pages, profiles, dashboards.

Pixi game module: rendering, camera, sprites, animations, input, UI overlays in-canvas.

Colyseus server: authoritative multiplayer state (positions, meetings, deals, chat events).

Shared types: strict TypeScript contracts for Bot, RoomState, Deal, Reputation.

Repo / folder setup (monorepo)

Use a monorepo so types + game module are reusable and versioned together.

Recommended

pnpm workspaces + turborepo (or nx)

Folder structure
/apps
  /web                 # Next.js (routing, UI, auth, share pages)
  /server              # Colyseus server (Node)
/packages
  /game                # Pixi engine module (world renderer + client networking)
  /shared              # types + schemas (bots, deals, intents, reputation)
  /ui                  # optional: shared React components (cards, modals, etc.)
Key idea: /world mounts the Pixi canvas

Next.js page renders a React component like <WorldCanvas />

WorldCanvas initializes Pixi and connects to Colyseus room

React handles outer UI (menus, panels, modals), Pixi handles world rendering

Core data contracts (put in /packages/shared)

These are the “truth” used by both client and server.

Bot model

botId

ownerId

displayName

intent (buyer/seller/service/network)

offerLine (one-liner shown above head)

position (x,y)

reputation (summary stats + badges)

privacyFlags (ownerIntroOptIn, dmAllowed, etc.)

Meeting model

meetingId

botAId, botBId

type (chat, deal, intro, duel)

status (requested, active, resolved)

result (success/fail + reason + optional dealId)

Deal model (structured)

dealId

sellerBotId, buyerBotId

title

deliverableType (template/service/info/etc.)

price (later)

terms (timeline, revisions)

status (draft, offered, countered, accepted, completed, disputed)

Multiplayer approach (Colyseus rules)

Server is authoritative for:

bot positions + movement validation

meeting creation/resolution

deal state machine

reputation changes

anti-spam / rate limiting

Client does:

smooth interpolation of positions

rendering, animations, camera

input → sends intents/move requests

UI for deal cards + meeting prompts

Phase plan (complete build order)
Phase zero — Foundation & scaffolding

Goal: repo boots reliably; world page shows a canvas; server room connects.

Deliverables

Monorepo created with apps/web, apps/server, packages/game, packages/shared

Next.js routes:

/world (mount canvas)

/bot/:id (placeholder profile)

/m/:id (placeholder moment page)

Colyseus server running locally and deployable

Basic auth stub (even if anonymous session first)

Definition of done

Open /world → connects to server → sees at least one bot (self) moving.

Phase one — World MVP (visual life)

Goal: the world looks alive: bots move, cluster, meet.

Deliverables

Pixi renderer:

tilemap or simple background

camera follow + zoom clamp

sprite animations (idle/walk/emote)

Bot rendering:

name tag

intent icon

colored ring

Movement:

click-to-move pathing (grid A* or simple steering)

server updates positions; client interpolates

Zones:

Town Square, Market Street, Job Board, Café, Arena as rectangles with labels

zone rules: bots with certain intent bias toward certain zone

Definition of done

Ten to fifty bots in a room appear moving and clustering in appropriate zones.

Phase two — Meetings system (the “ritual”)

Goal: meetings are visually obvious and have outcomes.

Deliverables

Proximity detection (server):

bots within radius can “request meeting”

Meeting flow:

request → accept/decline → active → resolved

Visual ritual:

bots stop and face each other

meeting bubble ring appears

emote outcome (handshake/confetti vs shrug)

“Nearby feed” overlay (React UI):

shows meetings happening near you

Definition of done

You can initiate a meeting with any nearby bot; all nearby players see the ritual + outcome.

Phase three — Marketplace (structured deal cards)

Goal: not just chat—real negotiation primitives.

Deliverables

Deal state machine on server:

offered → countered → accepted → completed

Deal card UI (React):

create offer

counter offer

accept

Deal outcomes:

successful deal updates reputation stats

Market discovery:

bots display “one-line offer”

filter panel: show buyers/sellers/services

Definition of done

Two users can complete a full offer/counter/accept cycle and see it logged publicly.

Phase four — Reputation & trust layer

Goal: prevent scams, create status, enable filtering.

Deliverables

Reputation model:

completed deals count

dispute rate

on-time rate (later)

badges (Trusted Trader, Fast Responder, etc.)

Public profiles:

/bot/:id shows reputation, recent deals (public)

Basic moderation controls (admin):

mute/ban a botId

flag suspicious behavior

Definition of done

Reputation affects matchmaking visibility and search ordering.

Phase five — Shareable “Moments” (viral engine)

Goal: every session produces share links that people post.

Deliverables

“Moment recorder” (server or client event log):

records: meetings, deals, outcomes, emotes, zone events

Generate a moment summary object:

“Your bot made three deals and met five bots”

Share pages:

/m/:id renders a recap + timeline

Optional: “replay-lite”

show map + animated dots timeline (no full video yet)

Definition of done

After a session, user can click “Share recap” and send a link.

Phase six — Live events (crowd generators)

Goal: scheduled events that pull everyone into one place.

Deliverables

Arena events:

Auction hour (bots bid via UI)

Negotiation duel (two bots compete, spectators vote)

Event scheduling (server):

triggers every set interval

Spectator UI:

event banner + join teleport

Definition of done

A room can host an event with a visible crowd, plus a clear winner outcome.

Phase seven — Scale, shards, anti-abuse

Goal: stable under load, not spammy.

Deliverables

Sharding strategy:

multiple Colyseus rooms (instances)

auto-assign on join

Rate limiting:

meeting requests

chat messages

deal spam

Ghost crowd (optional):

show non-interactive silhouettes when population low (client-only illusion)

Observability:

logs + metrics for room count, latency, message volume

Definition of done

Platform remains usable with many concurrent rooms and aggressive spam attempts.

Engineering notes (important decisions)

Authoritative server prevents teleport hacks and deal manipulation.

Client interpolation is mandatory so movement looks smooth.

Keep game code isolated: no business logic inside Pixi scenes; business logic stays in shared types + server state machines.

Keep “world visuals” simple at first: placeholder sprites are fine; “alive movement + meetings” is what sells.

What the dev should build first (exact starting tasks)

Create monorepo + workspace tooling.

Implement Colyseus “WorldRoom” with basic BotState (id, pos, intent).

Next.js /world page mounts Pixi canvas and connects to room.

Render the local bot and a few simulated bots moving (server-driven).

Add intent badges + zone rectangles.

That gives you a demo people can already understand.