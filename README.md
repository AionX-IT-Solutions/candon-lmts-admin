# LMTS Admin

LMTS — Candon City Legislative Management and Tracking System (desktop admin). Electron + React + TypeScript on Supabase.

Backend setup (database, account function, first admin): see [supabase/README.md](supabase/README.md).

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Publishing a Windows update

Increase the version in `package.json` and `package-lock.json`, then push a matching version tag
(for example, `v1.0.1`). The GitHub Actions release workflow builds the Windows installer and
publishes it with the update metadata required by `electron-updater`.

The first LMTS 1.0.0 installer is available from the `candon-lmts-admin` Releases page. Existing
1.1.x installs must be uninstalled before installing 1.0.0 because the updater does not downgrade
applications. After installing 1.0.0, LMTS checks for and downloads later updates automatically;
users can select **Restart & Update** to install a downloaded update.
