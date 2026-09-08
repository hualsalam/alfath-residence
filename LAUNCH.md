# Al Fath Residence — launch & editing guide

Everything lives in **`site/`**. That folder *is* the website: `index.html` plus `assets/`.
It is a git repository, so every change is versioned and reversible.

---

## 0. Before you launch — four things to settle

| # | What | Why it matters | Status |
|---|------|----------------|--------|
| 1 | **Buy the domain** | `alfathresidence.com` — the screenshot you sent shows it available | not done |
| 2 | **Web3Forms access key** | Without it the enquiry form tells visitors their details were *not* sent | not done |
| 3 | **Real phone number** | Footer and brochure show the placeholder `+966 50 123 4567` | not done |
| 4 | **Confirm the email** | `stay@alfathresidence.com` is used on the page, the brochure and the enquiry link | confirm |

Nothing else blocks launch. The site works today.

---

## 1. Previewing while you edit

Start the local server once per session:

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open **http://127.0.0.1:8796/**. Leave the window open; it serves until you close it.

> **Do not judge the site by the preview panel inside Claude.** It loads the page as a `data:` URL,
> which has no folder behind it, so every image, the logo and the video come up blank.
> Always use the `127.0.0.1` address above, or double-click `site\index.html`.

---

## 2. Publish to GitHub, then Netlify

Do this once. Afterwards every edit deploys by itself.

### 2a. Create an empty GitHub repo

Go to **github.com/new**. Name it `alfath-residence`. Choose Private or Public.
**Do not** tick "Add a README", ".gitignore" or "license" — the repo must start empty.

### 2b. Push the site

```bash
cd "C:\Users\huals\Downloads\Claude Projects\Al Fath Landing page\site" && git remote add origin https://github.com/YOUR-USERNAME/alfath-residence.git && git branch -M main && git push -u origin main
```

Replace `YOUR-USERNAME`. A browser window will open to sign in to GitHub the first time.
The push moves about 105 MB (the hero video), so give it a few minutes.

### 2c. Connect Netlify to the repo

1. Open **app.netlify.com** and click your existing site (the one serving `alfathresidence.netlify.app`)
2. **Site configuration → Build & deploy → Continuous deployment → Link repository**
3. Choose **GitHub**, authorise it, pick `alfath-residence`
4. Settings:
   - **Branch to deploy:** `main`
   - **Build command:** *leave empty*
   - **Publish directory:** `.` (a single dot)
5. **Deploy site**

First deploy takes about a minute. From now on, pushing to `main` publishes automatically.

---

## 3. Connect the domain

### 3a. Buy it
Buy `alfathresidence.com` from any registrar (Namecheap, GoDaddy, Cloudflare…).

### 3b. Add it in Netlify
**Site configuration → Domain management → Add a domain** → type `alfathresidence.com` → Netlify
will ask you to prove ownership by pointing DNS at it. You have two options:

**Option A — let Netlify run DNS (simplest)**
Netlify shows four nameservers like `dns1.p03.nsone.net`. At your registrar, replace the existing
nameservers with those four. Everything else is automatic.

**Option B — keep DNS at your registrar**
Add two records at the registrar, using the exact values Netlify shows you on screen:

| Type | Name | Value |
|------|------|-------|
| A | `@` | the IP Netlify displays (historically `75.2.60.5`) |
| CNAME | `www` | `your-site-name.netlify.app` |

Do not copy the IP from this document — use the one in the dashboard, it can change.

DNS takes anywhere from ten minutes to a few hours to spread. Netlify then issues a free HTTPS
certificate automatically; wait for **Domain management → HTTPS** to show a certificate before
announcing the site.

### 3c. Point the site's own addresses at the new domain

The page carries its address in a few places — the canonical link, the social-preview tags,
the sitemap, robots.txt and the brochure. One command updates all of them:

```
powershell -ExecutionPolicy Bypass -File set-domain.ps1 -Domain alfathresidence.com
```

Then re-render the brochure so its back page shows the new address, and publish:

```bash
cd "C:\Users\huals\Downloads\Claude Projects\Al Fath Landing page\site" && git add -A && git commit -m "Point site at alfathresidence.com" && git push
```

(Ask me to re-render the brochure PDF, or see section 6.)

---

## 4. Turning the enquiry form on

1. Go to **web3forms.com**
2. Enter the inbox that should receive leads
3. They email you an access key (a long UUID)
4. Open `site\index.html`, find `var ENQ = {` near the bottom, and paste the key:

```js
var ENQ = { accessKey: 'paste-your-key-here', ... };
```

5. Commit and push (see section 5)

The key is safe in public code — it only allows sending to *your* inbox, and you can restrict it
to your domain in their dashboard.

Prefer a CRM or Zapier instead? Send me the endpoint and I'll wire it there.

---

## 5. Editing after launch

The loop is always the same:

1. Edit the file (or ask me to)
2. Preview at http://127.0.0.1:8796/
3. Publish:

```bash
cd "C:\Users\huals\Downloads\Claude Projects\Al Fath Landing page\site" && git add -A && git commit -m "describe the change" && git push
```

Netlify picks it up within a minute or two.

### Where the common things live — all in `site\index.html`

| To change | Search for |
|-----------|-----------|
| Headline / subtitle | `Your home in Madinah` |
| Phone number | `tel:+966` |
| Email address | `stay@alfathresidence.com` |
| Apartment sizes, bed/bath counts | `var PLANS` |
| Map pin, drive times, list of holy sites | `var RESIDENCE` / `var SITES` |
| Enquiry form delivery | `var ENQ` |
| Gallery photos | `var SHOTS` |
| "32 residences / 4 per floor" | `class="facts"` |

Images and video are in `site\assets\`. Replacing a photo: keep the same filename and it just works.

> **Replacing the hero video:** give the new file a *new name* (`hero-r4.mp4`) and update the
> reference in `index.html`. Videos are cached for a year, so reusing the name means returning
> visitors keep seeing the old one.

### Undoing a mistake

```bash
cd "C:\Users\huals\Downloads\Claude Projects\Al Fath Landing page\site" && git log --oneline
```

Find the commit you want, then `git revert <id>` and push. Netlify also keeps every past deploy —
**Deploys → pick one → Publish deploy** rolls the live site back instantly.

---

## 5b. The two languages (English + Arabic)

| URL | Language | File |
|-----|----------|------|
| `alfathresidence.com/` | English | `site/index.html` |
| `alfathresidence.com/en` | English | redirects to `/` (see `site/_redirects`) |
| `alfathresidence.com/ar/` | Arabic | `site/ar/index.html` — **generated, never edit by hand** |

A visitor switches languages with the link in the top bar (**العربية** / **English**).

### How it works

The Arabic page is *built* from the English one, so the two can never drift apart. Three files:

- **`site/index.html`** — the real page. Structure, images, 3D viewer, forms.
- **`i18n/ar.tsv`** — the dictionary. Two columns separated by a Tab: the exact English text
  on the left, the Arabic on the right. 366 entries, including all 189 country names.
- **`i18n/build-ar.pl`** — swaps every left-hand string for its right-hand one, then flips the
  page to right-to-left: `dir="rtl"`, Arabic fonts (Amiri for headings, Tajawal for text),
  mirrored borders and pinned corners, and clears letter-spacing (which breaks Arabic script).

### To change Arabic wording

1. Open `i18n/ar.tsv`, find the line, edit the text **after the Tab**
2. Rebuild:

```bash
cd "C:\Users\huals\Downloads\Claude Projects\Al Fath Landing page" && bash i18n/build-ar.sh
```

3. Check http://127.0.0.1:8796/ar/ , then commit and push as usual

### To change something on both pages

Edit `site/index.html` (English), then run the rebuild command above — the Arabic page picks
up the change automatically. If you added *new* English text, the build prints a warning
listing what has no translation yet; add those lines to `i18n/ar.tsv` and rebuild.

That warning is the safety net: it is impossible to quietly ship a half-translated page.

### What stays in English on the Arabic page

- Room labels printed inside the floor-plan drawings (BED ROOM, KITCHEN…) — they are baked
  into the images; changing them means re-exporting the plans from the architect's files
- The brochure PDF
- Map attribution (a legal requirement from the map provider)

---

## 6. Re-rendering the brochure

The PDF is generated from `brochure\brochure.html`:

```
powershell -Command "& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' --headless --disable-gpu --user-data-dir=$env:TEMP\ep1 --no-pdf-header-footer --virtual-time-budget=25000 '--print-to-pdf=C:\Users\huals\Downloads\Claude Projects\Al Fath Landing page\site\assets\Al-Fath-Residence-Brochure.pdf' 'file:///C:/Users/huals/Downloads/Claude%20Projects/Al%20Fath%20Landing%20page/brochure/brochure.html'"
```

Use a different `--user-data-dir` each time (`ep1`, `ep2`, …) or Edge silently does nothing.

---

## 7. Worth knowing

- **Bandwidth.** Netlify's free plan allows 100 GB per month. The desktop hero video is 28 MB and
  the mobile one 12.5 MB, so roughly **4,000–8,000 visits a month** before you hit the limit. Fine
  for a normal launch; if you run paid ads, tell me and I'll compress the video further.
- **Both addresses stay live.** `alfathresidence.netlify.app` keeps working after you add the
  custom domain. Set the custom one as **Primary domain** so Netlify redirects to it.
- **The old site folder.** `Al Fath - LIVE deploy\` is the previous version, untouched, as a backup.
  Nothing deploys from it.
