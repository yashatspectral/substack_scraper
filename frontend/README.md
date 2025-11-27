# StyleGen Frontend

React/Next.js app styled with Tailwind + shadcn-inspired components.

## Quick start

```bash
cd frontend
npm install
npm run dev
```

The app expects the backend FastAPI service to be running (default `http://localhost:8000`). You can override the target by defining `NEXT_PUBLIC_STYLEGEN_API`.

## Structure

- `app/` – Next.js App Router entry points.
- `components/ui/` – Lightweight shadcn-style components (button, input, badges, cards).
- `lib/utils.ts` – Tailwind class merge helper.
- `styles/` – Tailwind base styles and gradient helpers.

## Deployment Notes

- Run `npm run build` for production builds.
- Make sure the backend endpoint is reachable from the deployed frontend (set `NEXT_PUBLIC_STYLEGEN_API`).
