#!/bin/bash
# Deployment-Skript für Ionos VPS
# Ausführen auf dem Server als root oder mit sudo

set -e

DOMAIN="${1:?Bitte Domain angeben: ./deploy.sh werkstatt.ihredomain.de}"
EMAIL="${2:?Bitte E-Mail für SSL angeben: ./deploy.sh domain.de email@example.com}"

echo "=== Werkstatt Abholsystem Deployment ==="
echo "Domain: $DOMAIN"
echo "E-Mail: $EMAIL"
echo ""

# Docker installieren (falls nicht vorhanden)
if ! command -v docker &> /dev/null; then
  echo "[1/6] Docker installieren..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[1/6] Docker bereits installiert"
fi

# Docker Compose installieren (falls nicht vorhanden)
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "[2/6] Docker Compose installieren..."
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
else
  echo "[2/6] Docker Compose bereits installiert"
fi

# .env erstellen (falls nicht vorhanden)
if [ ! -f .env ]; then
  echo "[3/6] .env Datei erstellen..."
  cp .env.example .env
  # Zufälligen JWT-Secret generieren
  JWT_SECRET=$(openssl rand -base64 48)
  sed -i "s/AENDERN_DIESEN_GEHEIMEN_SCHLUESSEL_HIER/$JWT_SECRET/" .env
  sed -i "s|https://werkstatt.ihredomain.de|https://$DOMAIN|" .env
  echo "  ⚠  Bitte .env bearbeiten: WERKSTATT_NAME anpassen!"
else
  echo "[3/6] .env bereits vorhanden"
fi

# nginx.conf Domain ersetzen
echo "[4/6] nginx Konfiguration anpassen..."
sed -i "s/IHRE_DOMAIN_HIER/$DOMAIN/g" nginx/nginx.conf

# SSL-Zertifikat mit Certbot holen
echo "[5/6] SSL-Zertifikat anfordern..."
mkdir -p /var/www/certbot

# Temporärer nginx für ACME-Challenge
docker run --rm -d --name certbot-nginx \
  -p 80:80 \
  -v /var/www/certbot:/var/www/certbot \
  nginx:alpine \
  sh -c "echo 'events{} http{server{listen 80;location /.well-known/acme-challenge/{root /var/www/certbot;}}}' > /etc/nginx/nginx.conf && nginx -g 'daemon off;'" 2>/dev/null || true

sleep 2

docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

docker stop certbot-nginx 2>/dev/null || true

# App starten
echo "[6/6] Anwendung starten..."
docker compose up -d --build

echo ""
echo "=== Einrichtung abgeschlossen! ==="
echo ""
echo "Nächste Schritte:"
echo "  1. Admin-Benutzer anlegen: docker compose exec app node scripts/setup.js"
echo "  2. Browser öffnen: https://$DOMAIN/login"
echo ""
echo "SSL-Zertifikat Erneuerung (Cron einrichten):"
echo "  0 3 * * * cd $(pwd) && docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v /var/www/certbot:/var/www/certbot certbot/certbot renew --quiet && docker compose exec nginx nginx -s reload"
