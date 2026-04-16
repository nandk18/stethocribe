

# Fix Landing Page Mobile Issues + Auth Back Button

## Issues Found
1. **Mobile navbar** — hamburger menu has nav links but no Login button (only "Start Free Trial")
2. **Auth page** — no back button to return to landing page
3. **"How it Works" steps** — on mobile, steps are in a flex-col but alignment is off (items-start with inner items-center mismatch)
4. **Comparison table** — just has `overflow-x-auto` but no visual cue; table is too wide for 390px screens

## Plan

### 1. Add Login button to mobile menu (LandingPage.tsx, line ~121)
Add a "Login" link before the "Start Free Trial" button in the mobile dropdown menu.

### 2. Add back arrow to Auth page (Auth.tsx, line ~70)
Add a `Link to="/"` with a back arrow icon at the top-left of the auth page so users can return to the landing page.

### 3. Fix "How it Works" mobile alignment (LandingPage.tsx, lines 190-201)
- On mobile, each step should be a horizontal row with the circle on the left and text on the right, properly left-aligned
- Add a vertical connecting line between step circles on mobile
- Center the title text properly

### 4. Make comparison table mobile-friendly (LandingPage.tsx, lines 324-353)
- On mobile, reduce font size and cell padding
- Add a subtle scroll indicator or make the table narrower by abbreviating column headers
- Alternatively, switch to a card-based layout on small screens showing StethoScribe vs each competitor

## Files to Edit
- `src/pages/LandingPage.tsx` — fixes 1, 3, 4
- `src/pages/Auth.tsx` — fix 2

