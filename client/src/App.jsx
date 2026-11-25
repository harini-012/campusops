import {useState,useEffect} from 'react';import {QRCodeSVG} from 'qrcode.react';import {api} from './api';
const DEPT=['CSE','ECE','MECH','CIVIL','IT','MBA'],HALLS=['Main Auditorium','Seminar Hall','Conference Room'],CAT=['Electrical','Plumbing','Furniture','IT / Network','Cleaning','Other'];
const ROLES={sa:'Super Admin',ca:'Campus Administrator',hod:'HOD',fac:'Faculty / Staff',stu:'Student',sec:'Security',mnt:'Maintenance',evc:'Event Coordinator'};
const MODS={late:['Latecomers','sa ca hod fac sec'],rooms:['Classrooms','sa ca hod fac stu sec mnt evc'],halls:['Hall booking','sa ca hod fac evc'],gate:['Gate pass','sa ca hod fac stu sec'],events:['Events','sa ca hod fac stu evc'],comp:['Complaints','sa ca hod fac mnt evc'],admin:['Admin','sa']};
const ICON={late:'⏰',rooms:'🏫',halls:'🏛️',gate:'🚪',events:'🎉',comp:'🛠️',admin:'⚙️'};
const run=async(fn,done)=>{try{await fn();done&&done()}catch(e){alert(e.message)}};
function useList(p){const[d,setD]=useState([]);const load=()=>api(p).then(setD).catch(e=>alert(e.message));useEffect(()=>{load()},[p]);return[d,load]}
function Form({f,go,label='Save'}){
 const[v,setV]=useState(()=>Object.fromEntries(f.map(x=>[x.n,x.d??(x.o?(x.o[0].v??x.o[0]):'')])));const set=(n,x)=>setV(p=>({...p,[n]:x}));
 const file=(n,e)=>{const r=new FileReader();r.onload=()=>set(n,r.result);e.target.files[0]&&r.readAsDataURL(e.target.files[0])};
 return <form className="f" onSubmit={e=>{e.preventDefault();run(()=>go(v))}}>{f.map(x=><label key={x.n}>{x.l}
  {x.o?<select value={v[x.n]} onChange={e=>set(x.n,e.target.value)}>{x.o.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}</select>
  :x.t==='file'?<input type="file" accept="image/*" onChange={e=>file(x.n,e)}/>:<input type={x.t||'text'} value={v[x.n]} required={!x.opt} onChange={e=>set(x.n,e.target.value)}/>}</label>)}<button>{label}</button></form>}
const Tbl=({h,rows})=><table><thead><tr>{h.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>):<tr><td colSpan={h.length}>Nothing here yet.</td></tr>}</tbody></table>;
const B=({go,children,d})=><button className={'b'+(d?' d':'')} onClick={()=>run(go.f||go,go.r)}>{children}</button>;
const Tag=({s})=>{const c=/Approved|Resolved|Returned|Free|Present/.test(s)?'ok':/Rejected|Cancelled|High|Occupied/.test(s)?'er':/Pending|Open|Out|Assigned|Progress|Collected|Medium/.test(s)?'wn':'';return <span className={'tag '+c}>{s}</span>};

function Late({u}){const[L,l]=useList('/late'),[rep,lr]=useList('/late/report');const R=()=>{l();lr()},can='hod fac sec'.includes(u.role);return <>
 <h2>Latecomer management</h2>
 {can?<div className="c"><h3>Record late arrival</h3><Form label="Record late arrival" go={async v=>{await api('/late','POST',v);R()}} f={[{n:'name',l:'Name'},{n:'roll',l:'Roll no.'},{n:'dept',l:'Department',o:DEPT},{n:'date',l:'Date',t:'date',d:new Date().toISOString().slice(0,10)},{n:'time',l:'Time',t:'time',d:new Date().toTimeString().slice(0,5)}]}/></div>
 :<div className="c note">Administrators can view records and reports. HODs, faculty and security record late arrivals.</div>}
 <div className="c"><Tbl h={['Student','Dept','When','Times late','ID card','']} rows={L.map(x=>[x.name+' ('+x.roll+')',x.dept,x.date+' '+x.time,x.times>=3?x.times+' – repeat':x.times,<Tag s={x.card}/>,x.card==='Collected'&&can&&<B go={{f:()=>api(`/late/${x._id}/return`,'PATCH'),r:R}}>Return ID</B>])}/></div>
 <div className="c"><h3>Report</h3>By department: {(rep.byDept||[]).map(d=>d._id+': '+d.count).join(' | ')||'—'}<br/>Repeat latecomers: {(rep.repeat||[]).map(d=>`${d.name} (${d._id}) ${d.count}×`).join(', ')||'None'}</div></>}

function Rooms({u}){const[rs,l]=useList('/rooms'),[fac,setF]=useState(''),[cap,setC]=useState(0);const can='sa ca hod fac'.includes(u.role);
 return <><h2>Classrooms &amp; labs</h2><div className="c f"><label>Facility<select value={fac} onChange={e=>setF(e.target.value)}><option value="">Any</option>{['Smart Board','Projector','Wi-Fi','AC','Computers'].map(x=><option key={x}>{x}</option>)}</select></label><label>Min seats<input type="number" value={cap} onChange={e=>setC(+e.target.value)}/></label></div>
 <div className="c"><Tbl h={['Room','Type','Floor','Seats','Facilities','Now','']} rows={rs.filter(r=>(!fac||r.facilities.includes(fac))&&r.capacity>=cap).map(r=>[r.no,r.type,r.floor,r.capacity,r.facilities.join(', '),<Tag s={r.available?'Free':'Occupied'}/>,can&&<B go={{f:()=>api('/rooms/'+r._id,'PATCH',{occupied:!r.occupied}),r:l}}>{r.occupied?'Mark free':'Mark occupied'}</B>])}/></div>
 {'sa ca'.includes(u.role)&&<div className="c"><h3>Add room</h3><Form label="Add room" go={async v=>{await api('/rooms','POST',{...v,facilities:v.fac.split(',').map(s=>s.trim()).filter(Boolean)});l()}} f={[{n:'no',l:'Room no.'},{n:'type',l:'Type',o:['Classroom','Laboratory']},{n:'floor',l:'Floor',t:'number'},{n:'capacity',l:'Seats',t:'number'},{n:'fac',l:'Facilities (comma-separated)',opt:1}]}/></div>}</>}

function Halls({u}){const[bs,l]=useList('/halls'),ap='sa ca hod'.includes(u.role),mk='hod fac evc'.includes(u.role);return <><h2>Hall booking</h2>
 {mk?<div className="c"><h3>New request</h3><Form label="Request booking" go={async v=>{await api('/halls','POST',v);l()}} f={[{n:'hall',l:'Hall',o:HALLS},{n:'date',l:'Date',t:'date'},{n:'start',l:'From',t:'time'},{n:'end',l:'To',t:'time'},{n:'purpose',l:'Purpose'}]}/></div>
 :<div className="c note">Administrators review and approve hall requests. Requests are made by faculty, HODs and event coordinators.</div>}
 <div className="c"><Tbl h={['Hall','When','Purpose','Requested by','Status','']} rows={bs.map(b=>[b.hall,`${b.date} ${b.start}–${b.end}`,b.purpose,b.by?.name,<Tag s={b.status}/>,<>{ap&&b.status==='Pending'&&<><B go={{f:()=>api(`/halls/${b._id}/status`,'PATCH',{status:'Approved'}),r:l}}>Approve</B><B d go={{f:()=>api(`/halls/${b._id}/status`,'PATCH',{status:'Rejected'}),r:l}}>Reject</B></>}{/Pending|Approved/.test(b.status)&&!b.event&&<B d go={{f:()=>api(`/halls/${b._id}/cancel`,'PATCH'),r:l}}>Cancel</B>}</>])}/></div></>}

function Gate({u}){const[ps,l]=useList('/passes'),[ver,setV]=useState(null),st='sa ca hod fac'.includes(u.role);
 const loc=p=>navigator.geolocation?navigator.geolocation.getCurrentPosition(q=>run(()=>api(`/passes/${p._id}/location`,'POST',{lat:q.coords.latitude,lng:q.coords.longitude}),l),()=>alert('Location blocked')):alert('GPS unavailable');
 return <><h2>Gate pass &amp; geo-fencing</h2>
 {u.role==='stu'&&<div className="c"><h3>Request a pass</h3><Form label="Request pass" go={async v=>{await api('/passes','POST',v);l()}} f={[{n:'reason',l:'Reason'},{n:'date',l:'Date',t:'date'},{n:'outTime',l:'Exit time',t:'time'},{n:'returnTime',l:'Return by',t:'time'}]}/></div>}
 {u.role==='sec'&&<div className="c"><h3>Verify a pass</h3><Form label="Verify pass" go={async v=>setV(await api('/passes/verify','POST',v))} f={[{n:'code',l:'Scan / enter pass code'}]}/>{ver&&<p><b>{ver.student?.name}</b> – {ver.reason} – <Tag s={ver.status}/></p>}</div>}
 {u.role==='stu'&&ps.filter(p=>/Approved|Out/.test(p.status)).map(p=><div className="c" key={p._id}><QRCodeSVG value={p.code} size={110}/><p>Pass {p.code} <Tag s={p.status}/> {p.loc?.dist!=null&&`Last GPS check: ${p.loc.inside?'inside':'outside'} (${Math.round(p.loc.dist)} m)`}</p><button className="b" onClick={()=>loc(p)}>Check my GPS</button></div>)}
 <div className="c"><Tbl h={['Pass','Student','Reason','Status','Exit / return','']} rows={ps.map(p=>[p.code,p.student?.name,`${p.reason} (${p.date} ${p.outTime}→${p.returnTime})`,<Tag s={p.status}/>,[p.exitAt&&'Out '+new Date(p.exitAt).toLocaleTimeString(),p.returnAt&&'In '+new Date(p.returnAt).toLocaleTimeString()].filter(Boolean).join(' / ')||'—',<>
  {st&&p.status==='Pending'&&<><B go={{f:()=>api(`/passes/${p._id}/status`,'PATCH',{status:'Approved'}),r:l}}>Approve</B><B d go={{f:()=>api(`/passes/${p._id}/status`,'PATCH',{status:'Rejected'}),r:l}}>Reject</B></>}
  {u.role==='sec'&&p.status==='Approved'&&<B go={{f:()=>api(`/passes/${p._id}/exit`,'PATCH'),r:l}}>Mark exit</B>}{u.role==='sec'&&p.status==='Out'&&<B go={{f:()=>api(`/passes/${p._id}/return`,'PATCH'),r:l}}>Mark return</B>}</>])}/></div></>}

function Events({u}){const[es,l]=useList('/events'),[cert,setC]=useState(null),ap='sa ca'.includes(u.role);return <><h2>College events</h2>
 {'hod fac evc'.includes(u.role)&&<div className="c"><h3>Create an event</h3><Form label="Submit for approval" go={async v=>{await api('/events','POST',v);l()}} f={[{n:'title',l:'Title'},{n:'date',l:'Date',t:'date'},{n:'time',l:'Time',t:'time'},{n:'venue',l:'Venue',o:HALLS},{n:'teamSize',l:'Team size (0 = individual)',t:'number',d:0},{n:'desc',l:'Description',opt:1}]}/></div>}
 {cert&&<div className="c" style={{textAlign:'center',border:'4px double #4338ca'}}><p>Certificate of participation</p><h1>{cert.name}</h1><p>participated in <b>{cert.event}</b> on {cert.date}</p><button className="b" onClick={()=>window.print()}>Print</button><button className="b d" onClick={()=>setC(null)}>Close</button></div>}
 {es.map(e=>{const my=e.regs.find(r=>r.user?._id===u.id);return <div className="c" key={e._id}><b>{e.title}</b> <Tag s={e.status}/> <span className="mu">{e.date} {e.time} · {e.venue} · {e.teamSize?'Team of '+e.teamSize:'Individual'}</span><p>{e.desc}</p>
  {ap&&e.status==='Pending'&&<><B go={{f:()=>api(`/events/${e._id}/status`,'PATCH',{status:'Approved'}),r:l}}>Approve</B><B d go={{f:()=>api(`/events/${e._id}/status`,'PATCH',{status:'Rejected'}),r:l}}>Reject</B></>}
  {u.role==='stu'&&e.status==='Approved'&&(!my?<Form label="Register" go={async v=>{await api(`/events/${e._id}/register`,'POST',v);l()}} f={e.teamSize?[{n:'team',l:'Team name'}]:[{n:'team',l:'Team (optional)',opt:1}]}/>
   :!my.attended?<Form label="Mark attendance" go={async v=>{await api(`/events/${e._id}/attend`,'POST',v);l()}} f={[{n:'code',l:'Scan event QR (enter code)'}]}/>
   :!my.fb?.rating?<Form label="Send feedback" go={async v=>{await api(`/events/${e._id}/feedback`,'POST',v);l()}} f={[{n:'rating',l:'Rating',o:[5,4,3,2,1]},{n:'comment',l:'Comment',opt:1}]}/>
   :<B go={async()=>setC(await api(`/events/${e._id}/certificate`))}>View certificate</B>)}
  {'sa ca evc hod fac'.includes(u.role)&&e.status==='Approved'&&<div><QRCodeSVG value={e.code} size={90}/> Attendance code: <b>{e.code}</b>
   <Tbl h={['Participant','Team','Attended','Feedback','']} rows={e.regs.map(r=>[r.user?.name,r.team||'—',r.attended?'Yes':'No',r.fb?.rating?`${r.fb.rating}/5 ${r.fb.comment||''}`:'—',!r.attended&&<B go={{f:()=>api(`/events/${e._id}/present`,'POST',{user:r.user._id}),r:l}}>Mark present</B>])}/></div>}</div>})}</>}

function Complaints({u}){const[cs,l]=useList('/complaints'),[mn]=useList('/users?role=mnt'),[rep,lr]=useList('/complaints/report');const ap='sa ca hod'.includes(u.role);const R=()=>{l();ap&&lr()};
 return <><h2>Complaints</h2>{'fac hod evc'.includes(u.role)&&<div className="c"><h3>Raise a complaint</h3><Form label="Raise complaint" go={async v=>{await api('/complaints','POST',v);R()}} f={[{n:'title',l:'Title'},{n:'category',l:'Category',o:CAT},{n:'dept',l:'Department',o:DEPT},{n:'desc',l:'Details',opt:1},{n:'photo',l:'Photo',t:'file',opt:1}]}/></div>}
 {cs.map(c=><div className="c" key={c._id}><b>{c.title}</b> <Tag s={c.status}/> <Tag s={c.priority}/> <span className="mu">{c.category} · {c.dept} · by {c.by?.name} · assigned: {c.assignedTo?.name||'—'}</span><p>{c.desc}</p>{c.photo&&<img className="ph" src={c.photo} alt="Complaint"/>}{c.resolution&&<p><b>Resolution:</b> {c.resolution}</p>}
  {ap&&c.status!=='Resolved'&&<Form label="Assign" go={async v=>{await api(`/complaints/${c._id}/assign`,'PATCH',v);R()}} f={[{n:'assignedTo',l:'Assign to',o:mn.map(m=>({v:m._id,l:m.name}))},{n:'priority',l:'Priority',o:['Low','Medium','High']}]}/>}
  {u.role==='mnt'&&c.status!=='Resolved'&&<Form label="Update" go={async v=>{await api(`/complaints/${c._id}/update`,'PATCH',v);R()}} f={[{n:'status',l:'Status',o:['In Progress','Resolved']},{n:'resolution',l:'Note'}]}/>}</div>)}
 {ap&&<div className="c"><h3>Report</h3>{['status','category','priority','dept'].map(k=><div key={k}>By {k}: {(rep[k]||[]).map(x=>x._id+': '+x.count).join(' | ')}</div>)}</div>}</>}

function Admin(){const[us,l]=useList('/users'),[g,setG]=useState(null);useEffect(()=>{api('/geofence').then(setG)},[]);return <><h2>Administration</h2>
 <div className="c"><h3>Add user</h3><Form label="Add user" go={async v=>{await api('/users','POST',v);l()}} f={[{n:'name',l:'Name'},{n:'email',l:'Email',t:'email'},{n:'password',l:'Password',t:'password'},{n:'role',l:'Role',o:Object.entries(ROLES).map(([v,l])=>({v,l}))},{n:'dept',l:'Dept',o:['',...DEPT]}]}/></div>
 <div className="c"><Tbl h={['Name','Email','Role','Dept','']} rows={us.map(x=>[x.name,x.email,ROLES[x.role],x.dept||'—',<B d go={{f:()=>api('/users/'+x._id,'DELETE'),r:l}}>Remove</B>])}/></div>
 {g&&<div className="c"><h3>Campus geofence</h3><Form label="Save geofence" go={v=>api('/geofence','PUT',v)} f={[{n:'lat',l:'Latitude',d:g.lat},{n:'lng',l:'Longitude',d:g.lng},{n:'radius',l:'Radius (m)',d:g.radius}]}/></div>}</>}

function Login({onLogin}){
 const[role,setRole]=useState('stu'),[email,setEmail]=useState('student@c.edu'),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
 const demo={sa:'admin',ca:'campus',hod:'hod',fac:'faculty',stu:'student',sec:'security',mnt:'maint',evc:'event'};
 const pick=r=>{setRole(r);setEmail(demo[r]+'@c.edu')};
 const go=async e=>{e.preventDefault();setBusy(true);try{const r=await api('/auth/login','POST',{email,password,role});localStorage.setItem('t',r.token);localStorage.setItem('u',JSON.stringify(r.user));onLogin(r.user)}catch(x){alert(x.message)}setBusy(false)};
 return <div className="login"><div className="hero"><h1>CampusOps</h1><p>Latecomers, classrooms, halls, gate passes, events and complaints in one place.</p></div>
  <form className="lf" onSubmit={go}><h2>Sign in</h2><p className="mu">Choose your role first</p>
   <div className="roles">{Object.entries(ROLES).map(([k,v])=><button type="button" key={k} className={'rc'+(role===k?' on':'')} onClick={()=>pick(k)}>{v}</button>)}</div>
   <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
   <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
   <button className="b big" disabled={busy}>{busy?'Signing in…':'Sign in as '+ROLES[role]}</button></form></div>}

export default function App(){const[u,setU]=useState(()=>JSON.parse(localStorage.getItem('u')||'null')),[tab,setTab]=useState(''),[nt,setNt]=useState([]),[show,setShow]=useState(false);
 useEffect(()=>{u&&api('/notifications').then(setNt).catch(()=>{})},[u,tab]);
 if(!u)return <Login onLogin={x=>{setU(x);setTab('')}}/>;
 const ok=Object.keys(MODS).filter(k=>MODS[k][1].split(' ').includes(u.role)),cur=ok.includes(tab)?tab:ok[0],P={late:Late,rooms:Rooms,halls:Halls,gate:Gate,events:Events,comp:Complaints,admin:Admin}[cur];
 return <div className="app"><aside><div className="brand">CampusOps</div>
  <nav>{ok.map(k=><button key={k} className={k===cur?'on':''} onClick={()=>{setTab(k);setShow(false)}}><span>{ICON[k]}</span>{MODS[k][0]}</button>)}</nav>
  <div className="me"><b>{u.name}</b><small>{ROLES[u.role]}{u.dept?' · '+u.dept:''}</small><button className="b d" onClick={()=>{localStorage.clear();setU(null)}}>Sign out</button></div></aside>
  <div className="body"><div className="top"><span>{MODS[cur][0]}</span><button className="bell" onClick={()=>setShow(!show)}>🔔 {nt.length}</button></div>
   {show&&<div className="pn">{nt.map(n=><p key={n._id}>{n.msg}<small>{new Date(n.createdAt).toLocaleString()}</small></p>)}{!nt.length&&<p>No notifications.</p>}</div>}
   <main><P u={u}/></main></div></div>}