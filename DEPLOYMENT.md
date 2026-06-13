# Werkstatt Abholsystem – Deployment-Anleitung

## Voraussetzungen

- Ionos VPS (Ubuntu 22.04 oder Debian 12 empfohlen)
- Domain, die auf die VPS-IP zeigt (A-Record)
- SSH-Zugang zum Server

---

## Schritt 1: Code auf den Server übertragen

```bash
# Vom lokalen Rechner aus:
scp -r ./werkstatt-abhol root@IHRE-SERVER-IP:/opt/werkstatt-abhol

# Oder mit rsync:
rsync -avz ./werkstatt-abhol/ root@IHRE-SERVER-IP:/opt/werkstatt-abhol/
```

## Schritt 2: Auf dem Server einloggen

```bash
ssh root@IHRE-SERVER-IP
cd /opt/werkstatt-abhol
chmod +x deploy.sh
```

## Schritt 3: Automatisches Deployment

```bash
./deploy.sh werkstatt.ihredomain.de ihre-email@example.com
```

Das Skript installiert Docker, holt ein SSL-Zertifikat und startet die App.

## Schritt 4: Admin-Benutzer anlegen

```bash
docker compose exec app node scripts/setup.js
```

Dann Benutzername und Passwort eingeben.

## Schritt 5: .env anpassen

```bash
nano .env
# WERKSTATT_NAME auf den echten Namen setzen, z.B.:
# WERKSTATT_NAME=Autohaus Müller GmbH
```

Nach Änderungen:
```bash
docker compose restart app
```

---

## Manuelle Installation (ohne deploy.sh)

### 1. Docker installieren
```bash
curl -fsSL https://get.docker.com | sh
```

### 2. .env erstellen
```bash
cp .env.example .env
nano .env
# JWT_SECRET, BASE_URL und WERKSTATT_NAME anpassen
```

### 3. nginx.conf anpassen
```bash
sed -i 's/IHRE_DOMAIN_HIER/werkstatt.ihredomain.de/g' nginx/nginx.conf
```

### 4. SSL-Zertifikat (Let's Encrypt)
```bash
apt install certbot
certbot certonly --standalone -d werkstatt.ihredomain.de --email ihre@email.de --agree-tos
```

### 5. App starten
```bash
docker compose up -d --build
docker compose exec app node scripts/setup.js
```

---

## Verwaltung

### App-Status prüfen
```bash
docker compose ps
docker compose logs -f app
```

### Neustart
```bash
docker compose restart
```

### Update deployen
```bash
git pull  # oder neue Dateien hochladen
docker compose up -d --build
```

### Datenbankbackup
```bash
docker compose exec app sh -c "cp /data/werkstatt.db /data/backup_$(date +%Y%m%d).db"
# Oder auf lokalen Rechner kopieren:
docker cp werkstatt-app:/data/werkstatt.db ./backup.db
```

### SSL-Zertifikat erneuern (Cron)
```bash
crontab -e
# Einfügen:
0 3 * * * cd /opt/werkstatt-abhol && docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v /var/www/certbot:/var/www/certbot certbot/certbot renew --quiet && docker compose exec nginx nginx -s reload
```

---

## DSGVO-Hinweise

- Alle Daten werden ausschließlich auf Ihrem Ionos-Server in Deutschland gespeichert
- Abgeholte Fahrzeuge werden nach 30 Tagen automatisch gelöscht (konfigurierbar über `LOESCHUNG_NACH_TAGEN`)
- Es werden nur technisch notwendige Daten gespeichert (Kennzeichen, Fahrzeugtyp, Status)
- HTTPS ist Pflicht (kein Betrieb ohne SSL empfohlen)
- Fügen Sie eine Datenschutzerklärung auf Ihrer Werkstatt-Website ein, die auf dieses System hinweist

---

## Firewall (UFW)

```bash
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP (Redirect zu HTTPS)
ufw allow 443/tcp  # HTTPS
ufw enable
```
