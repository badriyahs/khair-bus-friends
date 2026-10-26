# Khair Bus Friends

A simple site where people choose what they'll bring to an initiative, and the list of what's still needed updates for everyone.

- **index.html**: upcoming and past initiatives
- **initiative.html?id=…**: the item list. Pick items, choose how many, add your own, confirm with your name. No account needed.
- **admin.html**: private team dashboard. Create initiatives, edit items and quantities, see who's bringing what, remove sign-ups, download the list.

Plain HTML, CSS and JavaScript, with no build step. Hosted on GitHub Pages, and the data lives in Firebase (free plan).

## Preview mode

Until a Firebase config is added to `js/config.js`, the site runs in **preview mode**. Everything works with sample data, but sign-ups are saved only in the browser you're using, and the dashboard has no login. A yellow bar at the top says when you're in preview mode.

## Going live

1. Create a Firebase project (Analytics off) at [console.firebase.google.com](https://console.firebase.google.com).
2. **Firestore Database → Create database** (production mode), then **Rules**: paste `firestore.rules` and **Publish**.
3. **Authentication → Sign-in method → Email/Password → Enable.** Then **Settings → User actions**: untick **Enable create (sign-up)**, so nobody can make their own account.
4. **Team logins** are a username + password. In **Authentication → Users → Add user**, put the username followed by `@<project-id>.firebaseapp.com` as the email (e.g. `khairbus@khair-bus-friends.firebaseapp.com`) and choose a password. On `admin.html` they type just the username (`khairbus`) and the password. To change a password, use the user's ⋮ menu in the same list.
5. **Project settings → Your apps → Web**: register an app and paste its `firebaseConfig` into `js/config.js`.

The Firebase web config isn't a secret. It's meant to be in the page, and `firestore.rules` is what protects the data:

- anyone can read initiatives and the item counts
- anyone can sign up for an open initiative
- anyone with the link sees the names in the list at the end of each event page
- only team logins can edit lists or remove sign-ups

## Swapping in the real logo and photos

- Logos: `img/logo.png` + `img/logo-96.png` (hand-drawn bus, cut from their profile picture) and `img/logo-official.png`. Swap in higher-quality files with the same names if they have them.
- The waving hand on the home page is drawn over `img/logo.png`; if that logo is replaced, its position in `index.html` needs adjusting.
- Colours, font and the crayon texture are at the top of `css/style.css`.
