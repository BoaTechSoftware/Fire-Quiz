(function(){
  const button=document.getElementById('themeToggle');
  const icon=document.querySelector('.theme-icon');
  function applyTheme(theme){
    document.body.dataset.theme=theme;
    icon.textContent=theme==='dark'?'☀':'☾';
    button.setAttribute('aria-label',theme==='dark'?'Activer le mode clair':'Activer le mode sombre');
    localStorage.setItem('fq-theme',theme);
  }
  button.addEventListener('click',()=>applyTheme(document.body.dataset.theme==='dark'?'light':'dark'));
  applyTheme(localStorage.getItem('fq-theme')||'light');
})();
