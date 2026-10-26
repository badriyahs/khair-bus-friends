# Khair Bus Friends

A simple site where people choose what they'll bring to an initiative, and the list of what's still needed updates for everyone.

- **index.html**: upcoming and past initiatives
- **initiative.html?id=…**: the item list. Pick items, choose how many, add your own, confirm with your name. No account needed.
- **admin.html**: private team dashboard. Create initiatives, edit items and quantities, see who's bringing what, remove sign-ups, download the list.

Plain HTML, CSS and JavaScript, with no build step. Hosted on GitHub Pages, and the data lives in Firebase (free plan).

## Preview mode

Until a Firebase config is added to `js/config.js`, the site runs in **preview mode**. Everything works with sample data, but sign-ups are saved only in the browser you're using, and the dashboard has no login. A yellow bar at the top says when you're in preview mode.

## Going live (about 15 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com), create a project (e.g. `khair-bus-friends`). Analytics can be off.
2. **Build → Firestore Database → Create database** (production mode, a nearby region).
3. **Firestore → Rules**: paste in everything from `firestore.rules`, then **Publish**.
4. **Build → Authentication → Get started → Email/Password → Enable.**
   Then **Users → Add user** for each team member (email + password).
5. Copy each team member's **User UID** from the Users list. In **Firestore → Data**, create a collection called `admins`, and add one document per team member, with the **document ID = their UID** (add any field, e.g. `name: "Salma"`).
6. **Project settings → General → Your apps → Web (</>)**: register an app and copy the `firebaseConfig` values into `js/config.js` (replace `firebase: null`).
7. **Authentication → Settings → Authorized domains**: add the site's domain (e.g. `badriyahs.github.io`).

The Firebase web config isn't a secret. It's meant to be in the page, and `firestore.rules` is what protects the data:

- anyone can read initiatives and the item counts
- anyone can sign up for an open initiative
- anyone with the link sees the names in the list at the end of each event page
- only the team can edit lists or remove sign-ups

## Swapping in the real logo and photos

- Logos: `img/logo.png` + `img/logo-96.png` (hand-drawn bus, cut from their profile picture) and `img/logo-official.png`. Swap in higher-quality files with the same names if they have them.
- The waving hand on the home page is drawn over `img/logo.png`; if that logo is replaced, its position in `index.html` needs adjusting.
- Colours, font and the crayon texture are at the top of `css/style.css`.
