/** Sandbox-only catalog provisioning. Requires an already selected sandbox business. */
import {writeFile} from 'node:fs/promises';
const key=process.env.WHOP_SANDBOX_API_KEY,account=process.env.WHOP_SANDBOX_ACCOUNT_ID;
if(!key||!account)throw new Error('Set WHOP_SANDBOX_API_KEY and WHOP_SANDBOX_ACCOUNT_ID securely.');
async function api(path,body){const r=await fetch('https://sandbox-api.whop.com/api/v1'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Api-Version-Date':'2026-11-10-1'},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw new Error('Whop '+r.status+': '+JSON.stringify(d.error));return d;}
const catalog=[['inspection','Roof inspection',149],['deposit','Project deposit',500],['tuneup','Roof tune-up',349]];
const products=await api('/products?account_id='+account+'&first=100');const plans={};
for(const [slug,title,price]of catalog){
 let product=(products.data||[]).find(p=>p.metadata?.roofing_template===slug);
 if(!product)product=await api('/products',{account_id:account,title,visibility:'hidden',description:'Ridgeway roofing template sandbox demo. No real service is booked.',send_welcome_message:false,metadata:{roofing_template:slug}});
 const variants=await api('/variants?account_id='+account+'&product_id='+product.id+'&first=100');
 let plan=(variants.data||[]).find(p=>p.metadata?.roofing_template===slug);
 if(!plan)plan=await api('/variants',{account_id:account,product_id:product.id,title,billing_type:'one_time',initial_price:price,currency:'usd',visibility:'hidden',release_method:'buy_now',unlimited_stock:true,metadata:{roofing_template:slug}});
 plans[slug]=plan.id;console.log(JSON.stringify({service:slug,product_id:product.id,plan_id:plan.id,price}));
}
await writeFile('catalog.sandbox.json',JSON.stringify({account_id:account,plans},null,2));
