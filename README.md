# Journalitea
Personal tea journal app 


## Features
- Catalogue and rate teas from your collection
- Photo function
- Uses SQLite under the hood 
- Stats for your tea collection (e.g. average price per gram, price histograms, cumulative aroma statistics etc.)
- Convenient Tea timer function
- Sync your database across multiple devices using Nextcloud!
- Works on *some* platforms! (Electron for desktop, Ionic Capacitor for Android)
- 100% Free and Open Source Software, licensed under GPLv3

## Installing
- Head to [releases](https://github.com/Unjson/journalitea/releases) and grab the latest version for your operating system of choice.
-  You can import your collection from an existing database via the settings menu

## Releasing
The **Create release** GitHub Actions workflow is started manually. It reads the version from `package.json`, builds Windows, Linux, and macOS Electron packages plus a signed Android APK, then creates the `v<version>` GitHub release. GitHub automatically provides source-code ZIP and TAR archives for the release tag.

Before its first run, create a local signing keystore and configure the repository secrets. In Git Bash, run:

```bash
npm run android:keystore
cp android/keystore.properties.example android/keystore.properties
base64 -w 0 android/app/journalitea-release.jks
```

Enter the passwords chosen during `npm run android:keystore` in `android/keystore.properties` for local signed builds. Keep both the `.jks` file and this properties file private; they are ignored by Git. Add the base64 output and the credentials as repository secrets named `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. The generated alias defaults to `journalitea`.

## Roadmap
- iOS support (If i can be bothered. Mobile dev is hard, and I don't have an iPhone/Mac at hand...)

## Contributing / Bugs
- If you find a bug, please use the [Issues](https://github.com/Unjson/journalitea/issues) page.
- If you want to contribute a translation, please contact me at [hundertmark@medialesson.de](mailto:hundertmark@medialesson.de)
- If you have a specific feature ur UX request, get in contact I'll try my best to accomodate you.
  - Please be mindful I am working on this app for free in my spare time, so not all requests might get answered.