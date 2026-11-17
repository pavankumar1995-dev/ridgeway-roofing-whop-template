/** Owner-only final invoice demo. Sandbox enforced. No emails or charges by default. */
import {readFile,writeFile} from 'node:fs/promises';
const [file,action='draft']=process.argv.slice(2);
if(!file)throw new Error('Usage: node scripts/invoice.mjs job.json [draft|issue-manual|charge-authorized]');
const job=JSON.parse(await readFile(file,'utf8'));
if(!process.env.WHOP_SANDBOX_API_KEY)throw new Error('WHOP_SANDBOX_API_KEY is required. This script never uses production.');
if(!Number.isInteger(job.totalCents)||!Number.isInteger(job.depositCents)||job.totalCents<=job.depositCents||job.depositCents<0)throw new Error('Use verified positive integer amounts in cents.');
if(!job.memberId||!job.accountId||!job.depositPaymentId||!job.workApproved)throw new Error('Verified member, account, deposit payment, and work approval are required.');
const balance=(job.totalCents-job.depositCents)/100;
async function api(path,body){const r=await fetch('https://sandbox-api.whop.com/api/v1'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+process.env.WHOP_SANDBOX_API_KEY,'Content-Type':'application/json','Api-Version-Date':'2026-11-10-1'},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw new Error(JSON.stringify({status:r.status,error:d.error}));return d;}
// Server-side reconciliation: never trust a browser's "success" flag.
const deposit=await api('/payments/'+encodeURIComponent(job.depositPaymentId));
if(deposit.status!=='paid')throw new Error('Deposit is not confirmed paid');
if(deposit.account_id!==job.accountId||deposit.member_id!==job.memberId||deposit.total?.currency!=='usd')throw new Error('Deposit owner, customer or currency mismatch.');
if(Number(deposit.refunded_amount?.amount||0)>0)throw new Error('Deposit has refunds. Reconcile before invoicing.');
// Deposit credit is the service subtotal. Tax paid is not credited against pre-tax work.
if(deposit.subtotal?.currency!=='usd'||Math.round(Number(deposit.subtotal?.amount??-1)*100)!==job.depositCents)throw new Error('Deposit amount mismatch. Inspect the API record before continuing.');
if(action==='charge-authorized'&&(!job.paymentMethodId||!job.customerChargeAuthorization))throw new Error('Stored method and specific customer charge authorization required.');
let invoice=job.invoiceId?await api('/invoices/'+encodeURIComponent(job.invoiceId)):await api('/invoices',{account_id:job.accountId,member_id:job.memberId,items:[{variant:{currency:'usd',billing_type:'one_time',initial_price:balance,title:'Roofing final balance',visibility:'hidden'},quantity:1,description:'Approved job '+job.jobId+'. Total $'+(job.totalCents/100).toFixed(2)+' less verified deposit $'+(job.depositCents/100).toFixed(2)}],memo:'Final balance for '+job.jobId,metadata:{job_id:job.jobId,deposit_payment_id:job.depositPaymentId},...(action==='charge-authorized'?{payment_method_id:job.paymentMethodId}:{})});
await writeFile(file,JSON.stringify({...job,invoiceId:invoice.id},null,2));
console.log(JSON.stringify({event:'invoice_created',id:invoice.id,status:invoice.status,balance,checkout_url:invoice.checkout_url??invoice.hosted_invoice_url},null,2));
if(action==='draft')process.exit(0);
if(!['issue-manual','charge-authorized'].includes(action))throw new Error('Unknown action. Draft created only.');
invoice=await api('/invoices/'+invoice.id+'/issue',{});
console.log(JSON.stringify({event:'invoice_issued',id:invoice.id,status:invoice.status,checkout_url:invoice.checkout_url??invoice.hosted_invoice_url},null,2));
