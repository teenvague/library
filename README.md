# Library

A static, GitHub Pages-ready reading log with two public views (entry + grid) and a lightweight GitHub-backed admin page.

## Files

- `index.html` — public site
- `styles.css` — public design
- `app.js` — renders the books from `data/books.json`
- `data/books.json` — the source of truth for your books
- `admin.html` — private-ish editing interface (publicly reachable, but cannot write without your token)
- `admin.js` / `admin.css` — admin behavior + design
- `palettes.js` — all 200 palette entries used for permanent random assignment
- `.nojekyll` — prevents GitHub Pages from applying Jekyll processing

## Publish on GitHub Pages

1. Create a GitHub repository, for example `library`.
2. Upload every file/folder in this package to the repository root.
3. In GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**.
4. Choose `main` and `/ (root)`.
5. Your site will appear at `https://YOURUSERNAME.github.io/library/`.

## Editing books directly

The simplest source of truth is `data/books.json`. You can always edit that file in GitHub's web editor and commit.

Each book looks like:

```json
{
  "id": "all-fours-2026-09-02",
  "title": "All Fours",
  "author": "Miranda July",
  "date": "2026-09-02",
  "rating": 4,
  "color": "#FFFC58",
  "status": "finished",
  "review": [
    "First paragraph.",
    "Second paragraph."
  ]
}
```

For a currently reading book, use `"status": "reading"` and `"rating": null`. Its color still gets assigned and stored permanently, but while `status` is `"reading"` it displays as `#F0F0F0` instead. Once you mark it finished, its real color shows.

## Using the admin page as a GitHub backend

Open `/admin.html` on your deployed site. The admin page uses GitHub's Contents API to read and commit `data/books.json` directly to your repository.

You enter:

- GitHub owner / username
- repository name
- branch (`main` by default)
- data path (`data/books.json` by default)
- a **fine-grained personal access token**

The token is stored only in `sessionStorage`, which means it disappears when the browser tab/session ends. It is not included in the repository or public site.

For the token, give it access only to this one repository and only the minimum repository permission needed to write repository contents. Do not hard-code a token into any JavaScript file.

Workflow:

1. Open `admin.html`.
2. Enter repo information + token.
3. Click **Load from GitHub**.
4. Add/edit/delete books.
5. **Save draft** for each edited book.
6. Click **Publish changes**.
7. The admin commits `data/books.json` to your repo; GitHub Pages republishes automatically.

## Color behavior

When you create a new book through the admin, one of the 200 supplied palette entries is chosen randomly. That hex code is then stored on the book permanently. Refreshing or changing views never re-randomizes it.

## Important security note

`admin.html` is still a static public webpage. Its security comes from the fact that it contains **no GitHub credential**. Anyone can see the admin UI, but only someone with a valid repository token can publish. Keep your token private and narrowly scoped.
