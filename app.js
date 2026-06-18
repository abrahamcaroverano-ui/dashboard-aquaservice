const GOOGLE_SHEETS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRsuO7dMqW2A058yUq6IXeiEa7iMe7mtufJRQjfIdeaH4p5VMqYolL55Xyu38rIHXZklo1yVJOHIv3D/pub?output=csv';

const fmtPct = (v) => {
  if (v === null || v === undefined || v === '') return '-';
  let n = parseNumber(v);
  if (Number.isNaN(n)) return String(v);
  if (Math.abs(n) <= 1) n = n * 100;
  return n.toLocaleString('es-ES', { maximumFractionDigits: 2 }) + '%';
};

const fmtNum = (v) => {
  if (v === null || v === undefined || v === '') return '-';
  const n = parseNumber(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString('es-ES', { maximumFractionDigits: 0 });
};

function parseNumber(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace('%', '').replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  return Number(s);
}

const pctNumber = (v) => {
  let n = parseNumber(v);
  if (Number.isNaN(n)) return 0;
  if (Math.abs(n) <= 1) n *= 100;
  return n;
};

const cleanName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && inQuotes && n === '"') { cell += '"'; i++; }
    else if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && n === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = (rows.shift() || []).map(h => cleanName(h).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return rows
    .filter(r => r.some(c => String(c).trim() !== ''))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}

function get(row, names) {
  for (const name of names) {
    const key = cleanName(name).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  return '';
}

function normalizaFila(r) {
  const bloque = get(r, ['bloque', 'area', 'tipo', 'categoria']);
  const delegacion = get(r, ['delegacion', 'delegación', 'zona']);
  const ruta = get(r, ['ruta', 'codigo ruta', 'código ruta']);
  const indicador = get(r, ['indicador', 'kpi', 'medida']);
  const valor = get(r, ['valor', 'resultado', 'real', 'dato']);
  const objetivo = get(r, ['objetivo', 'meta']);
  const estado = get(r, ['estado', 'semaforo', 'semáforo']);
  const fecha = get(r, ['fecha', 'mes', 'periodo', 'período']);
  const observaciones = get(r, ['observaciones', 'accion', 'acción', 'comentario', 'comentarios']);
  return { bloque, delegacion, ruta, indicador, valor, objetivo, estado, fecha, observaciones, raw: r };
}

function semaforoPorFila(row) {
  const e = cleanName(row.estado);
  if (['verde', 'green', 'correcto', 'ok'].some(x => e.includes(x))) return 'green';
  if (['amarillo', 'ambar', 'amber', 'atencion', 'atención'].some(x => e.includes(x))) return 'amber';
  if (['rojo', 'red', 'actuar', 'mal'].some(x => e.includes(x))) return 'red';

  const indicador = cleanName(`${row.bloque} ${row.indicador}`);
  const n = pctNumber(row.valor);
  const obj = pctNumber(row.objetivo);

  if (indicador.includes('cafe') || indicador.includes('cumplimiento') || indicador.includes('realizado')) {
    if (obj) return n >= obj ? 'green' : n >= obj * 0.85 ? 'amber' : 'red';
    return n >= 90 ? 'green' : n >= 80 ? 'amber' : 'red';
  }
  if (indicador.includes('incidencia')) return n <= 1.5 ? 'green' : n <= 2.5 ? 'amber' : 'red';
  if (indicador.includes('nodel')) return n <= 3 ? 'green' : n <= 5 ? 'amber' : 'red';
  if (indicador.includes('higiene')) return n <= 1 ? 'green' : n <= 1.5 ? 'amber' : 'red';
  if (indicador.includes('aviso')) return n === 0 ? 'green' : n <= 5 ? 'amber' : 'red';
  if (obj) return n >= obj ? 'green' : n >= obj * 0.85 ? 'amber' : 'red';
  return 'amber';
}

const labelStatus = (s) => s === 'green' ? 'Correcto' : s === 'amber' ? 'Atención' : 'Actuar';

let charts = {};
let detailRows = [];
let rawRows = [];

async function fetchData() {
  const res = await fetch(GOOGLE_SHEETS_CSV + '&cache=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo cargar Google Sheets');
  const csv = await res.text();
  return parseCSV(csv).map(normalizaFila);
}

function filtered(rows) {
  const f = document.getElementById('delegationFilter').value;
  if (f === 'all') return rows;
  return rows.filter(r => cleanName(`${r.delegacion} ${r.ruta}`).includes(f));
}

function drawChart(id, type, labels, datasets, options = {}) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  charts[id] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true } },
      ...options
    }
  });
}

function rowsBy(rows, words) {
  return rows.filter(r => words.some(w => cleanName(`${r.bloque} ${r.indicador}`).includes(cleanName(w))));
}

function renderKpis(rows) {
  const kpis = rows.slice(0, 8).map(r => ({
    title: r.bloque || r.indicador || 'KPI',
    value: String(r.indicador).includes('%') || String(r.valor).includes('%') ? fmtPct(r.valor) : fmtNum(r.valor),
    sub: `${r.delegacion || 'Todas'}${r.ruta ? ' · Ruta ' + r.ruta : ''}${r.objetivo ? ' · Obj: ' + r.objetivo : ''}`,
    status: semaforoPorFila(r)
  }));

  document.getElementById('kpiCards').innerHTML = kpis.length ? kpis.map(k => `
    <article class="card">
      <h4>${k.title}</h4>
      <p class="value">${k.value}</p>
      <span class="status ${k.status}"><i class="dot ${k.status}"></i>${labelStatus(k.status)}</span>
      <p class="sub">${k.sub}</p>
    </article>`).join('') : `<article class="card"><h4>Sin datos</h4><p class="sub">Revisa que la hoja tenga columnas: bloque, delegacion, ruta, indicador, valor, objetivo, estado.</p></article>`;
}

function renderIncidencias(rows) {
  const inc = rowsBy(rows, ['incidencia']).sort((a, b) => pctNumber(b.valor) - pctNumber(a.valor));
  drawChart('incidenciasChart', 'bar', inc.map(r => r.ruta || r.delegacion || r.indicador), [{ label: '% / valor incidencia', data: inc.map(r => pctNumber(r.valor)), borderWidth: 1 }], { scales: { y: { ticks: { callback: v => v + '%' } } } });
  document.getElementById('rutasCriticas').innerHTML = `<div class="list">${inc.slice(0, 8).map(r => {
    const st = semaforoPorFila(r);
    return `<div class="list-row"><div><strong>${r.ruta ? 'Ruta ' + r.ruta : r.delegacion}</strong><br><span>${r.indicador} · ${r.observaciones || 'Seguimiento operativo'}</span></div><b>${fmtPct(r.valor)}</b><span class="status ${st}">${labelStatus(st)}</span></div>`;
  }).join('') || '<p class="sub">No hay filas de incidencias en la hoja.</p>'}</div>`;
}

function renderAvisos(rows) {
  const avisos = rowsBy(rows, ['aviso', '48h', '+48']);
  drawChart('avisosChart', 'bar', avisos.map(r => r.delegacion || r.ruta || r.indicador), [{ label: 'Avisos / %', data: avisos.map(r => pctNumber(r.valor)) }]);
  const nodel = rowsBy(rows, ['nodel', 'reagendado']);
  drawChart('nodelChart', 'line', nodel.map((r, i) => r.fecha || r.delegacion || `Dato ${i + 1}`), [{ label: 'Nodel/Reagendados', data: nodel.map(r => pctNumber(r.valor)), tension: .25 }], { scales: { y: { ticks: { callback: v => v + '%' } } } });
}

function renderHigienes(rows) {
  const hig = rowsBy(rows, ['higiene']);
  drawChart('higienesChart', 'bar', hig.map(r => r.delegacion || r.ruta || r.indicador), [{ label: 'Higienes', data: hig.map(r => pctNumber(r.valor)) }]);
  const desc = rowsBy(rows, ['descuadre']);
  drawChart('descuadresChart', 'bar', desc.map(r => r.delegacion || r.ruta || r.indicador), [{ label: 'Descuadres', data: desc.map(r => pctNumber(r.valor)) }]);
}

function renderCafe(rows) {
  const cafe = rowsBy(rows, ['cafe', 'café']);
  drawChart('cafeChart', 'bar', cafe.map(r => r.delegacion || r.ruta || r.indicador), [{ label: 'Café', data: cafe.map(r => pctNumber(r.valor)) }, { label: 'Objetivo', data: cafe.map(r => pctNumber(r.objetivo || 90)), type: 'line' }], { scales: { y: { ticks: { callback: v => v + '%' } } } });
  document.getElementById('rankingAndalucia').innerHTML = `<div class="list">${cafe.sort((a, b) => pctNumber(b.valor) - pctNumber(a.valor)).slice(0, 12).map((r, i) => {
    const st = semaforoPorFila(r);
    return `<div class="list-row"><div><strong>${i + 1}. ${r.delegacion || r.ruta || r.indicador}</strong></div><b>${fmtPct(r.valor)}</b><span class="status ${st}">${labelStatus(st)}</span></div>`;
  }).join('') || '<p class="sub">No hay filas de café en la hoja.</p>'}</div>`;
}

function buildDetailRows(rows) {
  return rows.map(r => {
    const st = semaforoPorFila(r);
    const accion = r.observaciones || (st === 'red' ? 'Revisar hoy con el jefe de equipo y poner acción correctora.' : st === 'amber' ? 'Hacer seguimiento diario.' : 'Mantener la línea de trabajo.');
    return [r.bloque || 'KPI', `${r.delegacion || 'Todas'}${r.ruta ? ' · Ruta ' + r.ruta : ''}`, r.indicador || 'Indicador', r.valor, st, accion];
  });
}

function renderTable() {
  const q = cleanName(document.getElementById('searchBox').value);
  const tbody = document.querySelector('#detailTable tbody');
  tbody.innerHTML = detailRows.filter(r => cleanName(r.join(' ')).includes(q)).map(r => `
    <tr>
      <td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td><strong>${r[3]}</strong></td>
      <td><span class="status ${r[4]}"><i class="dot ${r[4]}"></i>${labelStatus(r[4])}</span></td>
      <td>${r[5]}</td>
    </tr>`).join('');
}

function render(rows) {
  const d = filtered(rows);
  renderKpis(d);
  renderIncidencias(d);
  renderAvisos(d);
  renderHigienes(d);
  renderCafe(d);
  detailRows = buildDetailRows(d);
  renderTable();
}

fetchData().then(rows => {
  rawRows = rows;
  document.getElementById('lastUpdate').textContent = `Datos conectados a Google Sheets · ${new Date().toLocaleString('es-ES')}`;
  render(rawRows);
}).catch(err => {
  console.error(err);
  document.getElementById('lastUpdate').textContent = 'Error cargando Google Sheets. Revisa que esté publicado como CSV.';
});

document.getElementById('delegationFilter').addEventListener('change', () => render(rawRows));
document.getElementById('searchBox').addEventListener('input', renderTable);
