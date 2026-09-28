export const INTRO_SEEN_KEY = "solidity:intro-seen";

/**
 * Runs in <head> before first paint so the landing page never flashes under
 * the intro. Landing page only; plays once per session; `?intro=1` forces a
 * replay; reduced-motion users skip it. It also sets the stage
 * scale so the animation can begin at first paint, before the app loads. A failsafe releases the page if the
 * app bundle never loads.
 */
export const INTRO_BOOT_SCRIPT = `(function(){try{if(location.pathname!=='/')return;var d=document.documentElement;var force=/[?&]intro=1/.test(location.search);if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;if(!force&&sessionStorage.getItem('${INTRO_SEEN_KEY}'))return;d.style.setProperty('--ix-s',String(Math.min(innerHeight/900,innerWidth/760,1.2)));d.setAttribute('data-intro','playing');setTimeout(function(){var o=document.querySelector('.ix-overlay');if(o)o.classList.add('ix-run')},2500);setTimeout(function(){var s=d.getAttribute('data-intro');if(s==='playing'||s==='revealing')d.setAttribute('data-intro','done')},9000)}catch(e){}})();`;
