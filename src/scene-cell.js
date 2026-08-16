import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { gsap } from 'gsap';
import { getPalette } from './theme.js';
import { attachSway } from './sway.js';
import { gateZoomBehindModifier } from './zoom-gate.js';
import { configureRenderer, environmentFor, organicGeometry, membraneMaterial, tissueMaterial, fitCameraToRadius } from './render-quality.js';

const CELL_R = 3.5;

// Deterministic placement so the cell looks the same on every load.
function rng(seed){
  let s = seed;
  return () => { s = (s*1103515245 + 12345) & 0x7fffffff; return s/0x7fffffff; };
}

// A point inside the cytoplasm — outside the nucleus, inside the membrane.
function cytoPoint(rand, nucleusCenter, nucleusR, minR, maxR){
  for(let i=0;i<60;i++){
    const u = rand()*2-1, t = rand()*Math.PI*2;
    const r = minR + rand()*(maxR-minR);
    const s = Math.sqrt(1-u*u);
    const p = new THREE.Vector3(s*Math.cos(t)*r, u*r*0.72, s*Math.sin(t)*r);
    if(p.distanceTo(nucleusCenter) > nucleusR + 0.28) return p;
  }
  return new THREE.Vector3(maxR*0.8, 0, 0);
}

export function createCellScene(container){
  const pal = getPalette();
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(0, 2.6, 12.5);

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  configureRenderer(renderer);
  scene.environment = environmentFor(renderer);
  renderer.domElement.style.position='absolute'; renderer.domElement.style.inset='0';
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position='absolute';
  labelRenderer.domElement.style.inset='0';
  labelRenderer.domElement.style.pointerEvents='none';
  container.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  renderer.domElement.style.touchAction = 'pan-y';
  gateZoomBehindModifier(controls, renderer.domElement);
  let autoFit = true;
  controls.addEventListener('start', () => { autoFit = false; });
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 7; controls.maxDistance = 20;
  controls.minPolarAngle = Math.PI*0.24; controls.maxPolarAngle = Math.PI*0.7;
  controls.enablePan = false;

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(5,7,6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4); fill.position.set(-6,-2,3); scene.add(fill);
  const rim = new THREE.PointLight(0xffffff, 0.5); rim.position.set(-4,3,-6); scene.add(rim);

  const rand = rng(20260815);
  const labelFor = (obj, text, cls, offsetY) => {
    const el = document.createElement('div');
    el.className = 'gl-label ' + (cls || 'gl-organelle-label');
    el.textContent = text;
    const o = new CSS2DObject(el);
    o.position.set(0, offsetY ?? 0.5, 0);
    obj.add(o);
    return el;
  };

  // ---------- plasma membrane ----------
  const membrane = new THREE.Mesh(
    organicGeometry(CELL_R, { detail: 5, amp: 0.06, freq: 0.9, seed: 3 }),
    membraneMaterial(pal.inkFaint, { opacity: 0.12, roughness: 0.09 })
  );
  membrane.scale.set(1, 0.78, 1);
  world.add(membrane);
  // Sits below the cell: the crowded half of the frame is the top, where the
  // nucleus and autophagosome labels live.
  labelFor(membrane, 'Plasma membrane', 'gl-organelle-label', -(CELL_R*0.78 + 0.3));

  // ---------- nucleus + nucleolus + pores ----------
  const NUC_C = new THREE.Vector3(-0.9, 0.15, -0.2);
  const NUC_R = 1.45;
  const nucleus = new THREE.Mesh(
    organicGeometry(NUC_R, { detail: 5, amp: 0.05, freq: 1.2, seed: 17 }),
    membraneMaterial(pal.down, { opacity: 0.26, roughness: 0.14 })
  );
  nucleus.position.copy(NUC_C);
  world.add(nucleus);
  labelFor(nucleus, 'Nucleus', 'gl-organelle-label gl-organelle-label--key', NUC_R + 0.42);

  const nucleolus = new THREE.Mesh(
    organicGeometry(0.46, { detail: 4, amp: 0.14, freq: 2.0, seed: 61 }),
    tissueMaterial(pal.down, { roughness: 0.5 })
  );
  nucleolus.position.set(0.25, -0.15, 0.1);
  nucleus.add(nucleolus);

  // nuclear pores studded around the envelope
  const poreGeo = new THREE.TorusGeometry(0.085, 0.032, 8, 16);
  const poreMat = tissueMaterial(pal.inkDim, { roughness: 0.45 });
  for(let i=0;i<26;i++){
    const u = rand()*2-1, t = rand()*Math.PI*2, s = Math.sqrt(1-u*u);
    const dir = new THREE.Vector3(s*Math.cos(t), u, s*Math.sin(t));
    const pore = new THREE.Mesh(poreGeo, poreMat);
    pore.position.copy(dir).multiplyScalar(NUC_R*0.99);
    pore.lookAt(dir.clone().multiplyScalar(NUC_R*2));
    nucleus.add(pore);
  }

  // ---------- rough ER (folded sheets hugging the nucleus) + ribosomes ----------
  const erGroup = new THREE.Group();
  erGroup.position.copy(NUC_C);
  world.add(erGroup);
  const erMat = tissueMaterial(pal.up, { roughness: 0.5, opacity: 0.9 });
  const ribosomeGeo = new THREE.SphereGeometry(0.05, 8, 6);
  const ribosomeMat = tissueMaterial(pal.ink, { roughness: 0.6 });
  const ribosomes = [];
  // Radii are measured from the nucleus, which is offset from the cell centre —
  // so the outermost sheet must stay inside CELL_R minus that offset.
  for(let sheet=0; sheet<5; sheet++){
    const rr = NUC_R + 0.30 + sheet*0.12;
    const phi = -0.5 + sheet*0.26;
    const arc = 1.5 + rand()*0.7;
    const start = rand()*Math.PI*2;
    const pts = [];
    for(let i=0;i<=26;i++){
      const a = start + (i/26)*arc;
      const wobble = Math.sin(i*0.9 + sheet)*0.1;
      pts.push(new THREE.Vector3(
        Math.cos(a)*(rr+wobble),
        phi + Math.sin(i*0.55 + sheet)*0.16,
        Math.sin(a)*(rr+wobble)
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const sheetMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.058, 10, false), erMat);
    sheetMesh.scale.y = 2.2; // flatten the tube into a ribbon-like cisterna
    erGroup.add(sheetMesh);

    for(let i=0;i<9;i++){
      const p = curve.getPoint(rand());
      const rib = new THREE.Mesh(ribosomeGeo, ribosomeMat);
      rib.position.copy(p).setY(p.y*2.2 + (rand()-0.5)*0.12);
      erGroup.add(rib);
      ribosomes.push(rib);
    }
  }
  // Labels are placed around a clock face so they don't pile up on each other:
  // ER at 9 o'clock, mitochondria at 1, Golgi at 3, lysosomes at 7, lipids at 5.
  const erLabelAnchor = new THREE.Object3D();
  erLabelAnchor.position.set(-1.75, -0.15, 1.0);
  erGroup.add(erLabelAnchor);
  labelFor(erLabelAnchor, 'Rough ER + ribosomes', 'gl-organelle-label', 0);

  // ---------- Golgi apparatus (stacked cisternae) ----------
  const golgi = new THREE.Group();
  golgi.position.set(2.35, -0.35, 0.7);
  golgi.rotation.set(0.3, -0.5, 0.35);
  world.add(golgi);
  const golgiMat = tissueMaterial(pal.methyl, { roughness: 0.45 });
  for(let i=0;i<5;i++){
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.42 - i*0.045, 0.055, 10, 40, Math.PI*1.25), golgiMat);
    c.position.y = i*0.14;
    c.rotation.x = Math.PI/2;
    c.scale.set(1, 1, 0.45);
    golgi.add(c);
  }
  labelFor(golgi, 'Golgi apparatus', 'gl-organelle-label', 0.95);

  // ---------- mitochondria (respond to PGC-1α) ----------
  const mitoMat = tissueMaterial(pal.up, { roughness: 0.38 });
  const cristaeMat = tissueMaterial(pal.up, { roughness: 0.6, emissive: pal.up, emissiveIntensity: 0.12 });
  const MAX_MITO = 12;
  const mitochondria = [];
  for(let i=0;i<MAX_MITO;i++){
    const g = new THREE.Group();
    g.position.copy(cytoPoint(rand, NUC_C, NUC_R, 1.9, CELL_R*0.82));
    g.position.y *= 0.72;
    g.rotation.set(rand()*Math.PI, rand()*Math.PI, rand()*Math.PI);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 8, 20), mitoMat);
    g.add(body);
    // cristae: internal folds, hinted as stacked discs
    for(let c=0;c<4;c++){
      const cr = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 14), cristaeMat);
      cr.position.y = -0.16 + c*0.11;
      cr.rotation.x = Math.PI/2;
      g.add(cr);
    }
    world.add(g);
    mitochondria.push({ group:g, body });
  }
  // The labelled instance gets a fixed slot (and is always the first shown), so
  // its label lands in a predictable place instead of wherever the RNG put it.
  mitochondria[0].group.position.set(2.35, 0.55, 0.6);
  labelFor(mitochondria[0].group, 'Mitochondria', 'gl-organelle-label gl-organelle-label--key', 0.62);

  // ---------- lysosomes ----------
  const lysoMat = tissueMaterial(pal.methyl, { roughness: 0.35 });
  const MAX_LYSO = 9;
  const lysosomes = [];
  for(let i=0;i<MAX_LYSO;i++){
    const m = new THREE.Mesh(organicGeometry(0.17, { detail:3, amp:0.12, freq:2.4, seed:100+i*7 }), lysoMat);
    m.position.copy(cytoPoint(rand, NUC_C, NUC_R, 1.8, CELL_R*0.78));
    m.position.y *= 0.7;
    world.add(m);
    lysosomes.push(m);
  }
  lysosomes[0].position.set(-1.95, -1.5, 0.9);
  labelFor(lysosomes[0], 'Lysosomes', 'gl-organelle-label', 0.44);

  // ---------- autophagosomes (double membrane; the fasting hallmark) ----------
  const MAX_AUTO = 7;
  const autophagosomes = [];
  const autoInnerMat = tissueMaterial(pal.up, { roughness: 0.5, opacity: 0.85 });
  for(let i=0;i<MAX_AUTO;i++){
    const g = new THREE.Group();
    g.position.copy(cytoPoint(rand, NUC_C, NUC_R, 2.0, CELL_R*0.8));
    g.position.y *= 0.7;
    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 32, 24),
      membraneMaterial(pal.up, { opacity: 0.34, roughness: 0.14 })
    );
    const inner = new THREE.Mesh(organicGeometry(0.17, { detail:3, amp:0.2, freq:2.6, seed:200+i*13 }), autoInnerMat);
    g.add(outer, inner);
    g.scale.setScalar(0.001);
    world.add(g);
    autophagosomes.push(g);
  }
  autophagosomes[0].position.set(0.75, 1.85, 1.0);
  const autoLabelEl = labelFor(autophagosomes[0], 'Autophagosomes', 'gl-organelle-label gl-organelle-label--key', 0.66);

  // ---------- lipid droplets (consumed during the fast) ----------
  const lipidMat = tissueMaterial(pal.surface2, { roughness: 0.16 });
  const lipids = [];
  for(let i=0;i<5;i++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 24), lipidMat);
    m.position.copy(cytoPoint(rand, NUC_C, NUC_R, 1.9, CELL_R*0.75));
    m.position.y *= 0.7;
    world.add(m);
    lipids.push(m);
  }
  lipids[0].position.set(1.45, -1.7, 1.1);
  labelFor(lipids[0], 'Lipid droplets', 'gl-organelle-label', 0.55);

  // ---------- resize / render ----------
  function resize(){
    const w = container.clientWidth, h = container.clientHeight;
    if(!w || !h) return;
    camera.aspect = w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h); labelRenderer.setSize(w,h);
    if(autoFit) fitCameraToRadius(camera, controls, 3.95);
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  let raf;
  (function tick(){
    raf = requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  })();

  attachSway(world, controls, { amplitude: 0.11, duration: 11 });

  // ---------- state ----------
  const anim = { mito:0, auto:0, lyso:0, lipid:1, ribo:1 };

  function applyState(){
    // Mitochondrial mass: more of them, and elongated (fusion) as PGC-1α rises.
    const mitoShown = 3 + anim.mito * (MAX_MITO - 3);
    mitochondria.forEach((m,i)=>{
      const on = i < mitoShown;
      const frac = THREE.MathUtils.clamp(mitoShown - i, 0, 1);
      m.group.visible = on;
      const s = 0.7 + anim.mito*0.35;
      m.group.scale.set(s, s*(0.85 + anim.mito*0.5), s);
      m.group.scale.multiplyScalar(on ? frac : 0);
    });

    const autoShown = anim.auto * MAX_AUTO;
    autophagosomes.forEach((g,i)=>{
      const frac = THREE.MathUtils.clamp(autoShown - i, 0, 1);
      g.visible = frac > 0.01;
      g.scale.setScalar(Math.max(frac, 0.001));
    });
    autoLabelEl.style.opacity = anim.auto > 0.12 ? '1' : '0';

    const lysoShown = 2 + anim.lyso * (MAX_LYSO - 2);
    lysosomes.forEach((m,i)=>{
      const frac = THREE.MathUtils.clamp(lysoShown - i, 0, 1);
      m.visible = frac > 0.01;
      m.scale.setScalar(Math.max(frac, 0.001));
    });

    lipids.forEach(m => m.scale.setScalar(Math.max(anim.lipid, 0.05)));
    ribosomes.forEach((r,i) => {
      const shown = anim.ribo * ribosomes.length;
      r.visible = i < shown;
    });
  }

  // Returns the resulting counts so the readout beside the scene can't drift
  // out of sync with what is actually rendered.
  function setState({ mito, auto, lyso, lipid, ribo, animate = true }){
    const target = { mito, auto, lyso, lipid, ribo };
    if(animate){
      gsap.to(anim, { ...target, duration: 0.75, ease:'power2.out', onUpdate: applyState });
    } else {
      Object.assign(anim, target);
      applyState();
    }
    return {
      mitoCount: Math.round(3 + mito*(MAX_MITO - 3)),
      autoCount: Math.round(auto * MAX_AUTO),
      lysoCount: Math.round(2 + lyso*(MAX_LYSO - 2)),
      lipidPct: Math.round(lipid * 100),
      riboPct: Math.round(ribo * 100)
    };
  }
  setState({ mito:0.1, auto:0, lyso:0.15, lipid:1, ribo:1, animate:false });

  return {
    setState,
    dispose(){ cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); container.innerHTML=''; }
  };
}
