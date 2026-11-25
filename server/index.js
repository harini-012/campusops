require('dotenv').config();
require('node:dns').setServers(['8.8.8.8','1.1.1.1']); // fixes Atlas querySrv DNS errors; remove if not needed
const express=require('express'),mongoose=require('mongoose'),cors=require('cors'),jwt=require('jsonwebtoken'),bcrypt=require('bcryptjs'),crypto=require('crypto');
const {Schema,model}=mongoose,ref=n=>({type:Schema.Types.ObjectId,ref:n}),T={timestamps:true};
const User=model('User',new Schema({name:String,email:{type:String,unique:true},password:String,role:String,dept:String},T));
const Late=model('Late',new Schema({name:String,roll:String,dept:String,date:String,time:String,card:{type:String,default:'Collected'},by:ref('User')},T));
const Room=model('Room',new Schema({no:String,type:String,floor:Number,capacity:Number,facilities:[String],schedule:[{day:Number,start:String,end:String}],occupied:{type:Boolean,default:false}},T));
const Booking=model('Booking',new Schema({hall:String,date:String,start:String,end:String,purpose:String,by:ref('User'),status:{type:String,default:'Pending'},event:ref('Event')},T));
const Pass=model('Pass',new Schema({student:ref('User'),reason:String,date:String,outTime:String,returnTime:String,status:{type:String,default:'Pending'},code:String,exitAt:Date,returnAt:Date,loc:{lat:Number,lng:Number,dist:Number,inside:Boolean}},T));
const Event=model('Event',new Schema({title:String,desc:String,date:String,time:String,venue:String,teamSize:{type:Number,default:0},by:ref('User'),status:{type:String,default:'Pending'},code:String,regs:[{user:ref('User'),team:String,attended:{type:Boolean,default:false},fb:{rating:Number,comment:String}}]},T));
const Complaint=model('Complaint',new Schema({title:String,desc:String,category:String,dept:String,priority:{type:String,default:'Medium'},status:{type:String,default:'Open'},photo:String,by:ref('User'),assignedTo:ref('User'),resolution:String},T));
const Note=model('Note',new Schema({user:ref('User'),role:String,msg:String},T));
const Setting=model('Setting',new Schema({key:String,value:Object}));
const notify=(msg,{user,role}={})=>Note.create({msg,user,role});
const auth=(...roles)=>(q,s,n)=>{try{q.user=jwt.verify((q.headers.authorization||'').slice(7),process.env.JWT_SECRET)}catch{return s.status(401).json({error:'Please log in'})}
 if(roles.length&&!roles.includes(q.user.role))return s.status(403).json({error:'Not allowed for your role'});n()};
const h=f=>(q,s)=>f(q,s).catch(e=>s.status(400).json({error:e.message}));
const clash=(b,ig)=>Booking.exists({_id:{$ne:ig},hall:b.hall,date:b.date,status:'Approved',start:{$lt:b.end},end:{$gt:b.start}});
const geo=async()=>(await Setting.findOne({key:'geo'}))?.value||{lat:+process.env.CAMPUS_LAT||13.0827,lng:+process.env.CAMPUS_LNG||80.2707,radius:+process.env.CAMPUS_RADIUS||500};
const dist=(a,b,c,d)=>{const q=Math.PI/180,k=Math.sin((c-a)*q/2)**2+Math.cos(a*q)*Math.cos(c*q)*Math.sin((d-b)*q/2)**2;return 12742000*Math.asin(Math.sqrt(k))};
const free=r=>{const d=new Date(),t=d.toTimeString().slice(0,5);return !r.occupied&&!r.schedule.some(x=>x.day===d.getDay()&&t>=x.start&&t<x.end)};
const r=express.Router(),APP=['sa','ca','hod'],STAFF=['sa','ca','hod','fac'];

/* auth & users */
r.post('/auth/login',h(async(q,s)=>{const u=await User.findOne({email:q.body.email});if(!u||!await bcrypt.compare(q.body.password,u.password))throw Error('Wrong email or password');
 if(q.body.role&&q.body.role!==u.role)throw Error('This account does not belong to the role you selected');
 s.json({token:jwt.sign({id:u.id,role:u.role,name:u.name,dept:u.dept},process.env.JWT_SECRET,{expiresIn:'1d'}),user:{id:u.id,name:u.name,role:u.role,dept:u.dept}})}));
r.get('/users',auth(),h(async(q,s)=>s.json(await User.find(q.query.role?{role:q.query.role}:{}).select('-password'))));
r.post('/users',auth('sa'),h(async(q,s)=>{const u=await User.create({...q.body,password:await bcrypt.hash(q.body.password,10)});s.json({id:u.id})}));
r.delete('/users/:id',auth('sa'),h(async(q,s)=>{await User.findByIdAndDelete(q.params.id);s.json({ok:1})}));
r.get('/notifications',auth(),h(async(q,s)=>s.json(await Note.find({$or:[{user:q.user.id},{role:q.user.role}]}).sort('-createdAt').limit(30))));
r.get('/geofence',auth(),h(async(q,s)=>s.json(await geo())));
r.put('/geofence',auth('sa'),h(async(q,s)=>{await Setting.updateOne({key:'geo'},{value:{lat:+q.body.lat,lng:+q.body.lng,radius:+q.body.radius}},{upsert:true});s.json({ok:1})}));

/* 1 latecomers: admins view only, HOD/Faculty/Security record */
const LA=['sa','ca','hod','fac','sec'],LW=['hod','fac','sec'];
r.get('/late/report',auth(...LA),h(async(q,s)=>s.json({byDept:await Late.aggregate([{$group:{_id:'$dept',count:{$sum:1}}}]),repeat:await Late.aggregate([{$group:{_id:'$roll',name:{$first:'$name'},count:{$sum:1}}},{$match:{count:{$gte:3}}}])})));
r.get('/late',auth(...LA),h(async(q,s)=>{const L=await Late.find().sort('-createdAt').lean(),c={};L.forEach(x=>c[x.roll]=(c[x.roll]||0)+1);s.json(L.map(x=>({...x,times:c[x.roll]})))}));
r.post('/late',auth(...LW),h(async(q,s)=>{const l=await Late.create({...q.body,by:q.user.id});await notify(`${l.name} (${l.dept}) arrived late`,{role:'hod'});s.json(l)}));
r.patch('/late/:id/return',auth(...LW),h(async(q,s)=>s.json(await Late.findByIdAndUpdate(q.params.id,{card:'Returned'},{new:true}))));

/* 2 rooms */
r.get('/rooms',auth(),h(async(q,s)=>s.json((await Room.find()).map(x=>({...x.toObject(),available:free(x)})))));
r.post('/rooms',auth('sa','ca'),h(async(q,s)=>s.json(await Room.create(q.body))));
r.patch('/rooms/:id',auth(...STAFF),h(async(q,s)=>s.json(await Room.findByIdAndUpdate(q.params.id,q.body,{new:true}))));

/* 3 hall booking: only HOD / Faculty / Event Coordinator request; admins approve */
r.get('/halls',auth(...STAFF,'evc'),h(async(q,s)=>s.json(await Booking.find(APP.includes(q.user.role)?{}:{by:q.user.id}).populate('by','name').sort('-createdAt'))));
r.post('/halls',auth('hod','fac','evc'),h(async(q,s)=>{const b=q.body;if(b.start>=b.end)throw Error('End must be after start');if(await clash(b))throw Error('Hall already booked in that slot');
 const x=await Booking.create({...b,by:q.user.id,status:'Pending'});await notify(`Hall request: ${b.hall} on ${b.date}`,{role:'ca'});s.json(x)}));
r.patch('/halls/:id/status',auth(...APP),h(async(q,s)=>{const b=await Booking.findById(q.params.id);if(q.body.status==='Approved'&&await clash(b,b.id))throw Error('Clashes with an approved booking');b.status=q.body.status;await b.save();await notify(`Hall booking ${b.hall} ${b.date}: ${b.status}`,{user:b.by});s.json(b)}));
r.patch('/halls/:id/cancel',auth(...STAFF,'evc'),h(async(q,s)=>{const b=await Booking.findById(q.params.id);if(b.by!=q.user.id&&!APP.includes(q.user.role))throw Error('Not your booking');b.status='Cancelled';await b.save();await notify(`Hall booking ${b.hall} ${b.date} cancelled`,{user:b.by});s.json(b)}));

/* 4 gate pass + geofence */
const popP=x=>x.populate('student','name dept');
r.get('/passes',auth(...STAFF,'stu','sec'),h(async(q,s)=>s.json(await popP(Pass.find(q.user.role==='stu'?{student:q.user.id}:{}).sort('-createdAt')))));
r.post('/passes',auth('stu'),h(async(q,s)=>{const p=await Pass.create({...q.body,student:q.user.id,code:crypto.randomBytes(3).toString('hex').toUpperCase()});await notify(`Gate pass request from ${q.user.name}`,{role:'hod'});s.json(p)}));
r.patch('/passes/:id/status',auth(...STAFF),h(async(q,s)=>{const p=await Pass.findByIdAndUpdate(q.params.id,{status:q.body.status},{new:true});await notify(`Gate pass ${p.code}: ${p.status}`,{user:p.student});s.json(p)}));
r.post('/passes/verify',auth('sec'),h(async(q,s)=>{const p=await popP(Pass.findOne({code:String(q.body.code).toUpperCase()}));if(!p)throw Error('Invalid pass code');s.json(p)}));
r.patch('/passes/:id/exit',auth('sec'),h(async(q,s)=>{const p=await Pass.findById(q.params.id);if(p.status!=='Approved')throw Error('Pass is not approved');p.status='Out';p.exitAt=new Date();await p.save();await notify('You exited campus',{user:p.student});s.json(p)}));
r.patch('/passes/:id/return',auth('sec'),h(async(q,s)=>{const p=await Pass.findById(q.params.id);if(p.status!=='Out')throw Error('Student is not out');p.status='Returned';p.returnAt=new Date();await p.save();await notify('Return recorded',{user:p.student});s.json(p)}));
r.post('/passes/:id/location',auth('stu'),h(async(q,s)=>{const g=await geo(),d=dist(g.lat,g.lng,+q.body.lat,+q.body.lng),p=await Pass.findById(q.params.id);p.loc={lat:q.body.lat,lng:q.body.lng,dist:d,inside:d<=g.radius};await p.save();
 if(!p.loc.inside&&p.status==='Out')await notify(`${q.user.name} is outside the campus geofence (${Math.round(d)} m)`,{role:'sec'});s.json(p.loc)}));

/* 5 events */
r.get('/events',auth(),h(async(q,s)=>s.json(await Event.find().populate('regs.user','name').sort('-createdAt'))));
r.post('/events',auth('hod','fac','evc'),h(async(q,s)=>{const e=await Event.create({...q.body,by:q.user.id,code:crypto.randomBytes(3).toString('hex').toUpperCase()});await notify(`Event awaiting approval: ${e.title}`,{role:'ca'});s.json(e)}));
r.patch('/events/:id/status',auth('sa','ca'),h(async(q,s)=>{const e=await Event.findById(q.params.id);if(q.body.status==='Approved'){const hr=+e.time.slice(0,2),b={hall:e.venue,date:e.date,start:e.time,end:String(Math.min(23,hr+2)).padStart(2,'0')+e.time.slice(2)};if(await clash(b))throw Error('Venue already booked');await Booking.create({...b,purpose:'Event: '+e.title,by:e.by,status:'Approved',event:e.id})}
 e.status=q.body.status;await e.save();await notify(`Event "${e.title}" ${e.status}`,{user:e.by});s.json(e)}));
r.post('/events/:id/register',auth('stu'),h(async(q,s)=>{const e=await Event.findById(q.params.id);if(e.status!=='Approved')throw Error('Event not open');if(!e.regs.some(x=>x.user==q.user.id))e.regs.push({user:q.user.id,team:q.body.team});await e.save();await notify(`${q.user.name} registered for ${e.title}`,{user:e.by});s.json(e)}));
r.post('/events/:id/attend',auth('stu'),h(async(q,s)=>{const e=await Event.findById(q.params.id);if(String(q.body.code).toUpperCase()!==e.code)throw Error('Wrong code');const g=e.regs.find(x=>x.user==q.user.id);if(!g)throw Error('Not registered');g.attended=true;await e.save();s.json({ok:1})}));
r.post('/events/:id/present',auth('sa','ca','evc'),h(async(q,s)=>{const e=await Event.findById(q.params.id);e.regs.find(x=>x.user==q.body.user).attended=true;await e.save();s.json({ok:1})}));
r.post('/events/:id/feedback',auth('stu'),h(async(q,s)=>{const e=await Event.findById(q.params.id),g=e.regs.find(x=>x.user==q.user.id);if(!g?.attended)throw Error('Attend first');g.fb=q.body;await e.save();s.json({ok:1})}));
r.get('/events/:id/certificate',auth('stu'),h(async(q,s)=>{const e=await Event.findById(q.params.id),g=e.regs.find(x=>x.user==q.user.id);if(!g?.attended)throw Error('Certificate needs attendance');s.json({name:q.user.name,event:e.title,date:e.date})}));

/* 6 complaints */
r.get('/complaints',auth(...STAFF,'mnt','evc'),h(async(q,s)=>{const f=APP.includes(q.user.role)?{}:{$or:[{by:q.user.id},{assignedTo:q.user.id}]};s.json(await Complaint.find(f).populate('by assignedTo','name').sort('-createdAt'))}));
r.get('/complaints/report',auth(...APP),h(async(q,s)=>{const g=k=>Complaint.aggregate([{$group:{_id:'$'+k,count:{$sum:1}}}]);s.json({status:await g('status'),category:await g('category'),priority:await g('priority'),dept:await g('dept')})}));
r.post('/complaints',auth('fac','hod','evc'),h(async(q,s)=>{const c=await Complaint.create({...q.body,by:q.user.id});await notify(`New complaint: ${c.title}`,{role:'ca'});s.json(c)}));
r.patch('/complaints/:id/assign',auth(...APP),h(async(q,s)=>{const c=await Complaint.findByIdAndUpdate(q.params.id,{assignedTo:q.body.assignedTo,priority:q.body.priority,status:'Assigned'},{new:true});await notify(`Complaint "${c.title}" assigned to you`,{user:c.assignedTo});await notify(`Complaint "${c.title}" assigned`,{user:c.by});s.json(c)}));
r.patch('/complaints/:id/update',auth('mnt'),h(async(q,s)=>{const c=await Complaint.findOneAndUpdate({_id:q.params.id,assignedTo:q.user.id},{status:q.body.status,resolution:q.body.resolution},{new:true});if(!c)throw Error('Not assigned to you');await notify(`Complaint "${c.title}": ${c.status}`,{user:c.by});s.json(c)}));

const app=express();app.use(cors(),express.json({limit:'6mb'}));
app.use('/api',r);
module.exports={models:{User,Room}};
if(require.main===module)mongoose.connect(process.env.MONGO_URI).then(()=>app.listen(process.env.PORT||5000,()=>console.log('API on',process.env.PORT||5000))).catch(e=>console.error('DB connection failed:',e.message));