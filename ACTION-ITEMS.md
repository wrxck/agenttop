# Action Items for Matt

These are manual steps needed to complete the v0.11.0 release and package manager setup.

## 1. Merge the feature PR

After reviewing the PR on `feat/session-status-alerts-themes-distribution` targeting `develop`, merge it.

## 2. Initialize homebrew-tap and scoop-bucket repos

The repos were created but need their initial content merged. The git hook blocked direct pushes to `main` on empty repos.

```bash
# homebrew-tap — merge the initial formula branch into main
cd /tmp/homebrew-tap
git checkout feat/initial-formula
git branch -M main
git push -f origin main

# scoop-bucket — merge the initial manifest branch into main
cd /tmp/scoop-bucket
git checkout feat/initial-manifest
git branch -M main
git push -f origin main
```

Or merge the PRs via GitHub UI if the repos have a default branch set.

## 3. Publish v0.11.0 to npm

```bash
cd /home/matt/agenttop
# Ensure you're on the merged code (develop or main after release)
npm publish
```

## 4. Create GitHub release

```bash
gh release create v0.11.0 --title "v0.11.0" --notes "Session status detection, custom alerts, pinned sessions, 12 new themes, MCP extensions, and multi-platform distribution"
```

This triggers the `.github/workflows/publish.yml` CI which updates Homebrew, Scoop, and Snap.

## 5. Package manager setup (one-time)

### Snap Store
- Register `agenttop` on the [Snap Store](https://snapcraft.io/)
- Add `SNAP_TOKEN` secret to the agenttop GitHub repo

### AUR
- Create an AUR account if you don't have one
- Create the `agenttop` package on AUR with a PKGBUILD:
```bash
pkgname=agenttop
pkgver=0.11.0
pkgrel=1
pkgdesc="Real-time terminal dashboard for monitoring AI coding agent sessions"
arch=('any')
url="https://github.com/wrxck/agenttop"
license=('MIT')
depends=('nodejs')
source=("https://registry.npmjs.org/agenttop/-/agenttop-${pkgver}.tgz")
package() {
  npm install -g --prefix "$pkgdir/usr" "agenttop@${pkgver}"
}
```
- Add `AUR_SSH_KEY` secret to agenttop repo for CI updates

### Winget
- After the GitHub release creates the exe artifact, submit a manifest PR to [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs)
- The CI workflow stubs this out — you'll need to fill in the actual submission step

### Nix
- The `flake.nix` is in the repo — users can already `nix run github:wrxck/agenttop`
- To get into nixpkgs: submit a PR to [NixOS/nixpkgs](https://github.com/NixOS/nixpkgs) adding the package
- The `npmDepsHash` in `flake.nix` needs to be set after first build (run `nix build` to get the hash)

### GitHub secrets needed
| Secret | Purpose |
|--------|---------|
| `TAP_TOKEN` | PAT with repo access for wrxck/homebrew-tap |
| `SCOOP_TOKEN` | PAT with repo access for wrxck/scoop-bucket |
| `SNAP_TOKEN` | Snap Store credentials |
| `AUR_SSH_KEY` | SSH key for AUR package updates |

## 6. Verify installations work

After npm publish:
```bash
# npm
npx agenttop@0.11.0 --version

# Homebrew
brew tap wrxck/tap
brew install agenttop
agenttop --version

# Scoop (Windows)
scoop bucket add wrxck https://github.com/wrxck/scoop-bucket
scoop install agenttop
```
