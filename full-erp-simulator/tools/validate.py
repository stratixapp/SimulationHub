#!/usr/bin/env python3
"""
tools/validate.py — structural validation sweep for the ERP Simulator.

Recreated from CONTINUE_HERE.md Section 11's spec (the original wasn't
carried into the zip this was rebuilt from). Checks, per that spec:

  1. `node --check` on every .js file.
  2. An HTMLParser-based tag-balance + duplicate-`id` check on every .html
     file (void elements exempt; <script>/<style> bodies are opaque).
  3. A comment-stripped brace-balance check on style.css.
  4. Duplicate top-level global names (const/let/var/class/function at
     column 0) — both across every data/ + root + assets/ script, and,
     more importantly, among the scripts each HTML page actually loads
     together (two co-loaded files declaring the same name is a runtime
     "Identifier has already been declared" SyntaxError that node --check
     on each file separately can never see).
  5. An ID cross-reference between each pages/<x>.js and pages/<x>.html:
     every pure-id selector or getElementById("x") the JS uses must exist
     as an `id="x"` in the HTML, in an `id="x"` the JS itself creates in
     a template string, or in the shared shell script.js builds.

KNOWN BLIND SPOTS (per Section 2 rule 7, inherited unchanged): does not
catch a CSS class used in HTML/JS that style.css never defines, and its
tag-balance check is nesting-agnostic beyond open/close pairing.

Usage:
  python3 tools/validate.py [project_root]
  python3 tools/validate.py [project_root] --js a.js b.js --html x.html
Exits non-zero and prints file (and line where known) for every problem.
"""
import os
import re
import subprocess
import sys
from html.parser import HTMLParser

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}


class Checker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # (tag, line)
        self.ids = {}            # id -> first line
        self.dupes = []          # (id, line)
        self.errors = []

    def handle_starttag(self, tag, attrs):
        line = self.getpos()[0]
        for k, v in attrs:
            if k == "id" and v:
                if v in self.ids:
                    self.dupes.append((v, line))
                else:
                    self.ids[v] = line
        if tag not in VOID:
            self.stack.append((tag, line))

    def handle_startendtag(self, tag, attrs):
        # <div /> style self-closing: record ids, never push.
        for k, v in attrs:
            if k == "id" and v:
                if v in self.ids:
                    self.dupes.append((v, self.getpos()[0]))
                else:
                    self.ids[v] = self.getpos()[0]

    def handle_endtag(self, tag):
        line = self.getpos()[0]
        if tag in VOID:
            return
        if not self.stack:
            self.errors.append(f"line {line}: stray </{tag}> with nothing open")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        # Look for a matching opener further down; anything above it was
        # left unclosed.
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                for t, l in self.stack[i + 1:]:
                    self.errors.append(f"line {l}: <{t}> never closed (before </{tag}> at line {line})")
                del self.stack[i:]
                return
        self.errors.append(f"line {line}: stray </{tag}> with no matching opener")


def check_html(path):
    problems = []
    with open(path, encoding="utf-8") as f:
        src = f.read()
    c = Checker()
    try:
        c.feed(src)
        c.close()
    except Exception as e:  # pragma: no cover
        return [f"parse error: {e}"], set()
    problems.extend(c.errors)
    for t, l in c.stack:
        problems.append(f"line {l}: <{t}> never closed (end of file)")
    for i, l in c.dupes:
        problems.append(f"line {l}: duplicate id=\"{i}\" (first at line {c.ids[i]})")
    return problems, set(c.ids)


def check_js(path):
    r = subprocess.run(["node", "--check", path], capture_output=True, text=True)
    if r.returncode != 0:
        return [r.stderr.strip().splitlines()[0] if r.stderr.strip() else "node --check failed"]
    return []


def check_css(path):
    with open(path, encoding="utf-8") as f:
        src = f.read()
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    # Ignore braces inside string literals.
    src = re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '""', src)
    depth = 0
    for n, line in enumerate(src.splitlines(), 1):
        for ch in line:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth < 0:
                    return [f"line {n}: unmatched }}"]
    return [f"unbalanced braces: {depth} unclosed {{"] if depth else []


ID_REF = [
    re.compile(r"getElementById\(\s*[\"']([A-Za-z_][\w-]*)[\"']\s*\)"),
    re.compile(r"[\"'`]#([A-Za-z_][\w-]*)[\"'`]"),
]
ID_DEF_IN_JS = re.compile(r"\bid=[\\\"']+([A-Za-z_][\w-]*)")


def js_ids_defined(path):
    try:
        with open(path, encoding="utf-8") as f:
            return set(ID_DEF_IN_JS.findall(f.read()))
    except OSError:
        return set()


HEX_COLOR = re.compile(r"^[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?$")


def strip_js_comments(src):
    """Blank out /* */ and // comments (keeping newlines so line numbers
    stay right) so prose like "No `#foo` here" in a header comment isn't
    read as a selector. String contents are left alone on purpose; a
    naive strip could otherwise eat `"//"` inside a URL string."""
    out, i, n = [], 0, len(src)
    quote = None
    while i < n:
        c = src[i]
        if quote:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(src[i + 1]); i += 2; continue
            if c == quote:
                quote = None
            i += 1
        elif c in "\"'`":
            quote = c; out.append(c); i += 1
        elif src.startswith("//", i):
            while i < n and src[i] != "\n":
                i += 1
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j == -1 else j + 2
            out.append("".join("\n" if ch == "\n" else " " for ch in src[i:j]))
            i = j
        else:
            out.append(c); i += 1
    return "".join(out)


def check_xref(js_path, html_ids, shell_ids):
    with open(js_path, encoding="utf-8") as f:
        raw = f.read()
    src = strip_js_comments(raw)
    known = html_ids | shell_ids | set(ID_DEF_IN_JS.findall(raw))
    problems, seen = [], set()
    for n, line in enumerate(src.splitlines(), 1):
        for rx in ID_REF:
            for m in rx.finditer(line):
                ident = m.group(1)
                if HEX_COLOR.match(ident):
                    continue  # "#fff" / "#F59E0B" are colors, not selectors
                if ident not in known and (ident, n) not in seen:
                    seen.add((ident, n))
                    problems.append(f"line {n}: references #{ident}, which the page's HTML never defines")
    return problems


TOP_DECL = re.compile(r"^(?:async\s+)?(?:const|let|var|class|function\*?)\s+([A-Za-z_$][\w$]*)", re.M)
SCRIPT_SRC = re.compile(r"<script[^>]*\ssrc=[\"']([^\"']+)[\"']", re.I)


def top_level_names(path):
    """Column-0 declarations only — that is how every data file in this
    project declares its globals; anything indented lives inside an IIFE
    or function and can't collide across files."""
    try:
        with open(path, encoding="utf-8") as f:
            return set(TOP_DECL.findall(strip_js_comments(f.read())))
    except OSError:
        return set()


def is_iife_file(path):
    """pages/*.js wrap everything in an IIFE, so their column-0 lines are
    only the wrapper — skip them for the global check."""
    return os.path.basename(os.path.dirname(path)) == "pages"


def check_duplicate_globals(root, html_files):
    problems = []
    # (a) whole codebase: data/, assets/ and root-level scripts.
    owners = {}
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d not in ("node_modules", ".git", "vendor", "pages", "tools")]
        for f in fn:
            if f.endswith(".js") and f != "service-worker.js":
                full = os.path.join(dp, f)
                for name in top_level_names(full):
                    owners.setdefault(name, []).append(os.path.relpath(full, root))
    for name, files in sorted(owners.items()):
        if len(files) > 1:
            problems.append(f"GLOBAL {name!r} is declared at top level in {len(files)} files: {', '.join(sorted(files))}")
    # (b) per page: the scripts that page actually loads together.
    for h in html_files:
        with open(h, encoding="utf-8") as f:
            srcs = SCRIPT_SRC.findall(f.read())
        seen = {}
        for src in srcs:
            if src.startswith(("http:", "https:", "//")):
                continue
            target = os.path.normpath(os.path.join(os.path.dirname(h), src.split("?")[0]))
            if not os.path.exists(target) or is_iife_file(target):
                continue
            for name in top_level_names(target):
                if name in seen and seen[name] != target:
                    problems.append(
                        f"{os.path.relpath(h, root)}: {name!r} declared by both "
                        f"{os.path.relpath(seen[name], root)} and {os.path.relpath(target, root)} — will throw on load")
                seen.setdefault(name, target)
    return problems


def main():
    args = sys.argv[1:]
    root = "."
    js_only, html_only = None, None
    if args and not args[0].startswith("--"):
        root = args.pop(0)
    if "--js" in args or "--html" in args:
        cur, js_only, html_only = None, [], []
        for a in args:
            if a == "--js":
                cur = js_only
            elif a == "--html":
                cur = html_only
            elif cur is not None:
                cur.append(a)
    root = os.path.abspath(root)

    def rel(p):
        return os.path.relpath(p, root)

    all_js, all_html = [], []
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d not in ("node_modules", ".git", "vendor")]
        for f in fn:
            full = os.path.join(dp, f)
            if f.endswith(".js"):
                all_js.append(full)
            elif f.endswith(".html"):
                all_html.append(full)

    if js_only is not None:
        js_files = [os.path.abspath(p) for p in js_only]
        html_files = [os.path.abspath(p) for p in html_only]
    else:
        js_files, html_files = sorted(all_js), sorted(all_html)

    errors = 0
    html_id_cache = {}

    for p in html_files:
        probs, ids = check_html(p)
        html_id_cache[p] = ids
        for m in probs:
            errors += 1
            print(f"HTML  {rel(p)}: {m}")

    for p in js_files:
        for m in check_js(p):
            errors += 1
            print(f"JS    {rel(p)}: {m}")

    css = os.path.join(root, "style.css")
    if js_only is None and os.path.exists(css):
        for m in check_css(css):
            errors += 1
            print(f"CSS   style.css: {m}")

    if js_only is None:
        for m in check_duplicate_globals(root, html_files):
            errors += 1
            print(f"DUP   {m}")

    # ID cross-reference: pages/<x>.js <-> pages/<x>.html
    shell_ids = js_ids_defined(os.path.join(root, "script.js"))
    for p in js_files:
        if os.path.basename(os.path.dirname(p)) != "pages":
            continue
        h = p[:-3] + ".html"
        if not os.path.exists(h):
            continue
        if h not in html_id_cache:
            html_id_cache[h] = check_html(h)[1]
        for m in check_xref(p, html_id_cache[h], shell_ids):
            errors += 1
            print(f"XREF  {rel(p)}: {m}")

    n_js, n_html = len(js_files), len(html_files)
    if errors:
        print(f"\nFAILED: {errors} problem(s) across {n_js} JS / {n_html} HTML files")
        sys.exit(1)
    print(f"validate.py clean: {n_js} JS / {n_html} HTML files, zero errors")


if __name__ == "__main__":
    main()
