const token = () => localStorage.getItem('token');

if (!token()) window.location.href = '/login';
document.getElementById('nav-user').textContent = localStorage.getItem('username') || '';

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.location.href = '/login';
});

const STATUS_LABELS = {
  angenommen: 'Angenommen',
  in_bearbeitung: 'In Bearbeitung',
  wartet_auf_teile: 'Wartet auf Teile',
  fertig: 'Fertig zum Abholen',
  abgeholt: 'Abgeholt',
};

let emailEnabled = false;

fetch('/api/config').then(r => r.json()).then(cfg => {
  emailEnabled = cfg.emailEnabled;
  if (!emailEnabled) {
    document.querySelectorAll('#new-email-hint').forEach(el => {
      el.innerHTML = '<i class="bi bi-info-circle me-1"></i>E-Mail-Benachrichtigung nicht konfiguriert (SMTP in .env eintragen).';
      el.className = 'form-text text-muted';
    });
  }
});

// Modal-Instanzen einmalig anlegen und wiederverwenden
const modals = {
  newVehicle: () => bootstrap.Modal.getOrCreateInstance(document.getElementById('newVehicleModal')),
  qr:         () => bootstrap.Modal.getOrCreateInstance(document.getElementById('qrModal')),
  edit:       () => bootstrap.Modal.getOrCreateInstance(document.getElementById('editModal')),
  pw:         () => bootstrap.Modal.getOrCreateInstance(document.getElementById('pwModal')),
};

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return null;
  }
  return res;
}

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${STATUS_LABELS[status] || status}</span>`;
}

function emailIcon(email) {
  if (!email) return '';
  return `<i class="bi bi-envelope-check text-success ms-1" title="${email}"></i>`;
}

function formatDate(d) {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '–';
  return new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

let allVehicles = [];

async function loadVehicles() {
  const res = await apiFetch('/api/vehicles');
  if (!res?.ok) return;
  allVehicles = await res.json();
  renderVehicles(allVehicles);
  updateStats(allVehicles);
}

function updateStats(vehicles) {
  const active = vehicles.filter(v => v.status !== 'abgeholt');
  document.getElementById('stat-angenommen').textContent = vehicles.filter(v => v.status === 'angenommen').length;
  document.getElementById('stat-in_bearbeitung').textContent =
    vehicles.filter(v => v.status === 'in_bearbeitung' || v.status === 'wartet_auf_teile').length;
  document.getElementById('stat-fertig').textContent = vehicles.filter(v => v.status === 'fertig').length;
  document.getElementById('stat-gesamt').textContent = active.length;
}

// Buttons über data-action + data-id statt inline onclick mit JSON
function renderVehicles(vehicles) {
  const tbody = document.getElementById('vehicle-table-body');
  const mobileList = document.getElementById('mobile-list');
  const emptyMsg = document.getElementById('empty-msg');

  if (vehicles.length === 0) {
    tbody.innerHTML = '';
    mobileList.innerHTML = '';
    emptyMsg.classList.remove('d-none');
    return;
  }
  emptyMsg.classList.add('d-none');

  tbody.innerHTML = vehicles.map(v => `
    <tr>
      <td class="ps-3 fw-semibold">${v.kennzeichen}${emailIcon(v.kunde_email)}</td>
      <td>${v.fahrzeug}</td>
      <td>${statusBadge(v.status)}</td>
      <td>${formatDateTime(v.annahme_datum)}</td>
      <td>${v.abhol_datum ? formatDate(v.abhol_datum) : '–'}</td>
      <td class="text-muted small" style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${v.notizen || ''}">${v.notizen || '–'}</td>
      <td class="text-end pe-3">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary"  data-action="qr"     data-id="${v.id}" title="QR-Code"><i class="bi bi-qr-code"></i></button>
          <button class="btn btn-outline-secondary" data-action="edit"   data-id="${v.id}" title="Bearbeiten"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-outline-danger"    data-action="delete" data-id="${v.id}" title="Löschen"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  mobileList.innerHTML = vehicles.map(v => `
    <div class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <div class="fw-bold fs-5">${v.kennzeichen}${emailIcon(v.kunde_email)}</div>
            <div class="text-muted">${v.fahrzeug}</div>
          </div>
          ${statusBadge(v.status)}
        </div>
        <div class="small text-muted mb-1"><i class="bi bi-calendar me-1"></i>Annahme: ${formatDateTime(v.annahme_datum)}</div>
        ${v.abhol_datum ? `<div class="small text-muted mb-1"><i class="bi bi-calendar-check me-1"></i>Abholdatum: ${formatDate(v.abhol_datum)}</div>` : ''}
        ${v.notizen ? `<div class="small text-muted mb-2"><i class="bi bi-chat-text me-1"></i>${v.notizen}</div>` : ''}
        <div class="d-flex gap-2 mt-2">
          <button class="btn btn-sm btn-outline-primary"   data-action="qr"     data-id="${v.id}"><i class="bi bi-qr-code me-1"></i>QR</button>
          <button class="btn btn-sm btn-outline-secondary" data-action="edit"   data-id="${v.id}"><i class="bi bi-pencil me-1"></i>Bearbeiten</button>
          <button class="btn btn-sm btn-outline-danger"    data-action="delete" data-id="${v.id}"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}

// Zentraler Event-Listener – kein inline-onclick mehr nötig
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const vehicle = allVehicles.find(v => v.id === id);
  if (!vehicle) return;

  if (action === 'qr')     showQR(id);
  if (action === 'edit')   openEdit(vehicle);
  if (action === 'delete') deleteVehicle(id, vehicle.kennzeichen);
});

// Neues Fahrzeug
document.getElementById('save-new-btn').addEventListener('click', async () => {
  const btn = document.getElementById('save-new-btn');
  const errEl = document.getElementById('new-error');
  errEl.classList.add('d-none');

  const kennzeichen = document.getElementById('new-kennzeichen').value.trim();
  const fahrzeug    = document.getElementById('new-fahrzeug').value.trim();
  const notizen     = document.getElementById('new-notizen').value.trim();
  const email       = document.getElementById('new-email').value.trim();

  if (!kennzeichen || !fahrzeug) {
    errEl.textContent = 'Kennzeichen und Fahrzeug sind Pflichtfelder.';
    errEl.classList.remove('d-none');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Bitte warten...';

  const res = await apiFetch('/api/vehicles', {
    method: 'POST',
    body: JSON.stringify({ kennzeichen, fahrzeug, notizen, email }),
  });

  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Anlegen & QR-Code erzeugen';

  if (!res?.ok) {
    const data = await res.json();
    errEl.textContent = data.error || 'Fehler beim Anlegen';
    errEl.classList.remove('d-none');
    return;
  }

  const data = await res.json();

  // Formular leeren
  ['new-kennzeichen','new-fahrzeug','new-notizen','new-email'].forEach(id => {
    document.getElementById(id).value = '';
  });

  // Neues-Fahrzeug-Modal schließen, DANN QR zeigen (nach vollständiger Animation)
  const newVehicleModalEl = document.getElementById('newVehicleModal');
  newVehicleModalEl.addEventListener('hidden.bs.modal', async () => {
    await loadVehicles();
    showQRData(data.qrCode, data.statusUrl, `${data.kennzeichen} – ${data.fahrzeug}`, data.emailSet);
  }, { once: true });

  modals.newVehicle().hide();
});

// QR-Code anzeigen
async function showQR(id) {
  const res = await apiFetch(`/api/vehicles/${id}/qr`);
  if (!res?.ok) return;
  const data = await res.json();
  const v = allVehicles.find(x => x.id === id);
  showQRData(data.qrCode, data.statusUrl, v ? `${v.kennzeichen} – ${v.fahrzeug}` : '', !!v?.kunde_email);
}

let currentQRData = null;

function showQRData(qrCode, statusUrl, info, emailSet) {
  currentQRData = { qrCode, statusUrl, info };
  document.getElementById('qr-image').src = qrCode;
  document.getElementById('qr-url').href = statusUrl;
  document.getElementById('qr-url').textContent = statusUrl;
  document.getElementById('qr-info').innerHTML = `<strong>${info}</strong>`
    + (emailSet ? ' <span class="badge bg-success"><i class="bi bi-envelope-check me-1"></i>E-Mail gesetzt</span>' : '');
  modals.qr().show();
}

function printQR() {
  if (!currentQRData) return;
  document.getElementById('print-qr').src = currentQRData.qrCode;
  document.getElementById('print-info').textContent = currentQRData.info;
  window.print();
}

// Status bearbeiten
function openEdit(vehicle) {
  document.getElementById('edit-id').value = vehicle.id;
  document.getElementById('edit-info').textContent = `${vehicle.kennzeichen} – ${vehicle.fahrzeug}`;
  document.getElementById('edit-status').value = vehicle.status;
  document.getElementById('edit-abhol-datum').value = vehicle.abhol_datum || '';
  document.getElementById('edit-notizen').value = vehicle.notizen || '';
  document.getElementById('edit-email').value = vehicle.kunde_email || '';
  document.getElementById('edit-error').classList.add('d-none');
  modals.edit().show();
}

document.getElementById('save-edit-btn').addEventListener('click', async () => {
  const id         = document.getElementById('edit-id').value;
  const status     = document.getElementById('edit-status').value;
  const abhol_datum = document.getElementById('edit-abhol-datum').value;
  const notizen    = document.getElementById('edit-notizen').value;
  const email      = document.getElementById('edit-email').value.trim();
  const errEl      = document.getElementById('edit-error');
  errEl.classList.add('d-none');

  const res = await apiFetch(`/api/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, abhol_datum, notizen, email }),
  });

  if (!res?.ok) {
    const data = await res.json();
    errEl.textContent = data.error || 'Fehler beim Speichern';
    errEl.classList.remove('d-none');
    return;
  }

  modals.edit().hide();
  await loadVehicles();
});

// Fahrzeug löschen
async function deleteVehicle(id, kennzeichen) {
  if (!confirm(`Fahrzeug ${kennzeichen} wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`)) return;
  const res = await apiFetch(`/api/vehicles/${id}`, { method: 'DELETE' });
  if (res?.ok) await loadVehicles();
}

// Passwort ändern
document.getElementById('save-pw-btn').addEventListener('click', async () => {
  const errEl  = document.getElementById('pw-error');
  const succEl = document.getElementById('pw-success');
  errEl.classList.add('d-none');
  succEl.classList.add('d-none');

  const res = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: document.getElementById('pw-current').value,
      newPassword: document.getElementById('pw-new').value,
    }),
  });

  const data = await res.json();
  if (!res?.ok) {
    errEl.textContent = data.error;
    errEl.classList.remove('d-none');
  } else {
    succEl.textContent = 'Passwort erfolgreich geändert!';
    succEl.classList.remove('d-none');
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value = '';
  }
});

loadVehicles();
setInterval(loadVehicles, 60000);
