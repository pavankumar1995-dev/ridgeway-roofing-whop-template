// Change branding, coverage, copy and prices here. Never put API keys in this file.
export const company = {
  name:'Ridgeway', descriptor:'ROOFING & EXTERIORS', city:'Austin', state:'TX',
  tagline:'Built for the weather. Made for home.',
  areas:['Austin','Round Rock','Cedar Park','Pflugerville','Georgetown','Leander'],
  email:'hello@ridgeway.example', phone:'(512) 555-0149', phoneUri:'+15125550149',
  demo:true,
  services:[
    {id:'inspection',title:'Know your roof.',name:'Roof inspection',price:149,unit:'one-time',icon:'scan',description:'A clear, photo-backed picture of your roof, without the guesswork.',includes:['Roof, flashing & ventilation check','Photo report with priority repairs','Written recommendations'],cta:'Book an inspection'},
    {id:'deposit',title:'A stronger start.',name:'Project deposit',price:500,unit:'credited to your project',icon:'home',description:'Reserve the next step on an approved repair or replacement proposal.',includes:['Applied to your signed project total','Schedule confirmed by your roofer','Final balance invoiced after the job'],cta:'Place a project deposit'},
    {id:'tuneup',title:'Small fix. Big relief.',name:'Roof tune-up',price:349,unit:'flat-rate service',icon:'tool',description:'Keep the small things from becoming the next big leak.',includes:['Seal up to 5 exposed fasteners','Reseal up to 2 pipe boots','Before & after photo summary'],cta:'Book a roof tune-up'},
  ],
};
export type Service = typeof company.services[number];
