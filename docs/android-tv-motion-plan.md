# MotionPlay Android TV + phone motion controller

Development branch: `feature/android-tv-motion`.

## Scope and status

This branch is a non-destructive foundation for splitting the phone camera from the TV game screen. The existing game pages remain unchanged.

- [x] Isolated development branch
- [x] Shared validated motion message contract
- [ ] Audit actual game routes and pose detector implementations
- [ ] Implement phone camera inference and action normalization
- [ ] Implement room pairing and authenticated WebSocket relay
- [ ] Add TV lobby and map motion events to an existing game
- [ ] Android TV WebView APK with D-pad navigation
- [ ] CI build and on-device testing (including armeabi-v7a)

## Architecture

Phone (HTTPS camera page, local pose inference) -> authenticated LAN WebSocket relay -> TV game client.

Send only semantic motion events; do not stream camera frames. The relay must validate messages and room authorization, bound message rate and payload size, reject stale sequence numbers, and pause play on disconnect.

### Motion event

```json
{"type":"motion","sequence":1,"timestamp":1762500000000,"action":"JUMP","confidence":0.93}
```

Allowed actions: JUMP, DUCK, LEFT, RIGHT, NEUTRAL. Confidence is 0..1.

## Important deployment constraints

Mobile camera access requires a secure browser context (HTTPS or supported localhost). A LAN HTTP IP URL alone is insufficient. The Android TV client should not request camera access. For first release, keep the existing Next.js runtime; do not assume the app supports static export.

## Acceptance criteria

1. Original MotionPlay pages still build and work.
2. Phone camera permission and calibration work on HTTPS.
3. Pairing requires an expiring, unguessable room token.
4. TV responds to JUMP and DUCK in the existing game without video transmission.
5. TV remote Back, OK and D-pad work; disconnect pauses gameplay.
6. APK installs and launches on an armeabi-v7a-only Android TV.

No claims of successful build or device tests until CI and hardware verification are completed.
