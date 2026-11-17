# TikTok in de Content Calendar

Code: `lib/contentCalendar/tiktok.ts`, `app/api/contentcalender/tiktok/*`, publisher (`publishPost`, `syncTikTokStatuses`).

- **Carrousels** → TikTok-fotopost (TikTok haalt de JPEG-slides op van `https://www.sequenceflow.io/api/contentcalender/render/...`).
- **Reels** → TikTok-video; wij uploaden het bestand zelf (FILE_UPLOAD), dus de opslag hoeft niet geverifieerd te worden.
- **Stories** gaan niet naar TikTok.
- **Modus** (statusmenu → TikTok): *inbox* (standaard) zet de post als concept in de TikTok-app, jij plaatst hem en kunt een geluid kiezen; *direct* plaatst meteen. Zonder audit van TikTok kan direct alleen privé (SELF_ONLY).
- Status per post: wordt verwerkt → in je inbox / geplaatst / mislukt. Mislukt gaat terug naar goedgekeurd en wordt tot 3× opnieuw geprobeerd.

## TikTok-app instellen (developers.tiktok.com)

1. Maak een developer-account en een app **SequenceFlow** (organisatie: SequenceFlow).
2. App-gegevens: icoon, beschrijving, categorie, Terms of Service `https://www.sequenceflow.io/algemene-voorwaarden`, Privacy Policy `https://www.sequenceflow.io/privacyverklaring`, platform **Web**, website `https://www.sequenceflow.io`.
3. Producten: **Login Kit** (redirect URI `https://www.sequenceflow.io/api/contentcalender/tiktok/callback`) en **Content Posting API** (zet *Direct Post* aan).
4. Scopes: `user.info.basic`, `video.upload`, `video.publish`.
5. **URL properties** → URL-voorvoegsel `https://www.sequenceflow.io/api/contentcalender/` verifiëren: TikTok geeft een bestand (bijv. `tiktokAbC123.txt`). Zet in Vercel `TIKTOK_VERIFICATION_FILE` (de bestandsnaam) en `TIKTOK_VERIFICATION_CONTENT` (de inhoud), redeploy, en klik op Verify.
6. Vercel: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, redeploy.
7. In de sandbox van TikTok: voeg het SequenceFlow-TikTok-account toe als **target user**, dan kun je meteen testen.
8. Content Calendar → status → **Koppel met TikTok**.
9. Audit aanvragen voor openbaar direct plaatsen: met een korte video van koppelen, instellingen kiezen en een post plaatsen.

Let op: met een zakelijk TikTok-account kun je alleen geluiden uit de commerciële muziekbibliotheek gebruiken.
