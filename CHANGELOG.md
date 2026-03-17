# Changelog

All notable changes to Sifu Quest will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Features
- **chat**: Add in-memory rate limiting to chat API (30 req/min per user) (2d0602f)

### Bug Fixes
- **security**: Migrate API key encryption to AES-256-GCM with CBC legacy fallback (aa1b2bc)
- **docs**: Correct clone URLs (sifu_quest), guest quota (25 messages), and trial window (2 hours) across all documentation (005285d)

### Security
- Add authenticated encryption (GCM) for stored API keys with auth tags
- Fix writeMemoryFile race condition with atomic upsert RPC

---

## Recent History (Pre-Changelog)

### Features
- feat(plan): robust parser v2 and premium compact UI (#49)
- feat(ui): guest expiration banner and plan generation fix (#46)
- feat(auth): centralize guest expiration and optimize environment variables (#45)
- feat(quota): increase guest limit to 25 and use env var (#44)
- feat(sentry): integrate Sentry monitoring and update configuration (#43)
- feat(ui): add glowing beta badge to brand (#42)
- feat: enable global validation pipe for input validation (#41)
- feat: Integrate Vercel Analytics into the application. (#40)
- feat(chat): live OpenRouter cost telemetry and multi-provider messaging (#39)
- feat(coach): add OpenRouter paid BYOK unlock with unified entitlement flow (#38)
- feat(settings): refresh settings and onboarding UX (#37)
- feat(chat): UX refresh for coach controls, composer, and persistence (#36)
- feat(pwa): add offline + mobile readiness support (#34)
- feat(profile,chat): dojo names + OpenRouter ranking UX improvements (#33)

### Bug Fixes
- fix: add missing LogOut import used in sign out button (#48)
- fix(chat): responsive coach UX and glass control polish (#35)

### Chores
- cleanup: remove unused Claude Code workspace files and redundant modes directory (#52)
