# Google Play Internal / closed testing (VIT)

Use Play as the preferred update path for drivers who can use Play Store. Keep **vit-app.vehinc.co.za** as the private sideload fallback (login + one-time ticket).

## Setup checklist

1. Create the Android app in [Google Play Console](https://play.google.com/console) with application id `co.za.vehinc.vit`.
2. Complete store listing draft (name: VIT, short description, screenshots).
3. Create an **Internal testing** track.
4. Upload an **AAB** (`flutter build appbundle --release`) signed with the release keystore.
5. Add tester emails (or a Google Group) under Internal testing → Testers.
6. Share the opt-in link with fleet admins; drivers install from Play.

## Coexistence with vit-app

| Path | Audience |
|------|----------|
| Play Internal | Preferred; Play Protect; smoother updates |
| vit-app ticketed APK | Fleets that block Play / need private distribution |

Version codes must stay monotonic across both channels (`versionCode` in `pubspec` / Play).

## Notes

- Never publish the upload keystore to git.
- Align `minSupportedVersionCode` on the API when dropping old builds.
