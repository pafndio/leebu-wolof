#!/usr/bin/env python3
"""Envoie la notification « Léebu du jour » de Wolof Njaay Neena via OneSignal.

Le léebu choisi est EXACTEMENT celui que l'application affiche ce jour-là
(même calcul que dans js/app.js : hashString(AAAA-M-J) % nombre de léebu).

Variables d'environnement :
  ONESIGNAL_APP_ID    App ID OneSignal                       (obligatoire)
  ONESIGNAL_API_KEY   REST API Key OneSignal (secrète)       (obligatoire)
  SITE_URL            Adresse de l'application (https://...) (recommandé)
  IMMEDIAT=true       Envoyer tout de suite (test), sans attendre 9h00
  DRY_RUN=1           Afficher ce qui serait envoyé, sans rien envoyer
  DATE=AAAA-MM-JJ     Forcer la date (tests)

Dakar est en UTC+0 toute l'année : 9h à Dakar = 9h UTC.
La formule gratuite de OneSignal ne permet pas de programmer un envoi à l'avance :
le script est donc lancé un peu avant 9h et attend 9h00 pile avant d'envoyer.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HEURE_ENVOI_UTC = 9
ATTENTE_MAX_S = 60 * 60          # n'attend jamais plus d'une heure
LONGUEUR_MAX = 180
RACINE = Path(__file__).resolve().parent.parent
API = "https://api.onesignal.com/notifications"


def hash_string(texte: str) -> int:
    """Reproduit hashString() de js/app.js (entier 32 bits signé, puis valeur absolue)."""
    h = 0
    for ch in texte:
        h = ((h << 5) - h + ord(ch)) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return abs(h)


def cle_du_jour(d) -> str:
    """Même format que todayKey() dans l'app : année-mois-jour, sans zéros devant."""
    return f"{d.year}-{d.month}-{d.day}"


def leebu_du_jour(citations, d):
    return citations[hash_string(cle_du_jour(d)) % len(citations)]


def raccourcir(texte: str, maxi: int = LONGUEUR_MAX) -> str:
    texte = " ".join(texte.split())
    if len(texte) <= maxi:
        return texte
    coupe = texte[:maxi].rsplit(" ", 1)[0].rstrip(",;:.- ")
    return coupe + "…"


def construire_message(leebu) -> str:
    corps = leebu["citation"]
    if leebu.get("traduction"):
        corps += "\n« " + leebu["traduction"] + " »"
    return raccourcir(corps)


def construire_payload(app_id: str, leebu, site_url: str) -> dict:
    message = construire_message(leebu)
    titre = "Léebu du jour"
    payload = {
        "app_id": app_id,
        "target_channel": "push",
        "included_segments": ["Subscribed Users"],
        "headings": {"en": titre, "fr": titre},
        "contents": {"en": message, "fr": message},
    }
    if site_url:
        payload["url"] = site_url.rstrip("/") + "/?source=notification#accueil"
    return payload


def attendre_9h(maintenant: datetime) -> None:
    cible = maintenant.replace(hour=HEURE_ENVOI_UTC, minute=0, second=0, microsecond=0)
    reste = (cible - maintenant).total_seconds()
    if reste <= 0:
        print(f"Il est déjà {maintenant:%H:%M} UTC : envoi immédiat.")
        return
    if reste > ATTENTE_MAX_S:
        sys.exit(f"Trop tôt : {reste / 60:.0f} min avant 9h. Relancez plus près de l'heure.")
    print(f"Attente de {reste / 60:.1f} min jusqu'à 9h00 (Dakar)…", flush=True)
    time.sleep(reste)


def envoyer(payload: dict, api_key: str) -> None:
    requete = urllib.request.Request(
        API,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Key {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(requete, timeout=30) as reponse:
            corps = json.loads(reponse.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        sys.exit(f"OneSignal a refusé la demande (HTTP {e.code}) : {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"OneSignal est injoignable : {e.reason}")

    if not corps.get("id"):
        # Pas d'identifiant = personne n'était abonné à ce moment-là
        print("Aucune notification créée : aucun abonné actif pour l'instant.", corps)
        return
    print("Notification envoyée. Identifiant :", corps["id"], "| destinataires :", corps.get("recipients", "?"))


def main() -> None:
    citations = json.loads((RACINE / "data" / "citations.json").read_text(encoding="utf-8"))
    maintenant = datetime.now(timezone.utc)
    if os.environ.get("DATE"):
        jour = datetime.strptime(os.environ["DATE"], "%Y-%m-%d").date()
    else:
        jour = maintenant.date()

    leebu = leebu_du_jour(citations, jour)
    print(f"Léebu du {jour} (n°{leebu['id']}) : {leebu['citation']}")

    app_id = os.environ.get("ONESIGNAL_APP_ID", "").strip()
    api_key = os.environ.get("ONESIGNAL_API_KEY", "").strip()
    site_url = os.environ.get("SITE_URL", "").strip()
    payload = construire_payload(app_id or "APP_ID_MANQUANT", leebu, site_url)

    if os.environ.get("DRY_RUN") == "1":
        print("DRY_RUN — rien n'est envoyé. Contenu :")
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    if not app_id or not api_key:
        sys.exit("ONESIGNAL_APP_ID et ONESIGNAL_API_KEY doivent être définis (GitHub > Settings > Secrets).")
    if not site_url:
        print("Avertissement : SITE_URL est vide, un toucher sur la notification n'ouvrira pas l'application.")

    if os.environ.get("IMMEDIAT", "").lower() != "true":
        attendre_9h(maintenant)
    envoyer(payload, api_key)


if __name__ == "__main__":
    main()
