"""Run a bundled script against one of the package's dependency sets.

Neither obvious mechanism is enough on its own:

  * PYTHONPATH puts the directory ahead of the interpreter's own
    site-packages, but the `site` module never processes .pth files found
    there. pywin32 ships one, and without it `import pywintypes` fails, which
    breaks `import mcp` on Windows.

  * site.addsitedir() does process .pth files, but appends to sys.path, so
    anything installed in the interpreter's own site-packages would win over
    the bundled copy.

So do both: add the directory so its .pth files are honoured, then move
everything it contributed to the front of sys.path.

Usage:
    python _launch.py <site-packages-dir> <script.py> [args...]
"""

import os
import runpy
import site
import sys

if len(sys.argv) < 3:
    raise SystemExit("usage: _launch.py <site-packages-dir> <script.py> [args...]")

site_packages = os.path.abspath(sys.argv[1])
script = os.path.abspath(sys.argv[2])

if not os.path.isdir(site_packages):
    raise SystemExit("site-packages directory not found: %s" % site_packages)
if not os.path.isfile(script):
    raise SystemExit("script not found: %s" % script)

before = list(sys.path)
site.addsitedir(site_packages)

# Whatever addsitedir appended (the directory itself plus any paths its .pth
# files contributed) has to outrank the interpreter's own site-packages.
added = [p for p in sys.path if p not in before]
for path in added:
    sys.path.remove(path)
sys.path[:0] = added

sys.argv = [script] + sys.argv[3:]
runpy.run_path(script, run_name="__main__")
