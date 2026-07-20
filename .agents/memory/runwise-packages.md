---
name: RunWise package version constraints
description: Correct package versions for the RunWise Expo 54 mobile app and known resolution failures.
---

## expo ~54.0.27 compatible versions

| Package | Correct version | Notes |
|---|---|---|
| expo-document-picker | ~14.0.8 | v57.x installs but Metro cannot resolve it |
| expo-crypto | ~15.0.9 | v57.x installs but Metro cannot resolve it |
| @supabase/supabase-js | ^2.x | works fine |
| react-native-url-polyfill | ^4.x | must be imported first in supabase.ts |

**Why:** When `pnpm add expo-crypto` is run without a version pin in an expo 54 project, pnpm installs the latest (57.x). Expo's compatibility check reports the mismatch and Metro fails to bundle. Always pin to the expo SDK-compatible version.

## UUID without expo-crypto
`crypto.randomUUID()` is available in Hermes / React Native 0.73+. Use it directly instead of expo-crypto:
```ts
export const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : fallback_string;
```
