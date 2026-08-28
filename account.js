(async function(){
  const link=document.getElementById('accountButton');
  if(!link)return;
  link.onclick=null;
  try{const response=await fetch('/api/me');const {user}=await response.json();if(user){link.textContent=user.role==='admin'?'Administration':'Mon espace';link.href=user.role==='admin'?'/admin.html':'/auth.html';}}catch{ /* Le site peut toujours être utilisé hors-ligne en démonstration. */ }
})();
