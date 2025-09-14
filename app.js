/* Fouques’t Suite — app.js v5 (API key required; key passed via query param) */
const DEFAULT_CONFIG = {
  apiBaseUrl: 'https://script.google.com/macros/s/AKfycbwPMFw8NYOwz0zZ1C87RG_jy13XNq4Z3k_WwHFNAR9HIA3vtUcdqNDRKThmB10MIIKnKw/exec',
  apiKey: localStorage.getItem('fs_key') || '',
};
function appState(){
  return {
    tab:'home',
    whoami:{ email:null, role:null },
    kpi:{ pertes7j:0, valeurStock:0, topPerdu:'-', progressMensuel:0, pertes7jSeries:[] },
    templates:[],
    zones: ['CF Poisson','CF Viande','Economat','Congélateur 1','Congélateur 2'],
    recettes: { query:'', mult:1, items:[] },
    rapports: { periode:'', type:'pdf_mensuel' },
    perte: { produit:'', qte:null, unite:'', motif:'', zone:'' },
    perteStatus:'',
    journalier: { selection:'', qte:null },
    journalierStatus:'',
    mensuel: { zone:'', action:'brouillon' },
    mensuelStatus:'',
    rapportsStatus:'', rapportUrl:'',
    config: { apiBaseUrl: localStorage.getItem('fs_api') || DEFAULT_CONFIG.apiBaseUrl, apiKey: localStorage.getItem('fs_key') || DEFAULT_CONFIG.apiKey },
    toast: { show:false, msg:'' },

    toastMsg(m){ this.toast.msg=m; this.toast.show=true; setTimeout(()=>this.toast.show=false, 1800); },
    saveConfig(){ localStorage.setItem('fs_api', this.config.apiBaseUrl||''); localStorage.setItem('fs_key', this.config.apiKey||''); this.toastMsg('✓ Config enregistrée'); this.refreshAll(); },

    async init(){ await this.refreshAll(); this.drawCharts(); },

    _requireKey(){ if(!(this.config.apiKey||'').trim()){ this.toastMsg('🔐 Saisis ta API Key'); throw new Error('API key required'); } },

    _u(path){ const base=this.config.apiBaseUrl.replace(/\/+$/,''); const p=(path||'').replace(/^\//,''); const k=encodeURIComponent((this.config.apiKey||'').trim()); return `${base}?path=${encodeURIComponent(p)}&key=${k}`; },

    async apiGet(path){ this._requireKey(); const r=await fetch(this._u(path)); return r.json(); },
    async apiPost(path, body){ this._requireKey(); const r=await fetch(this._u(path), { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body||{}) }); return r.json(); },

    async refreshAll(){ try{ const w=await this.apiGet('whoami'); if(w.ok) this.whoami=w.data; }catch(_ ){} try{ const k=await this.apiGet('kpi'); if(k.ok) this.kpi=k.data; }catch(_ ){} try{ const t=await this.apiGet('templates'); if(t.ok) this.templates=t.data; }catch(_ ){} try{ const r=await this.apiGet('recettes'); if(r.ok) this.recettes.items=r.data||[]; }catch(_ ){} },

    formatCurrency(v){ try{ return new Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR'}).format(v||0); }catch(e){ return (v||0)+' €'; } },
    filteredRecettes(){ const q=(this.recettes.query||'').toLowerCase().trim(); if(!q) return this.recettes.items;
      return this.recettes.items.filter(r => (r.nom||'').toLowerCase().includes(q) || (r.categorie||'').toLowerCase().includes(q) || (r.allergenes||'').toLowerCase().includes(q)); },
    scaleIngredients(ings){ const m=this.recettes.mult||1; return (ings||[]).map(it=>({...it, qte: Math.round((it.qte*m)*1000)/1000})); },

    async submitPerte(){ this.perteStatus='…'; try { if (!this.perte.produit || !this.perte.qte || this.perte.qte<=0 || !this.perte.unite) throw new Error('Champs invalides'); const j = await this.apiPost('mouvement', { type:'PERTE', ...this.perte }); if (!j.ok) throw new Error(j.error||'Erreur'); this.perte={ produit:'', qte:null, unite:'', motif:'', zone:'' }; this.perteStatus='✅ Perte enregistrée'; this.refreshKPI?.(); } catch(e){ this.perteStatus='❌ '+e.message; } },

    async submitMouvement(){ this.journalierStatus='…'; try { const t=this.templates.find(x=>x.code===this.journalier.selection); if(!t) throw new Error('Sélection invalide'); if(!this.journalier.qte || this.journalier.qte<=0) throw new Error('Quantité invalide'); const j=await this.apiPost('mouvement', { type:t.flux||'MVT', produit:t.produit, qte:this.journalier.qte, unite:t.unite, motif:t.flux, zone:t.zone||'' }); if (!j.ok) throw new Error(j.error||'Erreur'); this.journalier={ selection:'', qte:null }; this.journalierStatus='✅ Mouvement enregistré'; this.refreshAll(); } catch(e){ this.journalierStatus='❌ '+e.message; } },

    async doMensuelAction(){ this.mensuelStatus='…'; try { if(!this.mensuel.zone) throw new Error('Choisir une zone'); const j=await this.apiPost('inventaire-mensuel', this.mensuel); if(!j.ok) throw new Error(j.error||'Erreur'); this.mensuelStatus='✅ OK'; this.refreshAll(); } catch(e){ this.mensuelStatus='❌ '+e.message; } },

    async produire(recette){ try { const j=await this.apiPost('produire', { recetteId:recette.id, mult:this.recettes.mult||1 }); if(!j.ok) throw new Error('Erreur prod'); alert('✓ Production enregistrée'); this.refreshAll(); } catch(e){ alert('❌ '+e.message); } },

    async genererRapport(){ this.rapportsStatus='…'; this.rapportUrl=''; try { if(!this.rapports.periode) throw new Error('Choisir une période (AAAA-MM)'); const j=await this.apiPost('rapport', this.rapports); if(!j.ok) throw new Error('Erreur rapport'); this.rapportsStatus='✅ Généré'; if(j.data?.url) this.rapportUrl=j.data.url; } catch(e){ this.rapportsStatus='❌ '+e.message; } },

    drawCharts(){ const el=document.getElementById('chartPertes'); if(!el||!window.Chart) return;
      const labels=(this.kpi.pertes7jSeries||[]).map(x=>x.date);
      const data=(this.kpi.pertes7jSeries||[]).map(x=>x.kg);
      new Chart(el, { type:'line', data:{ labels, datasets:[{ label:'kg', data, tension:.35, fill:true }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } } });
    },
  };
}
