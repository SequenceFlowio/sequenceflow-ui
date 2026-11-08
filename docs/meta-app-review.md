# Meta-app van SequenceFlow en App Review

Doel: een eigen Meta-app van SequenceFlow (los van Noctis), zodat de Content Calendar nu en Content One later via "Inloggen met Facebook" kan publiceren op Instagram en Facebook van klanten. Daarvoor moet Meta de rechten goedkeuren (App Review, Advanced Access).

Code: `lib/contentCalendar/meta.ts` (koppeling), `app/api/contentcalender/meta/*` (connect, callback, select, disconnect, data-deletion, deauthorize), `app/gegevens-verwijderen` (instructies), privacyverklaring (sectie 2 en 5).

## 1. App aanmaken

1. developers.facebook.com → My Apps → **Create app**.
2. Use case: **Other** → app type **Business**.
3. Naam: **SequenceFlow**, contact: hallo@sequenceflow.io, Business portfolio: **SequenceFlow**.
4. Voeg de producten toe: **Facebook Login for Business** en **Instagram** (Instagram API met Facebook Login).

## 2. Instellingen

**App settings → Basic**
- App domains: `sequenceflow.io`, `www.sequenceflow.io`
- Privacy Policy URL: `https://www.sequenceflow.io/privacyverklaring`
- Terms of Service URL: `https://www.sequenceflow.io/algemene-voorwaarden`
- User data deletion → Data deletion callback URL: `https://www.sequenceflow.io/api/contentcalender/meta/data-deletion`
  (instructiepagina, als Meta die vraagt: `https://www.sequenceflow.io/gegevens-verwijderen`)
- App icon: 1024×1024, het SequenceFlow-icoon
- Category: Business and pages

**Facebook Login for Business → Settings**
- Valid OAuth Redirect URIs: `https://www.sequenceflow.io/api/contentcalender/meta/callback`
- Deauthorize callback URL: `https://www.sequenceflow.io/api/contentcalender/meta/deauthorize`
- Maak een **configuratie** (type: User access token) met de rechten hieronder. Zet het configuratie-ID in Vercel als `META_LOGIN_CONFIG_ID`. Zonder ID vraagt de app de rechten los op.

**Vercel (Production)**
- `META_APP_ID` en `META_APP_SECRET` (App settings → Basic)
- optioneel `META_LOGIN_CONFIG_ID`
- daarna redeployen

Testen kan meteen: in ontwikkelmodus werkt de koppeling voor iedereen met een rol in de app (beheerder, ontwikkelaar, tester). Content Calendar → status rechtsboven → **Koppel met Facebook**. Zodra dat werkt, mogen `META_ACCESS_TOKEN`, `META_PAGE_ID` en `META_IG_USER_ID` (Noctis-token) weg uit Vercel.

## 3. Bedrijfsverificatie

Business Settings → Security Center → **Start verification**, met het KvK-uittreksel (78237750) en een document met het bedrijfsadres. Advanced Access wordt pas gegeven na verificatie.

## 4. App Review: rechten en onderbouwing

App Review → Permissions and Features → **Request advanced access** voor elk recht hieronder. Meta wil per recht een korte uitleg (Engels) en een screencast.

| Recht | Waarvoor |
|---|---|
| `pages_show_list` | Pagina's tonen om er één te kiezen |
| `business_management` | Pagina's die in een Business-portfolio staan |
| `pages_read_engagement` | Reacties en shares van eigen posts |
| `pages_manage_posts` | Posts publiceren op de Facebook-pagina |
| `instagram_basic` | Het gekoppelde Instagram-account lezen |
| `instagram_content_publish` | Carrousels publiceren op Instagram |
| `instagram_manage_insights` | Bereik, saves en shares van eigen posts |

**Teksten om te plakken**

- *pages_show_list*: "SequenceFlow is a content calendar for e-commerce businesses. After logging in with Facebook, the user sees the list of Pages they manage and chooses the Page (and the Instagram business account linked to it) where their approved posts will be published. We only display the Page name and use the Page ID to publish."
- *business_management*: "Many of our users manage their Facebook Page and Instagram account through a Meta Business portfolio. We use this permission only to access those Pages and their linked Instagram accounts so the user can select them in SequenceFlow. We do not manage business assets, ad accounts or people."
- *pages_read_engagement*: "We read the reactions, comments count and shares of posts that SequenceFlow published on the user's Page, and show them in the Performance tab so the user can see which posts work best. We only read data of posts created through our app."
- *pages_manage_posts*: "Users plan and approve posts (an image carousel with caption) in the SequenceFlow content calendar. At the scheduled date and time, SequenceFlow publishes the approved post to the Facebook Page the user selected. Nothing is published without the user's approval."
- *instagram_basic*: "We read the Instagram business account linked to the selected Facebook Page (id and username) to show the user which account is connected, and we read like and comment counts of posts SequenceFlow published."
- *instagram_content_publish*: "Users approve posts in the SequenceFlow content calendar. At the scheduled time, SequenceFlow publishes the approved image carousel with its caption to the user's Instagram business account. The user can see, edit, reschedule or delete every post before it is published."
- *instagram_manage_insights*: "For posts that SequenceFlow published, we read reach, saves and shares 24 hours, 3 days and 7 days after publishing. We show these in the Performance tab and use them to suggest which content formats work best for this account. We only read insights of the user's own posts."

**Screencast (één video van ±2 minuten volstaat, Engels ondertiteld of met uitleg in beeld)**
1. Inloggen op `https://www.sequenceflow.io/contentcalender/login`.
2. Status rechtsboven → **Koppel met Facebook** → het Facebook-loginvenster met alle gevraagde rechten → pagina en Instagram-account kiezen → terug in de app: "Gekoppeld".
3. Kalender: een post openen, slides en caption tonen, **Goedkeuren**.
4. **Nu posten** (of een ingeplande post) → laten zien dat hij op Instagram (carrousel) en op de Facebook-pagina staat.
5. Tabblad **Prestaties** → **Cijfers verversen** → bereik, likes, saves en shares van die post.
6. Status → **Ontkoppelen** → laten zien dat de koppeling weg is.

**Testinstructies voor de reviewer** (veld "Notes for reviewer")
"Open https://www.sequenceflow.io/contentcalender/login and enter the access code below. Click the status button in the top right, then 'Koppel met Facebook' (Connect with Facebook). Log in with a test user that manages a Facebook Page with a linked Instagram business account. Open any post in 'Beoordelen' (Review), approve it and click 'Nu posten' (Post now). The 'Prestaties' (Performance) tab shows the post's insights. The interface is in Dutch; the steps above describe every button used."
Zet de toegangscode alleen in het reviewerveld, nooit in deze repo.

## 5. Na goedkeuring

App mode → **Live**. Daarna kan elke klant met een Facebook-pagina en Instagram-bedrijfsaccount koppelen. Voor Content One komt de koppeling per workspace (nu is er één koppeling voor SequenceFlow zelf).
