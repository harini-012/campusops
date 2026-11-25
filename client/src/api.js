const B=import.meta.env.VITE_API||'/api';
export async function api(p,m='GET',b){const t=localStorage.getItem('t');
 const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:b?JSON.stringify(b):undefined});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j}
