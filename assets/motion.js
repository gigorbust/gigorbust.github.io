(()=>{"use strict";
/* Footer year. Runs before the reduced-motion guard below so it can never
   be skipped; the hardcoded year in the HTML is the no-JS fallback. */
for(const el of document.querySelectorAll("[data-year]"))el.textContent=new Date().getFullYear();
if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
const d=document,h=d.documentElement;
h.classList.add("js");
const io=new IntersectionObserver(es=>{
  for(const x of es)if(x.isIntersecting){x.target.classList.add("in");io.unobserve(x.target)}
},{rootMargin:"0px 0px -10% 0px",threshold:.12});
d.querySelectorAll("[data-reveal],[data-stagger]").forEach(el=>io.observe(el));
if(!("startViewTransition"in d)){
  h.classList.add("vt-fb");
  d.addEventListener("click",e=>{
    const a=e.target.closest("a[href]");
    if(!a||a.target||a.hasAttribute("download")||a.origin!==location.origin||a.pathname===location.pathname)return;
    e.preventDefault();h.classList.add("vt-out");
    setTimeout(()=>location.assign(a.href),200);
  });
  addEventListener("pageshow",e=>{if(e.persisted)h.classList.remove("vt-out")});
}
})();
