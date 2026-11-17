declare global { interface Window {whop?:{track:(name:string,data?:Record<string,unknown>)=>void};roofingEvents?:unknown[]} }
export function track(name:string,data:Record<string,unknown>={}){
 const event={name,...data,event_id:crypto.randomUUID(),at:new Date().toISOString()};
 window.roofingEvents=[...(window.roofingEvents||[]),event].slice(-100);
 if(window.whop?.track)window.whop.track(name,event);
 else console.info('[Whop pixel unavailable outside hosted deployment]',event);
 window.dispatchEvent(new Event('roofing:event'));
}
