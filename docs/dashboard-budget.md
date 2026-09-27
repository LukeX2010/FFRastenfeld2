# Dashboard und Sammelveröffentlichung

- Alle gespeicherten Entwürfe werden vor dem öffentlichen Git-Commit validiert. Ein unvollständiger oder veralteter Entwurf stoppt das Paket. Auch ausgefilterte Entwürfe sind eingeschlossen.
- Bilder und posts.json werden gemeinsam in einem Commit geschrieben. Git-Referenzen werden niemals erzwungen überschrieben. Wiederholungen identischer Veröffentlichungen lösen keinen weiteren Commit aus.
- Entwürfe dürfen unvollständig bleiben; vor Veröffentlichung ist bei Einsätzen der Einsatztyp Pflicht.
- Aktivitätsprotokoll: Benutzer und Zeit kommen vom Server, zusätzlich Titel, Kategorie, geänderte Feldnamen und Sammelveröffentlichungen. Keine Notiztexte oder Geheimnisse.
- Persönlicher Richtwert: 15 Veröffentlichungen pro Zeitraum vom 10. bis zum 9. des Folgemonats (Europe/Vienna). Baseline September 2026: 4 erfolgreiche Produktionsdeploys laut Netlify-Abfrage am 27.09.2026 plus dieser Dashboard-Deploy. Automatischer Neustart am 10., auch über Jahreswechsel.
- Der Zähler ist keine Netlify-Abrechnung: Code-Deploys, manuelle Deploys und anderer Creditverbrauch sind nicht enthalten. Vor dem späteren Livegang Baseline aktualisieren. Weitere erfolgreiche Redaktions-Commits werden privat in publication-usage.json gezählt. Bei fehlgeschlagener privater Nachbuchung weist die Oberfläche darauf hin.
- Lokal: ADMIN_ENV_FILE kann auf eine vorhandene private .env.local zeigen; PORT bestimmt den Port. `node scripts/admin-local.mjs` verwendet ausschließlich lokale Sandboxdaten. Nach Backendänderungen neu starten.
- Absätze werden in allen vier öffentlichen Beitrags-Detailansichten ohne HTML-Ausführung erhalten, auch für ältere Beiträge mit gespeicherten Zeilenumbrüchen.
