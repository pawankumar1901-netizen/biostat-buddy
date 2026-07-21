import { useState } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, CartesianGrid, Legend
} from "recharts";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#0D1117", surface:"#161B22", card:"#1C2333", border:"#30363D",
  accent:"#58A6FF", green:"#3FB950", yellow:"#E3B341", red:"#F85149",
  purple:"#BC8CFF", orange:"#F0883E", text:"#E6EDF3", muted:"#8B949E",
};
const COLORS = ["#58A6FF","#3FB950","#E3B341","#BC8CFF","#F85149","#79C0FF","#56D364","#F0883E"];

// ── Math utilities ────────────────────────────────────────────────────────────
const mean = a => a.length===0?0:a.reduce((s,v)=>s+v,0)/a.length;
const variance = a => a.length<2?0:( (m=>a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1))(mean(a)) );
const sd = a => a.length<2?0:Math.sqrt(variance(a));
const median = a => { if(a.length===0) return 0; const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };

// Special functions
function gamma(n) {
  if(n<0.5) return Math.PI/(Math.sin(Math.PI*n)*gamma(1-n));
  n--;
  const g=7,p=[0.99999999999980993,676.5203681218851,-1259.1392167224028,
    771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,
    9.9843695780195716e-6,1.5056327351493116e-7];
  let x=p[0]; for(let i=1;i<g+2;i++) x+=p[i]/(n+i);
  const t=n+g+0.5;
  return Math.sqrt(2*Math.PI)*Math.pow(t,n+0.5)*Math.exp(-t)*x;
}
const lgamma = x => Math.log(Math.abs(gamma(x)));

function betaCF(a,b,x) {
  let aa,del,h,qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;
  if(Math.abs(d)<1e-30)d=1e-30; d=1/d; h=d;
  for(let m=1;m<=200;m++){
    let m2=2*m;
    aa=m*(b-m)*x/((qam+m2)*(a+m2)); d=1+aa*d;
    if(Math.abs(d)<1e-30)d=1e-30; c=1+aa/c;
    if(Math.abs(c)<1e-30)c=1e-30; d=1/d; h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2)); d=1+aa*d;
    if(Math.abs(d)<1e-30)d=1e-30; c=1+aa/c;
    if(Math.abs(c)<1e-30)c=1e-30; d=1/d; del=d*c; h*=del;
    if(Math.abs(del-1)<1e-10)break;
  }
  return h;
}
function incompleteBeta(a,b,x) {
  if(x<=0) return 0; if(x>=1) return 1;
  const lb=lgamma(a)+lgamma(b)-lgamma(a+b);
  const front=Math.exp(Math.log(x)*a+Math.log(1-x)*b-lb)/a;
  return front*betaCF(a,b,x);
}
function tCDF(t,df) { return 1-0.5*incompleteBeta(df/2,0.5,df/(df+t*t)); }
function chiCDF(x,k) {
  if(x<=0) return 0;
  function lowerIncGamma(a,x2){
    let sum=0,term=1/a;
    for(let i=0;i<200;i++){term*=x2/(a+i+1);sum+=term;if(term<1e-10)break;}
    return Math.exp(-x2+a*Math.log(x2))*sum;
  }
  return lowerIncGamma(k/2,x/2)/gamma(k/2);
}
function fCDF(x,d1,d2) {
  if(x<=0) return 0;
  return incompleteBeta(d1/2,d2/2,d1*x/(d1*x+d2));
}

// ── Descriptive ───────────────────────────────────────────────────────────────
function descriptiveStats(arr) {
  const n=arr.length,m=mean(arr);
  return { n,mean:m,median:median(arr),sd:sd(arr),min:Math.min(...arr),max:Math.max(...arr),
           se:sd(arr)/Math.sqrt(n),ci95:1.96*sd(arr)/Math.sqrt(n) };
}
function freqTable(data,col) {
  const f={}; data.forEach(r=>{ const v=r[col]; if(v!=null&&v!=="") f[v]=(f[v]||0)+1; });
  return Object.entries(f).map(([k,v])=>({name:k,count:v,pct:+(v/data.length*100).toFixed(1)}));
}

// ── Chi-square ────────────────────────────────────────────────────────────────
function chiSquare(data,varA,varB) {
  const cats=v=>[...new Set(data.map(r=>r[v]).filter(x=>x!=null&&x!==""))];
  const rowCats=cats(varA),colCats=cats(varB);
  const observed=rowCats.map(r=>colCats.map(c=>data.filter(d=>d[varA]===r&&d[varB]===c).length));
  const rowTotals=observed.map(r=>r.reduce((a,b)=>a+b,0));
  const colTotals=colCats.map((_,ci)=>observed.reduce((a,r)=>a+r[ci],0));
  const n=rowTotals.reduce((a,b)=>a+b,0);
  let chi2=0,df=(rowCats.length-1)*(colCats.length-1);
  if(df===0) throw new Error("Chi-square requires at least 2 categories in each variable.");
  if(rowCats.length<2||colCats.length<2) throw new Error("Each variable must have at least 2 categories.");
  observed.forEach((row,ri)=>row.forEach((obs,ci)=>{ const exp=(rowTotals[ri]*colTotals[ci])/n; if(exp>0) chi2+=(obs-exp)**2/exp; }));
  const smallCell=observed.flat().filter((_,idx)=>{const ri=Math.floor(idx/colCats.length),ci=idx%colCats.length;return (rowTotals[ri]*colTotals[ci]/n)<5;}).length;
  return { chi2:+chi2.toFixed(4),df,p:+(1-chiCDF(chi2,df)).toFixed(4),rowCats,colCats,observed,rowTotals,colTotals,n,smallCell };
}

// ── T-test (Welch) ────────────────────────────────────────────────────────────
function tTest(g1,g2) {
  if(g1.length<2) throw new Error("Group 1 has fewer than 2 observations.");
  if(g2.length<2) throw new Error("Group 2 has fewer than 2 observations.");
  const n1=g1.length,n2=g2.length,m1=mean(g1),m2=mean(g2),v1=variance(g1),v2=variance(g2);
  const pooled=v1/n1+v2/n2;
  if(pooled===0) throw new Error("Both groups have zero variance — cannot compute t-test.");
  const se=Math.sqrt(pooled),t=(m1-m2)/se;
  const dfNum=pooled**2, dfDen=(v1/n1)**2/(n1-1)+(v2/n2)**2/(n2-1);
  const df=dfDen===0?n1+n2-2:dfNum/dfDen;
  return { t:+t.toFixed(4),df:+df.toFixed(1),p:+(2*(1-tCDF(Math.abs(t),df))).toFixed(4),
           mean1:+m1.toFixed(3),mean2:+m2.toFixed(3),sd1:+sd(g1).toFixed(3),sd2:+sd(g2).toFixed(3),n1,n2 };
}

// ── Pearson correlation ───────────────────────────────────────────────────────
function pearson(x,y) {
  const mx=mean(x),my=mean(y);
  const num=x.reduce((a,xi,i)=>a+(xi-mx)*(y[i]-my),0);
  const den=Math.sqrt(x.reduce((a,xi)=>a+(xi-mx)**2,0)*y.reduce((a,yi)=>a+(yi-my)**2,0));
  if(den===0) throw new Error("One or both variables have zero variance — correlation undefined.");
  const r=Math.max(-1,Math.min(1,num/den)),n=x.length;
  if(n<3) throw new Error("Correlation requires at least 3 paired observations.");
  const t=Math.abs(r)>=1?Infinity:r*Math.sqrt((n-2)/(1-r**2));
  const p=Math.abs(r)>=1?0:+(2*(1-tCDF(Math.abs(t),n-2))).toFixed(4);
  return { r:+r.toFixed(4),r2:+(r**2).toFixed(4),p,n };
}

// ── One-Way ANOVA ─────────────────────────────────────────────────────────────
function oneWayAnova(data,outcomeVar,groupVar) {
  const groups=[...new Set(data.map(r=>r[groupVar]).filter(v=>v!=null&&v!==""))];
  const groupData=groups.map(g=>data.filter(r=>r[groupVar]===g).map(r=>+r[outcomeVar]).filter(v=>!isNaN(v)));
  if(groups.length<2) throw new Error("ANOVA requires at least 2 groups.");
  groupData.forEach((g,i)=>{ if(g.length<2) throw new Error(`Group "${groups[i]}" has fewer than 2 observations.`); });
  const allVals=groupData.flat(),N=allVals.length,k=groups.length;
  const grandMean=mean(allVals);
  const SSB=groupData.reduce((a,g)=>a+g.length*(mean(g)-grandMean)**2,0);
  const SSW=groupData.reduce((a,g)=>{ const gm=mean(g); return a+g.reduce((b,v)=>b+(v-gm)**2,0); },0);
  const dfB=k-1,dfW=N-k,MSB=SSB/dfB,MSW=SSW/dfW,F=MSB/MSW;
  const p=1-fCDF(F,dfB,dfW);
  const groupStats=groups.map((g,i)=>({
    group:g,n:groupData[i].length,mean:+mean(groupData[i]).toFixed(3),sd:+sd(groupData[i]).toFixed(3)
  }));
  // Pairwise post-hoc (Bonferroni)
  const pairs=[],numPairs=k*(k-1)/2;
  for(let i=0;i<k;i++) for(let j=i+1;j<k;j++){
    const r=tTest(groupData[i],groupData[j]);
    pairs.push({ pair:`${groups[i]} vs ${groups[j]}`,meanDiff:+(mean(groupData[i])-mean(groupData[j])).toFixed(3),
                 p_raw:r.p,p_bonf:+Math.min(r.p*numPairs,1).toFixed(4) });
  }
  return { type:"anova",F:+F.toFixed(4),dfB,dfW,p:+p.toFixed(4),SSB:+SSB.toFixed(3),SSW:+SSW.toFixed(3),
           MSB:+MSB.toFixed(3),MSW:+MSW.toFixed(3),groupStats,pairs,k,N,grandMean:+grandMean.toFixed(3) };
}

// ── Matrix utilities ──────────────────────────────────────────────────────────
function matMul(A,B) {
  const r=A.length,c=B[0].length,p=B.length;
  return Array.from({length:r},(_,i)=>Array.from({length:c},(_,j)=>
    Array.from({length:p},(_,k)=>A[i][k]*B[k][j]).reduce((a,b)=>a+b,0)));
}
function matT(A) { return A[0].map((_,j)=>A.map(r=>r[j])); }
function matInverse(A) {
  const n=A.length,aug=A.map((r,i)=>[...r,...Array.from({length:n},(_,j)=>i===j?1:0)]);
  for(let c=0;c<n;c++){
    let max=Math.abs(aug[c][c]),maxR=c;
    for(let r=c+1;r<n;r++) if(Math.abs(aug[r][c])>max){max=Math.abs(aug[r][c]);maxR=r;}
    [aug[c],aug[maxR]]=[aug[maxR],aug[c]];
    const div=aug[c][c]; if(Math.abs(div)<1e-12) throw new Error("Singular matrix");
    for(let j=0;j<2*n;j++) aug[c][j]/=div;
    for(let r=0;r<n;r++) if(r!==c){const f=aug[r][c];for(let j=0;j<2*n;j++)aug[r][j]-=f*aug[c][j];}
  }
  return aug.map(r=>r.slice(n));
}

// ── Logistic Regression (Newton-Raphson + delta-method unscaling) ─────────────
function sigmoid(z) { return 1/(1+Math.exp(-Math.max(-500,Math.min(500,z)))); }

function logisticRegression(X_raw,y,predNames) {
  const n=X_raw.length,p=X_raw[0].length;
  // Standardise
  const colMeans=Array.from({length:p},(_,j)=>mean(X_raw.map(r=>r[j])));
  const colSDs=Array.from({length:p},(_,j)=>{const s=sd(X_raw.map(r=>r[j]));return s<1e-10?1:s;});
  const Xs=X_raw.map(r=>[1,...r.map((v,j)=>(v-colMeans[j])/colSDs[j])]);

  // Newton-Raphson (max 150 iters)
  let theta=new Array(p+1).fill(0);
  for(let iter=0;iter<150;iter++){
    const probs=Xs.map(xi=>sigmoid(xi.reduce((a,v,j)=>a+v*theta[j],0)));
    const W=probs.map(pi=>pi*(1-pi));
    const XtW=matT(Xs).map(row=>row.map((v,i)=>v*W[i]));
    const H=matMul(XtW,Xs);
    const grad=Array.from({length:p+1},(_,j)=>Xs.reduce((a,xi,i)=>a+xi[j]*(probs[i]-y[i]),0));
    let Hinv; try{Hinv=matInverse(H);}catch(e){break;}
    const delta=Hinv.map(row=>row.reduce((a,v,j)=>a+v*grad[j],0));
    theta=theta.map((t,j)=>t-delta[j]);
    if(delta.reduce((a,v)=>a+v**2,0)<1e-12) break;
  }

  // Variance-covariance in standardised space
  const probs=Xs.map(xi=>sigmoid(xi.reduce((a,v,j)=>a+v*theta[j],0)));
  const W=probs.map(pi=>pi*(1-pi));
  const XtW=matT(Xs).map(row=>row.map((v,i)=>v*W[i]));
  let vcov_std; try{vcov_std=matInverse(matMul(XtW,Xs));}catch(e){vcov_std=null;}

  // Transformation matrix: beta_orig = T * theta_std
  // T[0][0]=1, T[0][j]=-mean[j-1]/sd[j-1] for j>0
  // T[i][i]=1/sd[i-1] for i>0, else 0
  const T=Array.from({length:p+1},(_,i)=>Array.from({length:p+1},(_,j)=>{
    if(i===0&&j===0) return 1;
    if(i===0&&j>0)   return -colMeans[j-1]/colSDs[j-1];
    if(i===j)        return 1/colSDs[i-1];
    return 0;
  }));
  const betaOrig=T.map(row=>row.reduce((a,v,j)=>a+v*theta[j],0));
  let vcov_orig=null;
  if(vcov_std) try{ vcov_orig=matMul(matMul(T,vcov_std),matT(T)); }catch(e){}

  // Log-likelihoods
  const ll=y.reduce((a,yi,i)=>a+yi*Math.log(Math.max(1e-15,probs[i]))+(1-yi)*Math.log(Math.max(1e-15,1-probs[i])),0);
  const p0=mean(y);
  const ll0=y.reduce((a,yi)=>a+yi*Math.log(Math.max(1e-15,p0))+(1-yi)*Math.log(Math.max(1e-15,1-p0)),0);
  const denom=1-Math.exp(2*ll0/n);
  const nagelkerke=denom===0?0:(1-Math.exp(2*(ll0-ll)/n))/denom;
  const hoslem=hosmerLemeshow(y,probs);

  const coefs=["Intercept",...predNames].map((name,i)=>{
    const b=betaOrig[i];
    const se_v=vcov_orig?Math.sqrt(Math.max(0,vcov_orig[i][i])):null;
    const wald=se_v?(b/se_v)**2:null;
    const pv=wald!=null?+(1-chiCDF(wald,1)).toFixed(4):null;
    return { name,beta:+b.toFixed(4),se:se_v?+se_v.toFixed(4):null,
             wald:wald?+wald.toFixed(3):null,p:pv,
             or:i>0?+Math.exp(b).toFixed(4):null,
             or_lo:i>0&&se_v?+Math.exp(b-1.96*se_v).toFixed(4):null,
             or_hi:i>0&&se_v?+Math.exp(b+1.96*se_v).toFixed(4):null };
  });

  // Predicted probabilities for ROC-like chart
  const predChart=y.map((yi,i)=>({actual:yi,prob:+probs[i].toFixed(3)}))
    .sort((a,b)=>a.prob-b.prob).map((d,i)=>({...d,rank:i+1}));

  return { type:"logistic",coefs,ll:+ll.toFixed(3),ll0:+ll0.toFixed(3),
           nagelkerke:+nagelkerke.toFixed(4),n,hoslem,predChart };
}

function hosmerLemeshow(y,probs) {
  const n=y.length;
  if(n<10) return { chi2:"N/A",df:8,p:"N/A",note:"n<10: H-L test not reliable" };
  const g=Math.min(10,Math.floor(n/5));
  const sorted=[...y.map((yi,i)=>({yi,pi:probs[i]}))].sort((a,b)=>a.pi-b.pi);
  const groupSize=Math.floor(n/g);
  let chi2=0,df=g-2;
  for(let i=0;i<g;i++){
    const grp=sorted.slice(i*groupSize,i===g-1?n:(i+1)*groupSize);
    if(grp.length===0) continue;
    const obs=grp.reduce((a,d)=>a+d.yi,0);
    const exp=grp.reduce((a,d)=>a+d.pi,0);
    const expNeg=grp.length-exp;
    const obsNeg=grp.filter(d=>d.yi===0).length;
    if(exp>0.5) chi2+=(obs-exp)**2/exp;
    if(expNeg>0.5) chi2+=(obsNeg-expNeg)**2/expNeg;
  }
  return { chi2:+chi2.toFixed(3),df,p:+(1-chiCDF(chi2,Math.max(1,df))).toFixed(4) };
}

// ── AI Interpretation ─────────────────────────────────────────────────────────
async function getInterpretation(testType,result,vars) {
  const res=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"claude-sonnet-4-6",max_tokens:1000,
      messages:[{role:"user",content:`You are a biostatistics teaching assistant for medical students.
Test: ${testType}
Variables: ${vars}
Result: ${JSON.stringify(result,null,2)}

Write a concise 3-part interpretation:
1. **Result**: Key statistic and p-value in one sentence.
2. **Meaning**: Plain medical English (1-2 sentences).
3. **Conclusion**: Statistical significance and implication for thesis writing (1-2 sentences, mention p<0.05 threshold). For logistic regression also mention OR and 95% CI of significant predictors.
Keep it short, suitable for MBBS intern or PG writing a thesis. Output in markdown.`}]
    })
  });
  const d=await res.json();
  return d.content?.[0]?.text||"Could not generate interpretation.";
}

// ── PDF Export ────────────────────────────────────────────────────────────────
function buildPDFHtml(result, testType, fileName, interp, vars) {
  const now = new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  const testLabel = {
    descriptive:"Descriptive Statistics", chisquare:"Chi-square Test",
    ttest:"Independent T-test (Welch)", anova:"One-Way ANOVA",
    correlation:"Pearson Correlation", logistic:"Binary Logistic Regression"
  }[testType] || testType;

  const pSig = p => p < 0.05
    ? `<span style="color:#16a34a;font-weight:700">${p < 0.001 ? "p<0.001" : "p="+p} ✓</span>`
    : `<span style="color:#dc2626">${"p="+p}</span>`;

  let body = "";

  if (result.type === "descriptive") {
    if (result.stats) {
      const st = result.stats;
      body = `<table><tr><th>N</th><th>Mean</th><th>Median</th><th>SD</th><th>Min</th><th>Max</th><th>SE</th><th>95% CI ±</th></tr>
        <tr><td>${st.n}</td><td>${st.mean.toFixed(2)}</td><td>${st.median.toFixed(2)}</td><td>${st.sd.toFixed(2)}</td>
        <td>${st.min}</td><td>${st.max}</td><td>${st.se.toFixed(3)}</td><td>${st.ci95.toFixed(3)}</td></tr></table>`;
    } else {
      body = `<table><tr><th>Category</th><th>Count</th><th>Percent</th></tr>
        ${result.freq.map(r=>`<tr><td>${r.name}</td><td>${r.count}</td><td>${r.pct}%</td></tr>`).join("")}</table>`;
    }
  }
  else if (result.type === "chisquare") {
    body = `<table><tr><th>χ²</th><th>df</th><th>p-value</th></tr>
      <tr><td>${result.chi2}</td><td>${result.df}</td><td>${pSig(result.p)}</td></tr></table>
      <br/><b>Contingency Table</b><br/>
      <table><tr><th>${vars.split("×")[0]} \\ ${vars.split("×")[1]}</th>
        ${result.colCats.map(c=>`<th>${c}</th>`).join("")}<th>Total</th></tr>
        ${result.rowCats.map((r,ri)=>`<tr><td><b>${r}</b></td>
          ${result.observed[ri].map(v=>`<td>${v}</td>`).join("")}
          <td>${result.rowTotals[ri]}</td></tr>`).join("")}
        <tr><td><b>Total</b></td>${result.colTotals.map(v=>`<td>${v}</td>`).join("")}<td><b>${result.n}</b></td></tr>
      </table>`;
  }
  else if (result.type === "ttest") {
    body = `<table><tr><th>t</th><th>df</th><th>p-value</th></tr>
      <tr><td>${result.t}</td><td>${result.df}</td><td>${pSig(result.p)}</td></tr></table>
      <br/><table><tr><th>Group</th><th>n</th><th>Mean</th><th>SD</th></tr>
        ${result.groups.map((g,i)=>`<tr><td>${g}</td><td>${result[`n${i+1}`]}</td><td>${result[`mean${i+1}`]}</td><td>${result[`sd${i+1}`]}</td></tr>`).join("")}
      </table>`;
  }
  else if (result.type === "correlation") {
    body = `<table><tr><th>r</th><th>r²</th><th>n</th><th>p-value</th></tr>
      <tr><td>${result.r}</td><td>${result.r2}</td><td>${result.n}</td><td>${pSig(result.p)}</td></tr></table>`;
  }
  else if (result.type === "anova") {
    body = `<b>ANOVA Table</b><br/>
      <table><tr><th>Source</th><th>SS</th><th>df</th><th>MS</th><th>F</th><th>p-value</th></tr>
        <tr><td>Between groups</td><td>${result.SSB}</td><td>${result.dfB}</td><td>${result.MSB}</td><td><b>${result.F}</b></td><td>${pSig(result.p)}</td></tr>
        <tr><td>Within groups</td><td>${result.SSW}</td><td>${result.dfW}</td><td>${result.MSW}</td><td>—</td><td>—</td></tr>
        <tr><td><b>Total</b></td><td>${+(result.SSB+result.SSW).toFixed(3)}</td><td>${result.dfB+result.dfW}</td><td>—</td><td>—</td><td>—</td></tr>
      </table>
      <br/><b>Group Statistics</b><br/>
      <table><tr><th>Group</th><th>n</th><th>Mean</th><th>SD</th></tr>
        ${result.groupStats.map(g=>`<tr><td>${g.group}</td><td>${g.n}</td><td>${g.mean}</td><td>${g.sd}</td></tr>`).join("")}
      </table>
      <br/><b>Post-hoc Pairwise Comparisons (Bonferroni)</b><br/>
      <table><tr><th>Pair</th><th>Mean Diff</th><th>p (raw)</th><th>p (Bonferroni)</th><th>Significant?</th></tr>
        ${result.pairs.map(p=>`<tr><td>${p.pair}</td><td>${p.meanDiff}</td><td>${pSig(p.p_raw)}</td><td>${pSig(p.p_bonf)}</td><td>${p.p_bonf<0.05?"Yes ✓":"No"}</td></tr>`).join("")}
      </table>`;
  }
  else if (result.type === "logistic") {
    body = `<b>Model Fit</b><br/>
      <table><tr><th>n</th><th>Nagelkerke R²</th><th>−2LL</th><th>H-L χ²</th><th>H-L p</th></tr>
        <tr><td>${result.n}</td><td>${result.nagelkerke}</td><td>${+(-2*result.ll).toFixed(2)}</td><td>${result.hoslem.chi2}</td><td>${pSig(result.hoslem.p)}</td></tr>
      </table>
      <br/>Outcome: <b>${result.outVals?.[0]}</b> = 0 (reference), <b>${result.outVals?.[1]}</b> = 1 (event)<br/><br/>
      <b>Coefficients &amp; Odds Ratios</b><br/>
      <table><tr><th>Variable</th><th>β</th><th>SE</th><th>Wald χ²</th><th>p-value</th><th>OR</th><th>95% CI</th></tr>
        ${result.coefs.map(c=>`<tr><td>${c.name}</td><td>${c.beta}</td><td>${c.se??"-"}</td><td>${c.wald??"-"}</td>
          <td>${c.p!=null?pSig(c.p):"-"}</td><td><b>${c.or??"-"}</b></td>
          <td>${c.or_lo&&c.or_hi?`${c.or_lo} – ${c.or_hi}`:"-"}</td></tr>`).join("")}
      </table>`;
  }

  const interpSection = interp
    ? `<div class="interp"><div class="interp-title">AI Interpretation</div>
        <p>${interp.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br/>")}</p></div>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Biostat Buddy Report</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Georgia,serif;color:#111;background:#fff;padding:36px 48px;font-size:13px;line-height:1.6;}
    .header{border-bottom:3px solid #1e40af;padding-bottom:14px;margin-bottom:22px;}
    .dept{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;}
    h1{font-size:22px;color:#1e3a8a;font-weight:700;margin-bottom:2px;}
    .meta{font-size:11px;color:#777;margin-top:6px;}
    .section{margin-bottom:22px;}
    .section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1e40af;
      border-bottom:1px solid #bfdbfe;padding-bottom:4px;margin-bottom:12px;}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
    th{background:#eff6ff;color:#1e3a8a;font-weight:600;padding:7px 10px;text-align:left;
      border:1px solid #bfdbfe;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;}
    td{padding:6px 10px;border:1px solid #dde8f5;}
    tr:nth-child(even) td{background:#f8faff;}
    .interp{background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:14px 18px;margin-top:18px;}
    .interp-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#15803d;margin-bottom:8px;}
    .footer{margin-top:32px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#999;text-align:center;}
    b{color:#1e3a8a;}
    @media print{body{padding:20px 30px;} .no-print{display:none;}}
  </style></head><body>
  <div class="header">
    <div class="dept">Dr. Pawan Kumar B · Dept. of Community Medicine · NITTE Deemed University</div>
    <h1>Biostat Buddy — Analysis Report</h1>
    <div class="meta">File: <b>${fileName}</b> &nbsp;|&nbsp; Test: <b>${testLabel}</b> &nbsp;|&nbsp; Variables: <b>${vars}</b> &nbsp;|&nbsp; Date: <b>${now}</b></div>
  </div>
  <div class="section"><div class="section-title">${testLabel}</div>${body}</div>
  ${interpSection}
  <div class="footer">Generated by Biostat Buddy · Dr. Pawan Kumar B · Dept. of Community Medicine · Printed ${now}</div>
  <div class="no-print" style="margin-top:24px;text-align:center;">
    <button onclick="window.print()" style="background:#1e40af;color:#fff;border:none;padding:10px 28px;
      border-radius:6px;font-size:14px;cursor:pointer;font-family:Georgia,serif;">🖨 Print / Save as PDF</button>
  </div>
  </body></html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function detectType(col,data) {
  const vals=data.map(r=>r[col]).filter(v=>v!=null&&v!=="");
  const nums=vals.map(Number).filter(v=>!isNaN(v));
  return nums.length/vals.length>0.8?"numeric":"categorical";
}

function RenderMD({text}) {
  return (
    <div style={{lineHeight:1.7}}>
      {text.split("\n").map((line,i)=>{
        const parts=line.split(/(\*\*[^*]+\*\*)/g);
        return <p key={i} style={{margin:"3px 0",color:C.text,fontSize:14}}>
          {parts.map((p,j)=>p.startsWith("**")?<strong key={j} style={{color:C.accent}}>{p.replace(/\*\*/g,"")}</strong>:p)}
        </p>;
      })}
    </div>
  );
}

function PTag({p}) {
  if(p===null||p===undefined||p==="N/A") return <span style={{color:C.muted,fontSize:11}}>—</span>;
  const pn=+p;
  const col=pn<0.05?C.green:pn<0.1?C.yellow:C.red;
  const label=pn===0||pn<0.001?"p<0.001":`p=${pn}`;
  return <span style={{background:col+"22",color:col,border:`1px solid ${col}44`,borderRadius:4,fontSize:11,padding:"2px 7px"}}>{label}</span>;
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function BiostaBuddy() {
  const [page,setPage]=useState("home");
  const [data,setData]=useState(null);
  const [columns,setColumns]=useState([]);
  const [colTypes,setColTypes]=useState({});
  const [fileName,setFileName]=useState("");
  const [testType,setTestType]=useState("descriptive");
  const [varA,setVarA]=useState("");
  const [varB,setVarB]=useState("");
  const [groupVar,setGroupVar]=useState("");
  const [outcome,setOutcome]=useState(""); // logistic: binary outcome
  const [predictors,setPredictors]=useState([]); // logistic: list of predictors
  const [result,setResult]=useState(null);
  const [interp,setInterp]=useState("");
  const [loadingInterp,setLoadingInterp]=useState(false);
  const [loadingAnalysis,setLoadingAnalysis]=useState(false);
  const [dragOver,setDragOver]=useState(false);


  const handleFile=file=>{
    if(!file) return;
    setFileName(file.name);
    Papa.parse(file,{header:true,skipEmptyLines:true,complete:({data:rows,meta})=>{
      setData(rows);
      const cols=meta.fields||[];
      setColumns(cols);
      const types={};
      cols.forEach(c=>{types[c]=detectType(c,rows);});
      setColTypes(types);
      setVarA(cols[0]||"");
      setVarB(cols[1]||"");
      setGroupVar(cols.find(c=>types[c]==="categorical")||cols[0]||"");
      setOutcome(cols.find(c=>types[c]==="categorical")||cols[0]||"");
      setPredictors(cols.filter(c=>types[c]==="numeric").slice(0,3));
      setResult(null);setInterp("");
      setPage("analysis");
    }});
  };

  const numCols=columns.filter(c=>colTypes[c]==="numeric");
  const catCols=columns.filter(c=>colTypes[c]==="categorical");

  const togglePredictor=col=>{
    setPredictors(prev=>prev.includes(col)?prev.filter(c=>c!==col):[...prev,col]);
  };

  const runAnalysis=async()=>{
    // ── Pre-flight validation ──────────────────────────────────────────────────
    if(testType==="chisquare"&&varA===varB) { setResult({error:"Variable 1 and Variable 2 cannot be the same."}); return; }
    if(testType==="correlation"&&varA===varB) { setResult({error:"Variable X and Variable Y cannot be the same."}); return; }
    if(testType==="logistic"&&predictors.length===0) { setResult({error:"Select at least one predictor variable."}); return; }
    setLoadingAnalysis(true); setResult(null); setInterp("");
    await new Promise(r=>setTimeout(r,30)); // flush UI before heavy computation
    try {
      let res;
      if(testType==="descriptive"){
        const nums=data.map(r=>+r[varA]).filter(v=>!isNaN(v));
        if(colTypes[varA]==="numeric"&&nums.length<2) throw new Error("Need at least 2 numeric values for descriptive stats.");
        res={type:"descriptive",variable:varA,stats:colTypes[varA]==="numeric"?descriptiveStats(nums):null,freq:freqTable(data,varA)};
      } else if(testType==="chisquare"){
        res={type:"chisquare",...chiSquare(data,varA,varB)};
      } else if(testType==="ttest"){
        const grps=[...new Set(data.map(r=>r[groupVar]).filter(v=>v!=null&&v!==""))];
        if(grps.length<2) throw new Error(`Grouping variable "${groupVar}" has only 1 unique group. T-test needs exactly 2.`);
        if(grps.length>2) throw new Error(`Grouping variable "${groupVar}" has ${grps.length} groups. T-test needs exactly 2. Use ANOVA for 3+ groups.`);
        const g1=data.filter(r=>r[groupVar]===grps[0]).map(r=>+r[varA]).filter(v=>!isNaN(v));
        const g2=data.filter(r=>r[groupVar]===grps[1]).map(r=>+r[varA]).filter(v=>!isNaN(v));
        res={type:"ttest",groups:grps,...tTest(g1,g2)};
      } else if(testType==="correlation"){
        const paired=data.filter(r=>!isNaN(+r[varA])&&!isNaN(+r[varB]));
        if(paired.length<3) throw new Error("Need at least 3 paired observations for correlation.");
        res={type:"correlation",varA,varB,...pearson(paired.map(r=>+r[varA]),paired.map(r=>+r[varB])),
             scatter:paired.slice(0,300).map(r=>({x:+r[varA],y:+r[varB]}))};
      } else if(testType==="anova"){
        const grpCount=[...new Set(data.map(r=>r[groupVar]).filter(v=>v!=null&&v!==""))].length;
        if(grpCount<2) throw new Error("ANOVA requires at least 2 groups. Only 1 found.");
        res=oneWayAnova(data,varA,groupVar);
      } else if(testType==="logistic"){
        const allOutVals=[...new Set(data.map(r=>r[outcome]).filter(v=>v!=null&&v!==""))];
        if(allOutVals.length<2) throw new Error("Outcome variable must have exactly 2 categories.");
        if(allOutVals.length>2) throw new Error(`Outcome "${outcome}" has ${allOutVals.length} categories. Binary logistic regression needs exactly 2. Recode to binary first.`);
        const outVals=allOutVals.slice(0,2);
        const validRows=data.filter(r=>r[outcome]!=null&&r[outcome]!==""&&predictors.every(p=>!isNaN(+r[p])));
        if(validRows.length<predictors.length+10) throw new Error(`Too few complete cases (${validRows.length}) for ${predictors.length} predictor(s). Need at least ${predictors.length+10}.`);
        const y=validRows.map(r=>r[outcome]===outVals[1]?1:0);
        if(y.every(v=>v===0)||y.every(v=>v===1)) throw new Error("Outcome has only one class in valid rows. Check for missing data.");
        const Xraw=validRows.map(r=>predictors.map(p=>+r[p]));
        res=logisticRegression(Xraw,y,predictors);
        res.outVals=outVals;
      }
      setResult(res);
    } catch(e){setResult({error:e.message});}
    setLoadingAnalysis(false);
  };

  const exportPDF=()=>{
    if(!result) return;
    const vars=testType==="logistic"?`${outcome} ~ ${predictors.join(",")}`:
               testType==="anova"?`${varA} by ${groupVar}`:
               testType==="ttest"?`${varA} by ${groupVar}`:
               testType==="chisquare"?`${varA} × ${varB}`:varA;
    const html=buildPDFHtml(result,testType,fileName,interp,vars);
    const w=window.open("","_blank");
    if(!w){ alert("PDF export blocked. Please allow pop-ups for this site in your browser settings."); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(()=>{ try{w.print();}catch(e){} },600);
  };

  const runInterp=async()=>{
    if(!result) return;
    setLoadingInterp(true);
    const vars=testType==="logistic"?`${outcome} ~ ${predictors.join(",")}`:
               testType==="anova"?`${varA} by ${groupVar}`:
               testType==="ttest"?`${varA} by ${groupVar}`:
               testType==="chisquare"?`${varA} × ${varB}`:varA;
    const txt=await getInterpretation(testType.toUpperCase(),result,vars);
    setInterp(txt);setLoadingInterp(false);
  };

  // ── Styles ───────────────────────────────────────────────────────────────────
  const s={
    app:{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'JetBrains Mono','Fira Code',monospace"},
    header:{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px 28px",display:"flex",alignItems:"center",gap:14},
    logo:{fontSize:22,fontWeight:800,letterSpacing:-1,color:C.accent},
    sub:{fontSize:11,color:C.muted,letterSpacing:2,textTransform:"uppercase"},
    main:{maxWidth:1200,margin:"0 auto",padding:"28px 20px"},
    card:{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:22,marginBottom:18},
    label:{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6,display:"block"},
    select:{background:C.surface,border:`1px solid ${C.border}`,color:C.text,padding:"8px 12px",borderRadius:7,fontSize:13,width:"100%",outline:"none",fontFamily:"inherit"},
    btn:{background:C.accent,color:"#0D1117",border:"none",padding:"10px 22px",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"},
    btnGhost:{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"8px 16px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"},
    stat:{background:C.surface,borderRadius:8,padding:"12px 16px",textAlign:"center",border:`1px solid ${C.border}`},
    statVal:{fontSize:20,fontWeight:800,color:C.accent},
    statLbl:{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,marginTop:2},
    grid:(n)=>({display:"grid",gridTemplateColumns:`repeat(${n},1fr)`,gap:12}),
    tag:(col)=>({display:"inline-block",background:col+"22",color:col,border:`1px solid ${col}44`,borderRadius:4,fontSize:10,padding:"2px 7px",letterSpacing:1,textTransform:"uppercase"}),
    pv:(p)=>p<0.05?C.green:C.red,
    th:{padding:"7px 12px",color:C.muted,fontWeight:600,textAlign:"left",borderBottom:`1px solid ${C.border}`,fontSize:11,textTransform:"uppercase",letterSpacing:1},
    td:{padding:"6px 12px",fontSize:12,borderBottom:`1px solid ${C.border}22`},
  };

  // ── HOME ─────────────────────────────────────────────────────────────────────
  if(page==="home") return (
    <div style={s.app}>
      <div style={s.header}>
        <div><div style={s.logo}>⚕ Biostat Buddy</div><div style={s.sub}>Dr. Pawan Kumar B · Community Medicine</div></div>
      </div>
      <div style={{...s.main,display:"flex",flexDirection:"column",alignItems:"center",paddingTop:70}}>
        <div style={{textAlign:"center",marginBottom:44}}>
          <div style={{fontSize:40,fontWeight:900,letterSpacing:-2,color:C.text,lineHeight:1.1}}>
            No more SPSS panic<br/><span style={{color:C.accent}}>at 2 AM.</span>
          </div>
          <div style={{color:C.muted,fontSize:14,marginTop:14,maxWidth:440}}>
            Upload CSV → Choose test → Get results + plain-English interpretation.<br/>Built for MBBS interns, PGs, and thesis writers.
          </div>
        </div>
        <label
          htmlFor="csvUpload"
          onDragOver={e=>{e.preventDefault();setDragOver(true);}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0]);}}
          style={{border:`2px dashed ${dragOver?C.accent:C.border}`,borderRadius:16,padding:"48px 64px",
                  cursor:"pointer",textAlign:"center",background:dragOver?C.accent+"11":C.card,
                  transition:"all 0.2s",width:"100%",maxWidth:460,display:"block"}}>
          <div style={{fontSize:40,marginBottom:12}}>📊</div>
          <div style={{fontWeight:700,fontSize:15}}>Tap or drop CSV to upload</div>
          <div style={{color:C.muted,fontSize:12,marginTop:6}}>CSV files supported</div>
          <div style={{marginTop:16,display:"inline-block",background:C.accent,color:"#0D1117",
            padding:"8px 24px",borderRadius:8,fontWeight:700,fontSize:13}}>Browse File</div>
        </label>
        <input id="csvUpload" type="file" accept=".csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
        <div style={{display:"flex",gap:10,marginTop:32,flexWrap:"wrap",justifyContent:"center"}}>
          {["Descriptive","Chi-square","T-test","ANOVA + Post-hoc","Pearson Correlation","Logistic Regression","AI Interpretation"].map(f=>(
            <span key={f} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,fontSize:11,padding:"5px 12px",color:C.muted}}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );

  // ── ANALYSIS ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.app}>
      <div style={s.header}>
        <div style={{flex:1}}><div style={s.logo}>⚕ Biostat Buddy</div><div style={s.sub}>Dr. Pawan Kumar B · Community Medicine</div></div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={s.tag(C.green)}>✓ {fileName}</span>
          <span style={s.tag(C.accent)}>{data?.length} rows</span>
          <button style={s.btnGhost} onClick={()=>{setPage("home");setData(null);setResult(null);}}>New File</button>
        </div>
      </div>

      <div style={s.main}>
        <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:18}}>

          {/* Sidebar: columns */}
          <div>
            <div style={{...s.card,maxHeight:"calc(100vh - 140px)",overflowY:"auto"}}>
              <div style={{fontSize:11,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>Variables ({columns.length})</div>
              {columns.map(c=>(
                <div key={c} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.border}22`}}>
                  <span style={{fontSize:11,color:C.text,overflow:"hidden",textOverflow:"ellipsis",maxWidth:150}}>{c}</span>
                  <span style={s.tag(colTypes[c]==="numeric"?C.accent:C.purple)}>{colTypes[c]==="numeric"?"num":"cat"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main panel */}
          <div>
            {/* Test config */}
            <div style={s.card}>
              <div style={{...s.grid(2),marginBottom:18}}>
                <div>
                  <label style={s.label}>Statistical Test</label>
                  <select style={s.select} value={testType} onChange={e=>{setTestType(e.target.value);setResult(null);setInterp("");}}>
                    <option value="descriptive">Descriptive Statistics</option>
                    <option value="chisquare">Chi-square Test</option>
                    <option value="ttest">Independent T-test (Welch)</option>
                    <option value="anova">One-Way ANOVA + Post-hoc</option>
                    <option value="correlation">Pearson Correlation</option>
                    <option value="logistic">Binary Logistic Regression</option>
                  </select>
                </div>

                {/* Descriptive */}
                {testType==="descriptive"&&<div>
                  <label style={s.label}>Variable</label>
                  <select style={s.select} value={varA} onChange={e=>setVarA(e.target.value)}>
                    {columns.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>}

                {/* Chi-square */}
                {testType==="chisquare"&&<>
                  <div><label style={s.label}>Variable 1 (Row)</label>
                    <select style={s.select} value={varA} onChange={e=>setVarA(e.target.value)}>{catCols.map(c=><option key={c}>{c}</option>)}</select></div>
                  <div><label style={s.label}>Variable 2 (Column)</label>
                    <select style={s.select} value={varB} onChange={e=>setVarB(e.target.value)}>{catCols.map(c=><option key={c}>{c}</option>)}</select></div>
                </>}

                {/* T-test */}
                {testType==="ttest"&&<>
                  <div><label style={s.label}>Outcome (Numeric)</label>
                    <select style={s.select} value={varA} onChange={e=>setVarA(e.target.value)}>{numCols.map(c=><option key={c}>{c}</option>)}</select></div>
                  <div><label style={s.label}>Grouping (2 groups)</label>
                    <select style={s.select} value={groupVar} onChange={e=>setGroupVar(e.target.value)}>{catCols.map(c=><option key={c}>{c}</option>)}</select></div>
                </>}

                {/* ANOVA */}
                {testType==="anova"&&<>
                  <div><label style={s.label}>Outcome (Numeric)</label>
                    <select style={s.select} value={varA} onChange={e=>setVarA(e.target.value)}>{numCols.map(c=><option key={c}>{c}</option>)}</select></div>
                  <div><label style={s.label}>Grouping (≥3 groups)</label>
                    <select style={s.select} value={groupVar} onChange={e=>setGroupVar(e.target.value)}>{catCols.map(c=><option key={c}>{c}</option>)}</select></div>
                </>}

                {/* Correlation */}
                {testType==="correlation"&&<>
                  <div><label style={s.label}>Variable X</label>
                    <select style={s.select} value={varA} onChange={e=>setVarA(e.target.value)}>{numCols.map(c=><option key={c}>{c}</option>)}</select></div>
                  <div><label style={s.label}>Variable Y</label>
                    <select style={s.select} value={varB} onChange={e=>setVarB(e.target.value)}>{numCols.filter(c=>c!==varA).map(c=><option key={c}>{c}</option>)}</select></div>
                </>}
              </div>

              {/* Logistic regression — separate row for multi-select */}
              {testType==="logistic"&&(
                <div style={{marginBottom:18}}>
                  <div style={s.grid(2)}>
                    <div>
                      <label style={s.label}>Binary Outcome</label>
                      <select style={s.select} value={outcome} onChange={e=>setOutcome(e.target.value)}>
                        {catCols.map(c=><option key={c}>{c}</option>)}
                      </select>
                      {outcome&&<div style={{fontSize:10,color:C.muted,marginTop:4}}>
                        Reference = first category; Event = second category
                      </div>}
                    </div>
                    <div>
                      <label style={s.label}>Predictors (select multiple)</label>
                      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 10px",maxHeight:120,overflowY:"auto"}}>
                        {numCols.map(c=>(
                          <label key={c} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 0",cursor:"pointer"}}>
                            <input type="checkbox" checked={predictors.includes(c)} onChange={()=>togglePredictor(c)}
                              style={{accentColor:C.accent}}/>
                            <span style={{fontSize:12,color:predictors.includes(c)?C.text:C.muted}}>{c}</span>
                          </label>
                        ))}
                      </div>
                      <div style={{fontSize:10,color:C.muted,marginTop:4}}>{predictors.length} predictor(s) selected</div>
                    </div>
                  </div>
                </div>
              )}

              <button style={s.btn} onClick={runAnalysis} disabled={loadingAnalysis}>
                {loadingAnalysis?"Running…":"▶ Run Analysis"}
              </button>
            </div>

            {/* ── Results ── */}
            {result&&!result.error&&(
              <div style={s.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                  <div style={{fontWeight:700,fontSize:14}}>Results</div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={{...s.btn,background:C.purple,fontSize:11,padding:"7px 16px"}}
                      onClick={runInterp} disabled={loadingInterp}>
                      {loadingInterp?"✨ Interpreting…":"✨ AI Interpret"}
                    </button>
                    <button style={{...s.btn,background:C.green,fontSize:11,padding:"7px 16px"}}
                      onClick={exportPDF}>
                      ⬇ Export PDF
                    </button>
                  </div>
                </div>

                {/* ─ Descriptive ─ */}
                {result.type==="descriptive"&&(
                  <>
                    {colTypes[varA]==="numeric"?(
                      <>
                        <div style={{...s.grid(4),marginBottom:18}}>
                          {[["N",result.stats.n],["Mean",result.stats.mean.toFixed(2)],["Median",result.stats.median.toFixed(2)],
                            ["SD",result.stats.sd.toFixed(2)],["Min",result.stats.min],["Max",result.stats.max],
                            ["SE",result.stats.se.toFixed(3)],["95% CI±",result.stats.ci95.toFixed(3)]
                          ].map(([l,v])=><div key={l} style={s.stat}><div style={s.statVal}>{v}</div><div style={s.statLbl}>{l}</div></div>)}
                        </div>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={result.freq.slice(0,20)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                            <XAxis dataKey="name" tick={{fill:C.muted,fontSize:10}}/>
                            <YAxis tick={{fill:C.muted,fontSize:10}}/>
                            <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`}}/>
                            <Bar dataKey="count" fill={C.accent} radius={[4,4,0,0]}/>
                          </BarChart>
                        </ResponsiveContainer>
                      </>
                    ):(
                      <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
                        <ResponsiveContainer width={180} height={160}>
                          <PieChart><Pie data={result.freq} dataKey="count" cx="50%" cy="50%" outerRadius={75}>
                            {result.freq.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                          </Pie><Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`}}/></PieChart>
                        </ResponsiveContainer>
                        <table style={{fontSize:12,borderCollapse:"collapse"}}>
                          <thead><tr>{["Category","n","%"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                          <tbody>{result.freq.map((r,i)=><tr key={i}><td style={{...s.td,color:COLORS[i%COLORS.length]}}>{r.name}</td><td style={s.td}>{r.count}</td><td style={s.td}>{r.pct}%</td></tr>)}</tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* ─ Chi-square ─ */}
                {result.type==="chisquare"&&(
                  <>
                    <div style={{...s.grid(3),marginBottom:16}}>
                      {[["χ²",result.chi2],["df",result.df],["p-value",result.p]].map(([l,v])=>(
                        <div key={l} style={{...s.stat,border:`1px solid ${l==="p-value"?s.pv(result.p)+"44":C.border}`}}>
                          <div style={{...s.statVal,color:l==="p-value"?s.pv(result.p):C.accent}}>{v}</div>
                          <div style={s.statLbl}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {result.smallCell>0&&<div style={{background:C.yellow+"22",border:`1px solid ${C.yellow}44`,borderRadius:6,padding:"6px 12px",fontSize:11,color:C.yellow,marginBottom:10}}>
                      ⚠ {result.smallCell} cell(s) have expected count &lt; 5. Chi-square may be unreliable. Consider Fisher's exact test.
                    </div>}
                    <div style={{overflowX:"auto",marginBottom:14}}>
                      <table style={{fontSize:11,borderCollapse:"collapse",width:"100%"}}>
                        <thead><tr>
                          <th style={s.th}>{varA} \ {varB}</th>
                          {result.colCats.map(c=><th key={c} style={{...s.th,color:C.accent}}>{c}</th>)}
                          <th style={s.th}>Total</th>
                        </tr></thead>
                        <tbody>
                          {result.rowCats.map((r,ri)=>(
                            <tr key={ri}>
                              <td style={{...s.td,color:C.purple}}>{r}</td>
                              {result.observed[ri].map((v,ci)=><td key={ci} style={{...s.td,textAlign:"center"}}>{v}</td>)}
                              <td style={{...s.td,textAlign:"center",color:C.muted}}>{result.rowTotals[ri]}</td>
                            </tr>
                          ))}
                          <tr><td style={{...s.td,color:C.muted}}>Total</td>
                            {result.colTotals.map((v,ci)=><td key={ci} style={{...s.td,textAlign:"center",color:C.muted}}>{v}</td>)}
                            <td style={{...s.td,textAlign:"center",fontWeight:700}}>{result.n}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={result.rowCats.map((r,ri)=>({name:r,...Object.fromEntries(result.colCats.map((c,ci)=>[c,result.observed[ri][ci]]))}))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}}/><YAxis tick={{fill:C.muted,fontSize:10}}/>
                        <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`}}/><Legend wrapperStyle={{fontSize:11}}/>
                        {result.colCats.map((c,i)=><Bar key={c} dataKey={c} fill={COLORS[i%COLORS.length]} radius={[3,3,0,0]}/>)}
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}

                {/* ─ T-test ─ */}
                {result.type==="ttest"&&(
                  <>
                    <div style={{...s.grid(3),marginBottom:16}}>
                      {[["t",result.t],["df",result.df],["p-value",result.p]].map(([l,v])=>(
                        <div key={l} style={{...s.stat,border:`1px solid ${l==="p-value"?s.pv(result.p)+"44":C.border}`}}>
                          <div style={{...s.statVal,color:l==="p-value"?s.pv(result.p):C.accent}}>{v}</div>
                          <div style={s.statLbl}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{...s.grid(2),marginBottom:16}}>
                      {result.groups.map((g,i)=>(
                        <div key={g} style={{...s.card,margin:0,border:`1px solid ${[C.accent,C.purple][i]}44`}}>
                          <div style={{fontWeight:700,color:[C.accent,C.purple][i],fontSize:12,marginBottom:6}}>{g}</div>
                          <div style={{fontSize:12}}>n = {result[`n${i+1}`]}</div>
                          <div style={{fontSize:12}}>Mean = {result[`mean${i+1}`]}</div>
                          <div style={{fontSize:12}}>SD = {result[`sd${i+1}`]}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ─ Correlation ─ */}
                {result.type==="correlation"&&(
                  <>
                    <div style={{...s.grid(3),marginBottom:16}}>
                      {[["r",result.r],["r²",result.r2],["p-value",result.p]].map(([l,v])=>(
                        <div key={l} style={{...s.stat,border:`1px solid ${l==="p-value"?s.pv(result.p)+"44":C.border}`}}>
                          <div style={{...s.statVal,color:l==="p-value"?s.pv(result.p):C.accent}}>{v}</div>
                          <div style={s.statLbl}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <ScatterChart><CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis dataKey="x" name={varA} tick={{fill:C.muted,fontSize:11}}/>
                        <YAxis dataKey="y" name={varB} tick={{fill:C.muted,fontSize:11}}/>
                        <Tooltip cursor={{strokeDasharray:"3 3"}} contentStyle={{background:C.card,border:`1px solid ${C.border}`,fontSize:11}}/>
                        <Scatter data={result.scatter} fill={C.accent} opacity={0.55}/>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </>
                )}

                {/* ─ ANOVA ─ */}
                {result.type==="anova"&&(
                  <>
                    {/* ANOVA table */}
                    <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>ANOVA Table</div>
                    <table style={{fontSize:12,borderCollapse:"collapse",width:"100%",marginBottom:18}}>
                      <thead><tr>
                        {["Source","SS","df","MS","F","p-value"].map(h=><th key={h} style={s.th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        <tr>
                          <td style={{...s.td,color:C.accent}}>Between groups</td>
                          <td style={s.td}>{result.SSB}</td><td style={s.td}>{result.dfB}</td>
                          <td style={s.td}>{result.MSB}</td>
                          <td style={{...s.td,fontWeight:700,color:C.yellow}}>{result.F}</td>
                          <td style={s.td}><PTag p={result.p}/></td>
                        </tr>
                        <tr>
                          <td style={{...s.td,color:C.muted}}>Within groups</td>
                          <td style={s.td}>{result.SSW}</td><td style={s.td}>{result.dfW}</td>
                          <td style={s.td}>{result.MSW}</td><td style={s.td}>—</td><td style={s.td}>—</td>
                        </tr>
                        <tr>
                          <td style={{...s.td,fontWeight:700}}>Total</td>
                          <td style={{...s.td,fontWeight:700}}>{+(result.SSB+result.SSW).toFixed(3)}</td>
                          <td style={{...s.td,fontWeight:700}}>{result.dfB+result.dfW}</td>
                          <td style={s.td}>—</td><td style={s.td}>—</td><td style={s.td}>—</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Group means + chart */}
                    <div style={{...s.grid(2),marginBottom:18,alignItems:"start"}}>
                      <div>
                        <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>Group Statistics</div>
                        <table style={{fontSize:12,borderCollapse:"collapse",width:"100%"}}>
                          <thead><tr>{["Group","n","Mean","SD"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                          <tbody>{result.groupStats.map((g,i)=>(
                            <tr key={g.group}>
                              <td style={{...s.td,color:COLORS[i%COLORS.length]}}>{g.group}</td>
                              <td style={s.td}>{g.n}</td><td style={s.td}>{g.mean}</td><td style={s.td}>{g.sd}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={result.groupStats}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                          <XAxis dataKey="group" tick={{fill:C.muted,fontSize:11}}/>
                          <YAxis tick={{fill:C.muted,fontSize:10}}/>
                          <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`}}/>
                          <Bar dataKey="mean" name="Mean" radius={[4,4,0,0]}>
                            {result.groupStats.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Post-hoc pairwise */}
                    {result.pairs.length>0&&(
                      <>
                        <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>
                          Post-hoc Pairwise Comparisons (Bonferroni)
                        </div>
                        <table style={{fontSize:12,borderCollapse:"collapse",width:"100%"}}>
                          <thead><tr>{["Pair","Mean Diff","p (raw)","p (Bonferroni)","Sig?"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                          <tbody>{result.pairs.map((p,i)=>(
                            <tr key={i}>
                              <td style={{...s.td,color:C.purple}}>{p.pair}</td>
                              <td style={s.td}>{p.meanDiff}</td>
                              <td style={s.td}><PTag p={p.p_raw}/></td>
                              <td style={s.td}><PTag p={p.p_bonf}/></td>
                              <td style={s.td}>{p.p_bonf<0.05?<span style={{color:C.green}}>✓ Yes</span>:<span style={{color:C.muted}}>No</span>}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </>
                    )}
                  </>
                )}

                {/* ─ Logistic Regression ─ */}
                {result.type==="logistic"&&(
                  <>
                    {/* Model fit */}
                    <div style={{...s.grid(4),marginBottom:18}}>
                      {[["n",result.n],["Nagelkerke R²",result.nagelkerke],["-2LL",+(-2*result.ll).toFixed(2)],["H-L p",result.hoslem.p==="N/A"?"N/A":result.hoslem.p]].map(([l,v])=>(
                        <div key={l} style={{...s.stat,border:`1px solid ${l==="H-L p"?(result.hoslem.p==="N/A"?C.border:(result.hoslem.p>0.05?C.green:C.red)+"44"):C.border}`}}>
                          <div style={{...s.statVal,fontSize:17}}>{v}</div>
                          <div style={s.statLbl}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:10,color:C.muted,marginBottom:14}}>
                      Outcome: <span style={{color:C.accent}}>{result.outVals?.[0]}</span> = 0, <span style={{color:C.green}}>{result.outVals?.[1]}</span> = 1 (event)
                      {" · "}Hosmer-Lemeshow p&gt;0.05 indicates good fit
                    </div>

                    {/* Coefficients table */}
                    <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Coefficients & Odds Ratios</div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{fontSize:12,borderCollapse:"collapse",width:"100%"}}>
                        <thead><tr>{["Variable","β","SE","Wald χ²","p-value","OR","95% CI","Sig?"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                        <tbody>
                          {result.coefs.map((c,i)=>(
                            <tr key={i} style={{background:i===0?C.surface+"80":"transparent"}}>
                              <td style={{...s.td,color:i===0?C.muted:C.text,fontStyle:i===0?"italic":"normal"}}>{c.name}</td>
                              <td style={{...s.td,fontFamily:"monospace"}}>{c.beta}</td>
                              <td style={{...s.td,color:C.muted}}>{c.se??"-"}</td>
                              <td style={s.td}>{c.wald??"-"}</td>
                              <td style={s.td}>{c.p!=null?<PTag p={c.p}/>:"-"}</td>
                              <td style={{...s.td,fontWeight:i>0?700:400,color:i>0?C.yellow:C.muted}}>{c.or??"-"}</td>
                              <td style={{...s.td,fontSize:11,color:C.muted}}>
                                {c.or_lo&&c.or_hi?`${c.or_lo} – ${c.or_hi}`:"-"}
                              </td>
                              <td style={s.td}>
                                {c.p!=null?(c.p<0.05?<span style={{color:C.green}}>✓</span>:<span style={{color:C.muted}}>—</span>):"-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Forest-plot style OR chart */}
                    {result.coefs.filter(c=>c.or!=null).length>0&&(
                      <div style={{marginTop:18}}>
                        <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>Odds Ratio Plot</div>
                        <ResponsiveContainer width="100%" height={40+result.coefs.filter(c=>c.or!=null).length*40}>
                          <BarChart layout="vertical" data={result.coefs.filter(c=>c.or!=null)}
                            margin={{left:100,right:30,top:0,bottom:0}}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                            <XAxis type="number" tick={{fill:C.muted,fontSize:10}} label={{value:"Odds Ratio",fill:C.muted,fontSize:10,position:"insideBottom",offset:-2}}/>
                            <YAxis type="category" dataKey="name" tick={{fill:C.text,fontSize:11}} width={95}/>
                            <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,fontSize:11}}
                              formatter={(v,n,p)=>[[`OR: ${p.payload.or} [${p.payload.or_lo}–${p.payload.or_hi}]`]]}/>
                            <Bar dataKey="or" radius={[0,4,4,0]}>
                              {result.coefs.filter(c=>c.or!=null).map((c,i)=><Cell key={i} fill={c.p!=null&&c.p<0.05?C.green:C.muted}/>)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{fontSize:10,color:C.muted,marginTop:4}}>Green = statistically significant (p&lt;0.05)</div>
                      </div>
                    )}
                  </>
                )}

                {/* AI Interpretation */}
                {interp&&(
                  <div style={{marginTop:20,background:C.surface,border:`1px solid ${C.purple}44`,borderRadius:10,padding:18}}>
                    <div style={{fontSize:11,color:C.purple,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>✨ AI Interpretation</div>
                    <RenderMD text={interp}/>
                  </div>
                )}
              </div>
            )}

            {result?.error&&(
              <div style={{...s.card,border:`1px solid ${C.red}44`,color:C.red}}>⚠ Error: {result.error}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
