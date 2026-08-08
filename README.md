# kbd-dll-parser

Extracts dead-key composition tables (and eventually the rest of `KBDTABLES`)
from compiled Windows keyboard-layout DLLs — including third-party drivers
that never made it onto [kbdlayout.info](https://kbdlayout.info), such as the
[Breton C'hwerty driver](https://drouizig.org/en/tools-and-resources/chwerty-keyboard/).

## How it works

1. `.github/workflows/build-kbdreverse.yml` builds
   [`kbdreverse`](https://github.com/lelegard/winkbdlayouts) (vendored as a
   git submodule under `vendor/winkbdlayouts`) on a Windows runner. This
   needs the actual WDK (for `kbd.h`/`dontuse.h`, which the slim
   `Microsoft.Windows.WDK.x64` NuGet package does not include), installed via
   winget, plus the "Windows Driver Kit" Visual Studio component.
2. The `reverse-breton` job downloads the Breton driver and runs `kbdreverse`
   against `Breton.dll`, producing a C source dump of its `KBDTABLES`
   (including the `dead_keys` array) as a build artifact.
3. `yarn parse-dead-keys <kbdreverse-output.c> <deadKeyResults.json>` parses
   that `dead_keys` array (resolving `UC_*` symbolic names via
   `vendor/winkbdlayouts/keyboards/unicode.h`) into a `{ [accent]: { with,
   text }[] }` table, matching the `deadKeyResults` shape used by
   [kbdlayout-parser](https://github.com/andy23512/kbdlayout-parser).

## Usage

```bash
yarn install
yarn parse-dead-keys path/to/kbdbre.c path/to/deadKeyResults.json
```
