import './styles.css';
import { gsap } from 'gsap';
import { GENES, GENE_ORDER, INTERGENIC, lerp, val } from './data.js';
import { createNucleusScene } from './scene-nucleus.js';
import { createChromatinScene } from './scene-chromatin.js';
import { createHelixScene } from './scene-helix.js';

const round = n => Math.round(n);

let selectedGene = 'SIRT1';
let currentT = 0;

// ---------- gene chips ----------
const picker = document.getElementById('genePicker');
GENE_ORDER.forEach(g=>{
  const b = document.createElement('button');
  b.className = 'chip'; b.type = 'button'; b.dataset.gene = g;
  b.setAttribute('aria-pressed', g===selectedGene ? 'true':'false');
  b.innerHTML = g + '<span class="dir">' + (GENES[g].dir==='up' ? '↑' : '↓') + '</span>';
  b.addEventListener('click', ()=>{ selectedGene = g; refreshChips(); update(true); });
  picker.appendChild(b);
});
function refreshChips(){
  picker.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed', c.dataset.gene===selectedGene ? 'true':'false'));
}

// ---------- three.js scenes ----------
const nucleusScene = createNucleusScene(document.getElementById('nucleusStage'));
const chromatinScene = createChromatinScene(document.getElementById('chromatinStage'));
const helixScene = createHelixScene(document.getElementById('helixStage'));

// ---------- expression bars (SVG) ----------
const exprG = document.getElementById('exprBars');
const upGenes = GENE_ORDER.filter(g=>GENES[g].dir==='up');
const downGenes = GENE_ORDER.filter(g=>GENES[g].dir==='down');
const X0 = 230, X1 = 830, ROW_H = 40;
const barMeta = {};
function ns(tag){ return document.createElementNS('http://www.w3.org/2000/svg', tag); }
function buildBarRow(g, y){
  const color = GENES[g].dir==='up' ? 'var(--up)' : 'var(--down)';
  const label = ns('text');
  label.setAttribute('x','0'); label.setAttribute('y', y+5);
  label.setAttribute('font-family','var(--mono)'); label.setAttribute('font-size','13'); label.setAttribute('font-weight','700');
  label.setAttribute('font-style','italic'); label.setAttribute('fill','var(--ink)');
  label.textContent = g;
  exprG.appendChild(label);

  const role = ns('text');
  role.setAttribute('x','0'); role.setAttribute('y', y+20);
  role.setAttribute('font-family','var(--sans)'); role.setAttribute('font-size','10.5'); role.setAttribute('fill','var(--ink-faint)');
  role.textContent = GENES[g].role;
  exprG.appendChild(role);

  const track = ns('line');
  track.setAttribute('x1',X0); track.setAttribute('x2',X1); track.setAttribute('y1',y); track.setAttribute('y2',y);
  track.setAttribute('stroke','var(--grid)'); track.setAttribute('stroke-width','10'); track.setAttribute('stroke-linecap','round');
  exprG.appendChild(track);

  const bar = ns('line');
  bar.setAttribute('x1',X0); bar.setAttribute('x2',X0); bar.setAttribute('y1',y); bar.setAttribute('y2',y);
  bar.setAttribute('stroke',color); bar.setAttribute('stroke-width','10'); bar.setAttribute('stroke-linecap','round');
  exprG.appendChild(bar);

  const fedX = X0 + (X1-X0)*(GENES[g].expr[0]/100);
  const tick = ns('line');
  tick.setAttribute('x1',fedX); tick.setAttribute('x2',fedX); tick.setAttribute('y1',y-9); tick.setAttribute('y2',y+9);
  tick.setAttribute('stroke','var(--ink-faint)'); tick.setAttribute('stroke-width','2');
  exprG.appendChild(tick);

  const valText = ns('text');
  valText.setAttribute('y', y+5); valText.setAttribute('font-family','var(--mono)'); valText.setAttribute('font-size','12'); valText.setAttribute('font-weight','700'); valText.setAttribute('fill','var(--ink)');
  exprG.appendChild(valText);

  barMeta[g] = { bar, valText, proxy:{ v: GENES[g].expr[0] } };
}
upGenes.forEach((g,i)=>buildBarRow(g, 30 + i*ROW_H));
downGenes.forEach((g,i)=>buildBarRow(g, 206 + i*ROW_H));

function updateBar(g, t, animate){
  const target = val(g,'expr',t);
  const m = barMeta[g];
  const apply = () => {
    const x = X0 + (X1-X0)*(m.proxy.v/100);
    m.bar.setAttribute('x2', x);
    m.valText.setAttribute('x', x+10);
    m.valText.textContent = round(m.proxy.v);
  };
  if(animate){
    gsap.to(m.proxy, { v: target, duration:0.5, ease:'power2.out', onUpdate: apply });
  } else {
    m.proxy.v = target; apply();
  }
}

// ---------- phenotype gauges (SVG) ----------
const gaugeDefs = [
  { id:'autophagy', label:'Autophagy & proteostasis', sub:'ATG7, FOXO3', get:t=>(val('ATG7','expr',t)+val('FOXO3','expr',t))/2, dir:'up' },
  { id:'mito', label:'Mitochondrial biogenesis', sub:'PPARGC1A', get:t=>val('PPARGC1A','expr',t), dir:'up' },
  { id:'insulin', label:'Insulin sensitivity', sub:'SIRT1, PGC-1α, ↓S6K1', get:t=>(val('SIRT1','expr',t)+val('PPARGC1A','expr',t)+(100-val('RPS6KB1','expr',t)))/3, dir:'up' },
  { id:'inflam', label:'Inflammatory tone', sub:'IL6', get:t=>val('IL6','expr',t), dir:'down' },
  { id:'growth', label:'Anabolic / mTOR growth signaling', sub:'RPS6KB1', get:t=>val('RPS6KB1','expr',t), dir:'down' }
];
const gaugeG = document.getElementById('gauges');
const convergeG = document.getElementById('convergeLines');
const GX0=200, GX1=640, GY0=20, GROW=68;
const gaugeMeta = {};
gaugeDefs.forEach((d,i)=>{
  const y = GY0 + i*GROW;
  const color = d.dir==='up' ? 'var(--up)' : 'var(--down)';
  const label = ns('text');
  label.setAttribute('x','0'); label.setAttribute('y', y+2); label.setAttribute('font-size','13'); label.setAttribute('font-weight','700'); label.setAttribute('fill','var(--ink)');
  label.textContent = d.label;
  gaugeG.appendChild(label);
  const sub = ns('text');
  sub.setAttribute('x','0'); sub.setAttribute('y', y+16); sub.setAttribute('font-size','10.5'); sub.setAttribute('fill','var(--ink-faint)'); sub.setAttribute('font-family','var(--mono)');
  sub.textContent = d.sub;
  gaugeG.appendChild(sub);
  const track = ns('line');
  track.setAttribute('x1',GX0); track.setAttribute('x2',GX1); track.setAttribute('y1',y+26); track.setAttribute('y2',y+26);
  track.setAttribute('stroke','var(--grid)'); track.setAttribute('stroke-width','8'); track.setAttribute('stroke-linecap','round');
  gaugeG.appendChild(track);
  const bar = ns('line');
  bar.setAttribute('x1',GX0); bar.setAttribute('x2',GX0); bar.setAttribute('y1',y+26); bar.setAttribute('y2',y+26);
  bar.setAttribute('stroke',color); bar.setAttribute('stroke-width','8'); bar.setAttribute('stroke-linecap','round');
  gaugeG.appendChild(bar);
  const valText = ns('text');
  valText.setAttribute('y', y+30); valText.setAttribute('font-family','var(--mono)'); valText.setAttribute('font-size','12'); valText.setAttribute('font-weight','700'); valText.setAttribute('fill','var(--ink)');
  gaugeG.appendChild(valText);

  const conv = ns('line');
  conv.setAttribute('x1', GX1+10); conv.setAttribute('y1', y+26);
  conv.setAttribute('x2', 700); conv.setAttribute('y2', 205);
  conv.setAttribute('stroke','var(--ink-faint)'); conv.setAttribute('stroke-width','1'); conv.setAttribute('opacity','.45');
  convergeG.appendChild(conv);

  gaugeMeta[d.id] = { bar, valText, def:d, proxy:{ v:0 } };
});

function updateGauge(d, t, animate){
  const target = d.get(t);
  const m = gaugeMeta[d.id];
  const apply = () => {
    const x = GX0 + (GX1-GX0)*(m.proxy.v/100);
    m.bar.setAttribute('x2', x);
    m.valText.setAttribute('x', x+10);
    m.valText.textContent = round(m.proxy.v);
  };
  if(animate){
    gsap.to(m.proxy, { v: target, duration:0.5, ease:'power2.out', onUpdate: apply });
  } else {
    m.proxy.v = target; apply();
  }
}

// ---------- stage label ----------
function stageName(t){
  if(t<17) return 'Fed state';
  if(t<50) return 'Early fast · ~6–12h post-meal';
  if(t<83) return 'Fasting · ~16–24h';
  return 'Extended fast · ~36–48h+ (autophagy-dominant)';
}

// ---------- master update ----------
function update(animate){
  const t = currentT;
  document.getElementById('stageName').textContent = stageName(t);

  const compA = val(selectedGene,'compA',t);
  const loop = val(selectedGene,'loop',t);
  const dir = GENES[selectedGene].dir;
  nucleusScene.setState({ gene:selectedGene, compA, loop, dir, animate });
  document.getElementById('nucleusCaption').innerHTML =
    '<b>'+selectedGene+'</b> — ' + GENES[selectedGene].role + '. At this state its locus sits ' +
    (compA>=55 ? 'toward the nuclear <b>interior</b> (A compartment)' : compA<=45 ? 'toward the nuclear <b>periphery</b> (B compartment)' : 'near the A/B boundary') +
    ', with enhancer–promoter loop contact at ' + round(loop) + '%.';
  document.getElementById('loopStrengthVal').textContent = round(loop) + '%';
  document.getElementById('compartmentVal').textContent = round(compA) + (compA>=50 ? ' (A)' : ' (B)');

  const access = val(selectedGene,'access',t);
  const actLevel = (val(selectedGene,'k4',t)+val(selectedGene,'k27ac',t))/2;
  const repLevel = (val(selectedGene,'k9',t)+val(selectedGene,'k27me3',t))/2;
  chromatinScene.setState({ access, actLevel, repLevel, dir, animate });

  setBarReadout('barK4', val(selectedGene,'k4',t), animate);
  setBarReadout('barK27ac', val(selectedGene,'k27ac',t), animate);
  setBarReadout('barK9', val(selectedGene,'k9',t), animate);
  setBarReadout('barK27me3', val(selectedGene,'k27me3',t), animate);

  const inter = lerp(INTERGENIC,t), shore = val(selectedGene,'shoreMeth',t), island = val(selectedGene,'islandMeth',t), body = val(selectedGene,'bodyMeth',t);
  helixScene.setState({ inter, shore, island, body, animate });
  document.getElementById('interPct').textContent = round(inter)+'%';
  document.getElementById('shorePct').textContent = round(shore)+'%';
  document.getElementById('islandPct').textContent = round(island)+'%';
  document.getElementById('bodyPct').textContent = round(body)+'%';

  GENE_ORDER.forEach(g=>updateBar(g,t,animate));
  gaugeDefs.forEach(d=>updateGauge(d,t,animate));
}

const barProxies = {};
function setBarReadout(id, v, animate){
  if(!barProxies[id]) barProxies[id] = { v: 0 };
  const el = document.getElementById(id);
  const x1 = 120, x2 = 500;
  const apply = () => {
    el.setAttribute('x2', x1 + (x2-x1)*(barProxies[id].v/100));
    document.getElementById(id+'Val').textContent = round(barProxies[id].v);
  };
  if(animate){
    gsap.to(barProxies[id], { v, duration:0.5, ease:'power2.out', onUpdate: apply });
  } else {
    barProxies[id].v = v; apply();
  }
}

const slider = document.getElementById('fastSlider');
slider.addEventListener('input', ()=>{ currentT = Number(slider.value); update(true); });
refreshChips();
update(false);
