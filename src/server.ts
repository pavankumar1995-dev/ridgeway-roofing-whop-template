import {Hono} from 'hono';
import {secureHeaders} from 'hono/secure-headers';
type Env={ASSETS?:{fetch:(request:Request)=>Promise<Response>};[key:string]:unknown};
const app=new Hono<{Bindings:Env}>();
app.use('*',secureHeaders({crossOriginEmbedderPolicy:false,referrerPolicy:'strict-origin-when-cross-origin'}));
const env=(c:any,key:string)=>String(c.env?.[key]??process.env[key]??'');
const sandbox=(c:any)=>env(c,'WHOP_ENVIRONMENT')!=='production';
const account=(c:any)=>env(c,sandbox(c)?'WHOP_SANDBOX_ACCOUNT_ID':'WHOP_ACCOUNT_ID');
class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
async function whop(c:any,path:string,body?:unknown,memberOnly=false){
 const liveMember=memberOnly&&env(c,'WHOP_MEMBER_ENVIRONMENT')==='production';
 const base=liveMember?'https://api.whop.com':sandbox(c)?'https://sandbox-api.whop.com':env(c,'WHOP_API_ORIGIN')||'https://api.whop.com';
 const key=env(c,liveMember?'WHOP_MEMBER_API_KEY':sandbox(c)?'WHOP_SANDBOX_API_KEY':'WHOP_API_KEY');
 if(!(liveMember?env(c,'WHOP_MEMBER_ACCOUNT_ID'):account(c))||!key)throw new ApiError(503,'This demo is awaiting Whop account configuration. Nothing has been submitted.');
 const headers:Record<string,string>={'Content-Type':'application/json','Api-Version-Date':'2026-11-10-1'};
 if(key)headers.Authorization='Bearer '+key;
 const res=await fetch(base+'/api/v1'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
 const data=await res.json() as any;
  if(!res.ok){console.error('whop_request_failed',{path,status:res.status,code:data.error?.code,message:String(data.error?.message||data.message||'').slice(0,300)});throw new ApiError(res.status===429?429:502,'Whop could not complete this request. Please try again or contact the business.');}
 return data;
}
app.onError((err,c)=>{const error=err as ApiError;console.error('handler_error',error.name,error.message);return c.json({error:error instanceof ApiError?error.message:'Request could not be processed.'},(error.status||500) as any)});
app.use('/api/*',async(c,next)=>{
 c.header('Cache-Control','no-store');
 if(c.req.method==='POST'){
  const origin=c.req.header('origin');if(!origin||origin!==new URL(c.req.url).origin)return c.json({error:'Origin not allowed'},403);
  if(Number(c.req.header('content-length')||0)>8192)return c.json({error:'Request too large'},413);
 }
 try{await next()}catch(e){const err=e as ApiError;return c.json({error:err.message||'Request failed'},(err.status||500) as any)}
});
app.get('/api/config',c=>c.json({environment:sandbox(c)?'sandbox':'production',memberEnvironment:env(c,'WHOP_MEMBER_ENVIRONMENT')||'sandbox',accountId:account(c),plans:{inspection:env(c,'WHOP_INSPECTION_PLAN_ID'),deposit:env(c,'WHOP_DEPOSIT_PLAN_ID'),tuneup:env(c,'WHOP_TUNEUP_PLAN_ID')},configured:!!account(c)&&!!env(c,'WHOP_INSPECTION_PLAN_ID')}));
const attempts=new Map<string,number>();
app.post('/api/estimate',async c=>{
 const d=await c.req.json();
 if(d.website)return c.json({error:'Request could not be processed'},400);
 const name=String(d.name||'').trim(),email=String(d.email||'').trim().toLowerCase(),zip=String(d.zip||'');
 if(!name||name.length>100||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||!/^\d{5}$/.test(zip)||!d.consent||String(d.message||'').length>1500)return c.json({error:'Check your name, email, ZIP code and consent.'},400);
 const key=(c.req.header('cf-connecting-ip')||c.req.header('x-forwarded-for')||'visitor')+':'+email;
 if((attempts.get(key)||0)>Date.now()-60000)return c.json({error:'Please wait a minute before sending another request.'},429);
 attempts.set(key,Date.now());if(attempts.size>5000)attempts.clear();
 // Whop retired Leads (HTTP 410). Supported replacement: Create Member (POST /members). Success only when Whop returns a real member id.
 const member=await whop(c,'/members',{account_id:env(c,'WHOP_MEMBER_ENVIRONMENT')==='production'?env(c,'WHOP_MEMBER_ACCOUNT_ID'):account(c),email,name},true);
 if(!member.id||!/^mber_/.test(String(member.id)))throw new ApiError(502,'Whop returned no member reference. Please contact the business.');
 return c.json({id:member.id,kind:'member'},201);
});
// Sandbox demo only. Production must bind this to the authenticated buyer and durable job.
app.get('/api/payment-status',async c=>{
 if(!sandbox(c))return c.json({error:'Authenticated production job workflow required'},403);
 const id=c.req.query('id')||'';if(!/^pay_[A-Za-z0-9]+$/.test(id))return c.json({error:'Invalid payment'},400);
 const p=await whop(c,'/payments/'+id);if(p.account_id!==account(c))return c.json({error:'Not found'},404);
 return c.json({paid:p.status==='paid'&&Number(p.refunded_amount?.amount||0)===0,planId:p.variant_id});
});
const depositSetups=new Map<string,string>();
app.post('/api/deposit-setup',async c=>{
 if(!sandbox(c))return c.json({error:'Authenticated production job workflow required'},403);
 const d=await c.req.json();if(!/^pay_[A-Za-z0-9]+$/.test(d.paymentId||''))return c.json({error:'Invalid payment'},400);
 const payment=await whop(c,'/payments/'+d.paymentId);
 if(payment.status!=='paid'||payment.account_id!==account(c)||payment.variant_id!==env(c,'WHOP_DEPOSIT_PLAN_ID')||!payment.payment_method_id||Number(payment.refunded_amount?.amount||0)>0)return c.json({error:'Verified deposit required'},400);
 let id=depositSetups.get(payment.id);
 if(!id){const setup=await whop(c,'/setup_intents',{account_id:account(c),payment_method_id:payment.payment_method_id,currency:'usd',metadata:{purpose:'roofing_final_balance_sandbox',deposit_payment_id:payment.id}});id=setup.id;depositSetups.set(payment.id,id!);}
 const setup=await whop(c,'/setup_intents/'+id);return c.json({id:setup.id,status:setup.status});
});
app.post('/api/setup',async c=>{
 const d=await c.req.json();if(!/^ctok_[A-Za-z0-9]+$/.test(d.confirmation_token||''))return c.json({error:'Invalid confirmation token'},400);
 const setup=await whop(c,'/setup_intents',{account_id:account(c),confirmation_token:d.confirmation_token,currency:'usd',return_url:new URL(c.req.url).origin+'/?setup_return=1',metadata:{purpose:'roofing_final_balance',authorization:'Separate agreed invoice amount required before collection'}});
 // Opaque HTTP-only cookie binds status reads to this browser, not any guessed ID.
 c.header('Set-Cookie','roofing_setup='+encodeURIComponent(setup.id)+'; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=3600');
 return c.json({id:setup.id,client_secret:setup.client_secret,status:setup.status});
});
app.get('/api/setup-status',async c=>{
 const id=c.req.query('id')||'';const cookie=c.req.header('cookie')||'';
 if(!/^sint_[A-Za-z0-9]+$/.test(id)||!cookie.split(';').some(x=>x.trim()==='roofing_setup='+encodeURIComponent(id)))return c.json({error:'Setup not found'},404);
 const setup=await whop(c,'/setup_intents/'+id);return c.json({id:setup.id,status:setup.status});
});
// Invoice creation intentionally has NO anonymous HTTP route. Use the owner-only
// CLI script with sandbox credentials; never let a visitor set an invoice amount.
app.get('/api/health',c=>c.json({status:'ok',environment:sandbox(c)?'sandbox':'production'}));
app.all('/api/*',c=>c.json({error:'Not found'},404));
app.get('/',c=>c.redirect('/index.html',302));
app.get('*',c=>c.text('Not found',404));
export default app;
