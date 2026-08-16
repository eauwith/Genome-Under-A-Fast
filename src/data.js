// enhMeth is tracked separately from shoreMeth: enhancer methylation is the
// dynamic, cell-state-specific signal that tracks enhancer activity, whereas a
// CpG shore is defined by its position relative to an island.
export const GENES = {
  SIRT1:    { role:"NAD⁺-dependent deacetylase — metabolic sensor", dir:"up",
              expr:[45,78], shoreMeth:[52,34], islandMeth:[3,3], bodyMeth:[55,64], enhMeth:[58,30],
              k4:[40,68], k27ac:[35,70], k9:[30,12], k27me3:[25,15],
              access:[40,75], compA:[35,72], loop:[20,65] },
  FOXO3:    { role:"Stress-response transcription factor", dir:"up",
              expr:[38,72], shoreMeth:[48,28], islandMeth:[2,2], bodyMeth:[50,60], enhMeth:[55,26],
              k4:[42,66], k27ac:[33,62], k9:[28,14], k27me3:[30,18],
              access:[38,70], compA:[40,68], loop:[22,58] },
  PPARGC1A: { role:"PGC-1α — mitochondrial biogenesis master regulator", dir:"up",
              expr:[30,85], shoreMeth:[60,25], islandMeth:[4,4], bodyMeth:[48,66], enhMeth:[65,22],
              k4:[35,80], k27ac:[30,78], k9:[35,10], k27me3:[28,12],
              access:[32,82], compA:[35,80], loop:[18,72] },
  ATG7:     { role:"Autophagosome formation enzyme", dir:"up",
              expr:[25,80], shoreMeth:[55,30], islandMeth:[3,3], bodyMeth:[46,62], enhMeth:[60,25],
              k4:[30,74], k27ac:[28,65], k9:[40,15], k27me3:[32,14],
              access:[30,76], compA:[32,70], loop:[15,60] },
  RPS6KB1:  { role:"S6K1 — mTOR-driven growth & ribosome biogenesis", dir:"down",
              expr:[78,30], shoreMeth:[25,42], islandMeth:[2,2], bodyMeth:[62,50], enhMeth:[28,50],
              k4:[65,30], k27ac:[60,22], k9:[15,38], k27me3:[20,48],
              access:[68,28], compA:[70,38], loop:[55,20] },
  IL6:      { role:"Pro-inflammatory cytokine", dir:"down",
              expr:[60,20], shoreMeth:[30,48], islandMeth:[5,5], bodyMeth:[58,44], enhMeth:[32,55],
              k4:[55,25], k27ac:[58,20], k9:[20,42], k27me3:[22,40],
              access:[55,22], compA:[60,32], loop:[45,18] }
};
export const GENE_ORDER = ["SIRT1","FOXO3","PPARGC1A","ATG7","RPS6KB1","IL6"];
export const INTERGENIC = [80,76];

export const lerp = (pair,t) => pair[0] + (pair[1]-pair[0]) * (t/100);
export const val = (gene,key,t) => lerp(GENES[gene][key], t);

export function seededShuffle(n, seed){
  let arr = Array.from({length:n},(_,i)=>i), s = seed;
  const rand = () => { s = (s*1103515245 + 12345) & 0x7fffffff; return (s/0x7fffffff); };
  for(let i=n-1;i>0;i--){ const j = Math.floor(rand()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  const order = new Array(n); arr.forEach((v,i)=>order[v]=i);
  return order;
}
