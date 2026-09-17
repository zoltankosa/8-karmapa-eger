# 8 Karmapa Eger

Mobile-friendly registration page for the 8 Karmapa weekend, 25-27 September 2026.

- **Résztvevők / Attendees:** register, edit or delete, filter by meal ("who is coming to Saturday lunch?"), search by name.
- **Konyha / Kitchen:** portions per meal split into meat and vegetarian, name lists per meal, a shopping summary you can copy or print, and the money summary.
- **Program:** the weekend schedule in Hungarian or English.

Prices: dinner and lunch 1 800 Ft, breakfast 1 000 Ft, accommodation 2 000 Ft per night (Friday and Saturday).

The page checks for changes every 10 seconds and whenever it comes back into view, so everyone sees new registrations without reloading.

## How the shared data works

GitHub Pages only serves static files, so the registrations live in a Google Sheet owned by the organiser. A small Google Apps Script (`apps-script/Code.gs`) reads and writes that sheet. Until it is connected, the page runs in demo mode and keeps data on the visitor's own device.

### Connecting the Google Sheet (one time, about 5 minutes)

1. Create a new Google Sheet, for example "8 Karmapa Eger jelentkezések".
2. In the sheet: **Extensions → Apps Script**. Delete the sample code, paste the whole of `apps-script/Code.gs`, and save.
3. **Deploy → New deployment**. Click the gear icon, choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**, then **Authorize access** and allow it with your Google account.
5. Copy the **Web app URL** (it ends in `/exec`) and put it in `config.js` as `API_URL`.

The sheet fills itself: one row per person, meal columns show the price when booked, plus a total. You can also fix rows by hand in the sheet; the page picks the changes up.

If you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## Development

No build step. Serve the folder with any static server, for example `python3 -m http.server`.

```
npm test
```

runs the price and summary calculations, and the Apps Script backend against an in-memory sheet.
