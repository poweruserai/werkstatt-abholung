require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const { scheduleCleanup } = require('./src/cleanup');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
    },
  },
}));

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/vehicles', require('./src/routes/vehicles'));
app.use('/api/status', require('./src/routes/status'));
app.use('/api/config', require('./src/routes/config'));

app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/manager', (req, res) => res.sendFile(path.join(__dirname, 'public/manager.html')));
app.get('/status/:token', (req, res) => res.sendFile(path.join(__dirname, 'public/status.html')));
app.get('/datenschutz', (req, res) => res.sendFile(path.join(__dirname, 'public/datenschutz.html')));

app.use((req, res) => res.status(404).json({ error: 'Nicht gefunden' }));

scheduleCleanup();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Werkstatt Abholsystem läuft auf Port ${PORT}`);
  console.log(`Umgebung: ${process.env.NODE_ENV || 'development'}`);
});
