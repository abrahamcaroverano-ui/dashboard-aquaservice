const LOCAL_DATA = 'data.json';

/*
  OPCIÓN GRATIS PARA QUE SE ACTUALICE SOLO:
  1) Sube los Excel a Google Sheets, uno por pestaña o una hoja resumen.
  2) Publica cada pestaña como CSV.
  3) Sustituye LOCAL_DATA por tu fuente o adapta fetchData().
  Mientras tanto, esta web usa data.json, que se puede reemplazar cuando actualices datos.
*/

const fmtPct = (v) => {
  if (v === null || v === undefined || v === '') return '-';
  let n = Number(v);
  if (Number.isNaN(n)) return String(v);
  if (Math.abs(n) <= 1) n = n * 100;
  return n.toLocaleString('es-ES', {maximumFractionDigits: 2}) + '%';
};
const fmtNum = (v) => {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString('es-ES', {maximumFractionDigits: 0});
};
const pctNumber = (v) => {
  let n = Number(v);
  if (Number.isNaN(n)) return 0;
  if (Math.abs(n) <= 1) n *= 100;
  return n;
};
const cleanName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const semaforo = (type, val) => {
  const n = pctNumber(val);
  if (type === 'incidencia') return n <= 1.5 ? 'green' : n <= 2.5 ? 'amber' : 'red';
  if (type === 'nodel') return n <= 3 ? 'green' : n <= 5 ? 'amber' : 'red';
  if (type === 'higiene') return n <= 1 ? 'green' : n <= 1.5 ? 'amber' : 'red';
  if (type === 'cafe') return n >= 90 ? 'green' : n >= 80 ? 'amber' : 'red';
  if (type === 'avisos48') return n === 0 ? 'green' : n <= 5 ? 'amber' : 'red';
  return 'amber';
};
const labelStatus = (s) => s === 'green' ? 'Correcto' : s === 'amber' ? 'Atención' : 'Actuar';

let charts = {};
let detailRows = [];

async function fetchData(){
  const res = await fetch(LOCAL_DATA, {cache:'no-store'});
  return await res.json();
}

function getBajas(data){
  return [
    {delegacion:'Cádiz', total:87, fidelizacion:65, pctFidelizacion:.747, retiradas:45, pctRetirado:.6923},
    {delegacion:'Chiclana', total:47, fidelizacion:27, pctFidelizacion:.574, retiradas:24, pctRetirado:.8889}
  ];
}
function getIncidenciasMes(){
  return [
    {delegacion:'Cádiz', marzo:.0182, abril:.0176, mayo:.0166},
    {delegacion:'Chiclana', marzo:.0151, abril:.0153, mayo:.0177}
  ];
}
function getCafeDelegaciones(){
  return [
    {delegacion:'Cádiz - 113', semana1:.7015, semana2:.7113, semana3:.7153, objetivo:.9},
    {delegacion:'Chiclana - 126', semana1:.9229, semana2:.9315, semana3:.9359, objetivo:.9}
  ];
}
function filtered(data){
  const f = document.getElementById('delegationFilter').value;
  if(f === 'all') return data;
  const clone = structuredClone(data);
  clone.incidencias_rutas = (data.incidencias_rutas || []).filter(r => cleanName(r['Delegación']).includes(f));
  clone.higienes = (data.higienes || []).filter(r => f === 'all' || cleanName(r['Director Area']).includes(f) || cleanName(r['Director Area']).includes('daniel'));
  clone.descuadres = (data.descuadres || []).filter(r => cleanName(r['0 M Almacenes.Responsable_Logistica']).includes(f) || cleanName(r['0 M Almacenes.Responsable_Logistica']).includes('total'));
  return clone;
}

function drawChart(id, type, labels, datasets, options={}){
  if(charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  charts[id] = new Chart(ctx, {
    type,
    data:{labels, datasets},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{position:'bottom'}},
      scales:{y:{beginAtZero:true}},
      ...options
    }
  });
}

function renderKpis(data){
  const rutas = data.incidencias_rutas || [];
  const avgInc = rutas.length ? rutas.reduce((a,r)=>a+pctNumber(r['% incidencia']),0)/rutas.length : 0;
  const avisosChiclana = (data.avisos_48h||[]).find(r=>cleanName(r['Delegación']).includes('chiclana')) || {};
  const higChiclana = (data.higienes||[]).find(r=>cleanName(r['Director Area']).includes('chiclana')) || {};
  const cafeChiclana = getCafeDelegaciones().find(r=>r.delegacion.includes('Chiclana'));
  const kpis = [
    {title:'Incidencia media rutas', value:fmtPct(avgInc), sub:'Promedio rutas filtradas', status:semaforo('incidencia', avgInc)},
    {title:'Avisos Chiclana', value:fmtNum(avisosChiclana['Total general']), sub:`24h: ${fmtNum(avisosChiclana['24 horas'])}`, status:semaforo('avisos48', avisosChiclana['% 48 horas'])},
    {title:'Higienes Chiclana', value:fmtNum(higChiclana['TOTAL HIGIENES PENDIENTES > 15 MESES']), sub:fmtPct(higChiclana['% COOLER PENDIENTES HIGIENIZAR']), status:semaforo('higiene', higChiclana['% COOLER PENDIENTES HIGIENIZAR'])},
    {title:'Café Chiclana', value:fmtPct(cafeChiclana.semana3), sub:'Semana 3 vs objetivo 90%', status:semaforo('cafe', cafeChiclana.semana3)}
  ];
  document.getElementById('kpiCards').innerHTML = kpis.map(k=>`
    <article class="card">
      <h4>${k.title}</h4>
      <p class="value">${k.value}</p>
      <span class="status ${k.status}"><i class="dot ${k.status}"></i>${labelStatus(k.status)}</span>
      <p class="sub">${k.sub}</p>
    </article>`).join('');
}

function renderIncidencias(data){
  const rutas = [...(data.incidencias_rutas || [])].sort((a,b)=>pctNumber(b['% incidencia'])-pctNumber(a['% incidencia']));
  drawChart('incidenciasChart','bar',
    rutas.map(r=>r['Ruta']),
    [{label:'% incidencia', data:rutas.map(r=>pctNumber(r['% incidencia'])), borderWidth:1}],
    {scales:{y:{ticks:{callback:v=>v+'%'}}}}
  );
  document.getElementById('rutasCriticas').innerHTML = `<div class="list">${
    rutas.slice(0,8).map(r=>{
      const st = semaforo('incidencia', r['% incidencia']);
      return `<div class="list-row"><div><strong>${r['Ruta']} · ${r['Nombre ruta']}</strong><br><span>${r['Delegación']} · ${fmtNum(r['Incidencias'])} incidencias / ${fmtNum(r['Albaranes'])} albaranes</span></div><b>${fmtPct(r['% incidencia'])}</b><span class="status ${st}">${labelStatus(st)}</span></div>`;
    }).join('')
  }</div>`;
}

function renderAvisos(data){
  const avisos = (data.avisos_48h || []).filter(r=>r['Delegación'] && r['Delegación'] !== 'TOTAL');
  drawChart('avisosChart','bar',
    avisos.map(r=>r['Delegación']),
    [
      {label:'0 días', data:avisos.map(r=>Number(r['0 días']||0))},
      {label:'24 horas', data:avisos.map(r=>Number(r['24 horas']||0))},
      {label:'48 horas', data:avisos.map(r=>Number(r['48 horas']||0))},
      {label:'+48 horas', data:avisos.map(r=>Number(r['+ 48 horas']||0))}
    ],
    {scales:{x:{stacked:true},y:{stacked:true}}}
  );
  const nodel = data.nodel_diario || [];
  drawChart('nodelChart','line',
    nodel.map((r,i)=>`Día ${i+1}`),
    [{label:'% Nodel/Reagendados', data:nodel.map(r=>pctNumber(r['% Total'])), tension:.25}],
    {scales:{y:{ticks:{callback:v=>v+'%'}}}}
  );
}

function renderHigienes(data){
  const hig = (data.higienes || []).filter(r=>r['Director Area'] && cleanName(r['Director Area']) !== 'daniel santos');
  drawChart('higienesChart','bar',
    hig.map(r=>r['Director Area']),
    [{label:'% pendientes higienizar', data:hig.map(r=>pctNumber(r['% COOLER PENDIENTES HIGIENIZAR']))}],
    {scales:{y:{ticks:{callback:v=>v+'%'}}}}
  );
  const desc = (data.descuadres || []).filter(r=>r['0 M Almacenes.Responsable_Logistica'] && cleanName(r['0 M Almacenes.Responsable_Logistica']) !== 'total');
  drawChart('descuadresChart','bar',
    desc.map(r=>String(r['0 M Almacenes.Responsable_Logistica']).replace('⊞','').trim()),
    [{label:'% descuadres', data:desc.map(r=>pctNumber(r['% Descuadres']))}],
    {scales:{y:{ticks:{callback:v=>v+'%'}}}}
  );
}

function renderCafe(data){
  const cafe = getCafeDelegaciones();
  drawChart('cafeChart','bar',
    cafe.map(r=>r.delegacion),
    [
      {label:'Semana 1', data:cafe.map(r=>pctNumber(r.semana1))},
      {label:'Semana 2', data:cafe.map(r=>pctNumber(r.semana2))},
      {label:'Semana 3', data:cafe.map(r=>pctNumber(r.semana3))},
      {label:'Objetivo', data:cafe.map(r=>pctNumber(r.objetivo)), type:'line'}
    ],
    {scales:{y:{ticks:{callback:v=>v+'%'}}}}
  );
  const andalucia = (data.andalucia || []).filter(r=>r['Delegación']).slice(0,16);
  document.getElementById('rankingAndalucia').innerHTML = `<div class="list">${
    andalucia.map((r,i)=>{
      const st = semaforo('cafe', r['Índice de Penetración  %']);
      return `<div class="list-row"><div><strong>${i+1}. ${r['Delegación']}</strong></div><b>${fmtPct(r['Índice de Penetración  %'])}</b><span class="status ${st}">${labelStatus(st)}</span></div>`;
    }).join('')
  }</div>`;
}

function buildDetailRows(data){
  const rows=[];
  (data.incidencias_rutas||[]).forEach(r=>{
    const st=semaforo('incidencia', r['% incidencia']);
    rows.push(['Incidencias', `${r['Delegación']} · Ruta ${r['Ruta']}`, '% incidencia', fmtPct(r['% incidencia']), st, st==='red'?'Revisar ruta, llamadas y causas de entrega':'Mantener seguimiento']);
  });
  (data.higienes||[]).filter(r=>r['Director Area']).forEach(r=>{
    const st=semaforo('higiene', r['% COOLER PENDIENTES HIGIENIZAR']);
    rows.push(['Higienes', r['Director Area'], '% pendiente higienizar', fmtPct(r['% COOLER PENDIENTES HIGIENIZAR']), st, st==='red'?'Plan semanal de recuperación de higienes':'Control diario']);
  });
  getCafeDelegaciones().forEach(r=>{
    const st=semaforo('cafe', r.semana3);
    rows.push(['Café', r.delegacion, 'Real café semana 3', fmtPct(r.semana3), st, st==='red'?'Acción comercial por ruta y seguimiento diario':'Refuerzo positivo']);
  });
  return rows;
}
function renderTable(){
  const q = cleanName(document.getElementById('searchBox').value);
  const tbody = document.querySelector('#detailTable tbody');
  tbody.innerHTML = detailRows.filter(r=>cleanName(r.join(' ')).includes(q)).map(r=>`
    <tr>
      <td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td><strong>${r[3]}</strong></td>
      <td><span class="status ${r[4]}"><i class="dot ${r[4]}"></i>${labelStatus(r[4])}</span></td>
      <td>${r[5]}</td>
    </tr>`).join('');
}

function render(data){
  const d = filtered(data);
  renderKpis(d); renderIncidencias(d); renderAvisos(d); renderHigienes(d); renderCafe(d);
  detailRows = buildDetailRows(d); renderTable();
}

let rawData;
fetchData().then(data=>{
  rawData=data;
  document.getElementById('lastUpdate').textContent = `Última carga: ${new Date().toLocaleString('es-ES')}`;
  render(rawData);
});
document.getElementById('delegationFilter').addEventListener('change',()=>render(rawData));
document.getElementById('searchBox').addEventListener('input',renderTable);
