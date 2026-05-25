import { useState, useRef, useEffect, useCallback } from "react";

// ══ UTILS ══════════════════════════════════════════════════════════

function encodeWav(ab) {
  const nc=ab.numberOfChannels,sr=ab.sampleRate,n=ab.length;
  const buf=new ArrayBuffer(44+n*nc*2),v=new DataView(buf);
  const ws=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  ws(0,'RIFF');v.setUint32(4,36+n*nc*2,true);ws(8,'WAVE');
  ws(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);
  v.setUint16(22,nc,true);v.setUint32(24,sr,true);v.setUint32(28,sr*nc*2,true);
  v.setUint16(32,nc*2,true);v.setUint16(34,16,true);
  ws(36,'data');v.setUint32(40,n*nc*2,true);
  let off=44;
  for(let i=0;i<n;i++) for(let c=0;c<nc;c++){
    const s=Math.max(-1,Math.min(1,ab.getChannelData(c)[i]));
    v.setInt16(off,s<0?s*0x8000:s*0x7FFF,true);off+=2;
  }
  return buf;
}

function stripSilences(buf,thr,minSec){
  const sr=buf.sampleRate,nc=buf.numberOfChannels,d=buf.getChannelData(0);
  const minSamp=Math.floor(minSec*sr),keeps=[];
  let inSil=false,ss=0,ks=0;
  for(let i=0;i<d.length;i++){
    const a=Math.abs(d[i]);
    if(!inSil&&a<thr){inSil=true;ss=i;}
    else if(inSil&&a>=thr){inSil=false;if(i-ss>=minSamp){keeps.push([ks,ss]);ks=i;}}
  }
  if(inSil&&d.length-ss>=minSamp)keeps.push([ks,ss]);
  else keeps.push([ks,d.length]);
  const total=keeps.reduce((a,[s,e])=>a+(e-s),0);
  const out=new AudioBuffer({numberOfChannels:nc,length:Math.max(1,total),sampleRate:sr});
  for(let c=0;c<nc;c++){
    const src=buf.getChannelData(c),dst=out.getChannelData(c);
    let off=0;for(const[s,e]of keeps){dst.set(src.subarray(s,e),off);off+=e-s;}
  }
  return{out,removed:((buf.length-total)/sr)};
}

function useLS(key,def){
  const[val,setVal]=useState(()=>{try{const s=localStorage.getItem(key);return s!==null?JSON.parse(s):def;}catch{return def;}});
  const set=useCallback(v=>{setVal(v);try{localStorage.setItem(key,JSON.stringify(v));}catch{};},[key]);
  return[val,set];
}

const PLATFORMS=[
  {match:/youtube|youtu\.be/i,name:'YouTube',color:'#FF0000'},
  {match:/instagram/i,name:'Instagram',color:'#E1306C'},
  {match:/tiktok/i,name:'TikTok',color:'#00F2EA'},
  {match:/twitter|x\.com/i,name:'Twitter/X',color:'#1DA1F2'},
  {match:/reddit/i,name:'Reddit',color:'#FF4500'},
  {match:/twitch/i,name:'Twitch',color:'#9146FF'},
  {match:/vimeo/i,name:'Vimeo',color:'#1AB7EA'},
  {match:/facebook/i,name:'Facebook',color:'#1877F2'},
  {match:/soundcloud/i,name:'SoundCloud',color:'#FF5500'},
];

const C={bg:'#07070F',card:'#0E0E1C',card2:'#131322',border:'#1A1A2E',
  accent:'#FF4D1C',cyan:'#00C8F0',text:'#D8D8EC',muted:'#44445A',
  success:'#00D97E',warn:'#FFB020',purple:'#8B5CF6',green:'#10B981'};

const css=`
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:${C.bg};}
::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:${C.bg};}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}
input,textarea,select{outline:none;font-family:'Outfit',sans-serif;}
button{cursor:pointer;border:none;font-family:'Outfit',sans-serif;}
a{color:inherit;text-decoration:none;}
input[type=range]{-webkit-appearance:none;width:100%;height:3px;background:${C.border};border-radius:2px;outline:none;}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:${C.accent};cursor:pointer;}
.card{background:${C.card};border:1px solid ${C.border};border-radius:12px;}
.card2{background:${C.card2};border:1px solid ${C.border};border-radius:8px;}
.btn{padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;transition:all .15s;letter-spacing:.01em;}
.btn-accent{background:${C.accent};color:#fff;}.btn-accent:hover{background:#e03a0a;}
.btn-cyan{background:${C.cyan};color:#07070F;}.btn-cyan:hover{opacity:.85;}
.btn-outline{background:transparent;color:${C.text};border:1px solid ${C.border};}.btn-outline:hover{border-color:${C.accent};color:${C.accent};}
.btn-ghost{background:transparent;color:${C.muted};}.btn-ghost:hover{color:${C.text};}
.field{background:#05050D;border:1px solid ${C.border};color:${C.text};padding:10px 13px;border-radius:8px;font-size:13px;width:100%;transition:border-color .2s;}
.field:focus{border-color:${C.accent};}.field::placeholder{color:${C.muted};}
.chip{padding:5px 11px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid;cursor:pointer;transition:all .15s;}
.tablink{padding:9px 15px;font-size:13px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:6px;white-space:nowrap;border-radius:0;background:transparent;color:${C.muted};border:none;border-bottom:2px solid transparent;font-family:'Outfit',sans-serif;font-weight:500;}
.tablink.active{color:${C.accent};border-bottom-color:${C.accent};}
.tablink:hover:not(.active){color:${C.text};}
.kbd{background:#04040C;border:1px solid ${C.border};border-radius:5px;padding:3px 9px;font-size:11px;font-family:'JetBrains Mono',monospace;color:${C.cyan};}
.row{display:flex;align-items:center;}.col{display:flex;flex-direction:column;}
@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite;display:inline-block;}
@keyframes fadein{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}.fadein{animation:fadein .25s ease forwards;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}.pulse{animation:pulse 1s ease infinite;}
.hover-lift{transition:transform .2s;}.hover-lift:hover{transform:translateY(-2px);}
.badge{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.05em;}
audio{border-radius:8px;background:${C.card2};}
`;

// ══ POMODORO HEADER ════════════════════════════════════════════════

function Pomodoro(){
  const[mins,setMins]=useLS('pomo_mins',50);
  const[secs,setSecs]=useState(0);
  const[running,setRunning]=useState(false);
  const[mode,setMode]=useState('work'); // work | break
  const[cycle,setCycle]=useState(0);
  const remaining=useRef(mins*60);
  const timer=useRef(null);

  useEffect(()=>{remaining.current=mins*60;setSecs(0);},[mins]);

  const tick=useCallback(()=>{
    remaining.current--;
    const m=Math.floor(remaining.current/60),s=remaining.current%60;
    setMins(m);setSecs(s);
    if(remaining.current<=0){
      clearInterval(timer.current);setRunning(false);
      if(mode==='work'){setMode('break');remaining.current=10*60;setCycle(c=>c+1);}
      else{setMode('work');remaining.current=50*60;}
    }
  },[mode,setMins]);

  const toggle=()=>{
    if(running){clearInterval(timer.current);setRunning(false);}
    else{timer.current=setInterval(tick,1000);setRunning(true);}
  };
  const reset=()=>{clearInterval(timer.current);setRunning(false);remaining.current=50*60;setMins(50);setSecs(0);setMode('work');};

  const pct=Math.round((1-remaining.current/(mode==='work'?50*60:10*60))*100);
  const col=mode==='work'?C.accent:C.green;

  return(
    <div className="row" style={{gap:10,padding:'8px 14px',background:C.card2,borderRadius:10,border:`1px solid ${C.border}`}}>
      <div style={{position:'relative',width:38,height:38,flexShrink:0}}>
        <svg width="38" height="38" style={{position:'absolute',top:0,left:0}}>
          <circle cx="19" cy="19" r="16" fill="none" stroke={C.border} strokeWidth="2.5"/>
          <circle cx="19" cy="19" r="16" fill="none" stroke={col} strokeWidth="2.5"
            strokeDasharray={`${pct} 100`} strokeDashoffset="25" strokeLinecap="round"
            style={{transition:'stroke-dasharray .5s'}}
            transform="rotate(-90 19 19)"
          />
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:col,fontFamily:"'JetBrains Mono',monospace"}}>
          {String(Math.floor(remaining.current/60)).padStart(2,'0')}:{String(remaining.current%60).padStart(2,'0')}
        </div>
      </div>
      <div className="col" style={{gap:2,minWidth:50}}>
        <span style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'.08em'}}>{mode==='work'?'Foco':'Pausa'}</span>
        <span style={{fontSize:10,color:col,fontWeight:700}}>Ciclo {cycle+1}</span>
      </div>
      <div className="row" style={{gap:4}}>
        <button onClick={toggle} className="btn" style={{padding:'5px 10px',fontSize:11,background:running?C.warn:col,color:mode==='work'&&!running?'#fff':'#07070F',borderRadius:6}}>
          {running?'⏸':'▶'}
        </button>
        <button onClick={reset} className="btn-ghost" style={{padding:'5px 8px',fontSize:11}}>↺</button>
      </div>
    </div>
  );
}

// ══ ONBOARDING ═════════════════════════════════════════════════════

function Onboarding({onClose}){
  const steps=[
    {icon:'⬇',tab:'Downloader',desc:'Cole o link de qualquer vídeo e clique Baixar'},
    {icon:'🔇',tab:'Silêncios',desc:'Suba um áudio e remova os silêncios automaticamente'},
    {icon:'🎬',tab:'Stock',desc:'Busque footage gratuito com filtros e baixe direto'},
    {icon:'📁',tab:'Pastas',desc:'Gere a estrutura de pastas do seu projeto com 1 clique'},
    {icon:'🎵',tab:'SFX',desc:'Busque efeitos sonoros gratuitos do Freesound'},
    {icon:'🛠',tab:'Ferramentas',desc:'Checklist, atalhos e presets de exportação'},
  ];
  return(
    <div className="card fadein" style={{padding:24,marginBottom:16,borderColor:C.accent+'44',position:'relative'}}>
      <div style={{position:'absolute',top:14,right:14}}>
        <button className="btn-ghost" onClick={onClose} style={{fontSize:16,padding:'2px 8px'}}>✕</button>
      </div>
      <div style={{fontFamily:'Syne',fontWeight:800,fontSize:18,marginBottom:4}}>👋 Bem-vindo ao EditKit v2</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Aqui está um guia rápido de como usar cada aba:</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {steps.map(s=>(
          <div key={s.tab} className="card2" style={{padding:'10px 12px'}}>
            <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:12,fontWeight:700,color:C.cyan,marginBottom:3}}>{s.tab}</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.5}}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══ DOWNLOADER ═════════════════════════════════════════════════════

function DownloaderTab(){
  const[url,setUrl]=useState('');
  const[audioOnly,setAudioOnly]=useLS('dl_audio',false);
  const[quality,setQuality]=useLS('dl_quality','max');
  const[loading,setLoading]=useState(false);
  const[result,setResult]=useState(null);
  const[err,setErr]=useState(null);
  const[history,setHistory]=useLS('dl_history',[]);
  const plat=PLATFORMS.find(p=>p.match.test(url));

  const ERROR_HINTS={
    '401':'Link inválido ou vídeo privado.',
    '429':'Muitas requisições. Aguarde alguns segundos.',
    '403':'Vídeo bloqueado por região ou sem permissão.',
    'fetch':'Erro de rede. Verifique sua conexão.',
    'network':'Erro de rede. Verifique sua conexão.',
    'CORS':'Rode o site localmente para evitar bloqueio de CORS.',
  };
  const getHint=msg=>Object.entries(ERROR_HINTS).find(([k])=>msg.includes(k))?.[1]||'Tente outro link ou formato.';

  const download=async()=>{
    if(!url.trim())return;
    setLoading(true);setResult(null);setErr(null);
    try{
      const res=await fetch('https://cobalt.tools/api/json',{
        method:'POST',
        headers:{'Accept':'application/json','Content-Type':'application/json'},
        body:JSON.stringify({url:url.trim(),vQuality:quality,isAudioOnly:audioOnly,filenamePattern:'basic'})
      });
      if(!res.ok)throw new Error(`${res.status}`);
      const data=await res.json();
      if(data.status==='error')throw new Error(data.text||'Erro da API');
      if(['stream','redirect','tunnel'].includes(data.status)){
        setResult({type:'single',url:data.url,filename:data.filename});
        setHistory(h=>[{url:url.trim(),plat:plat?.name||'Link',ts:Date.now()},...h].slice(0,8));
      } else if(data.status==='picker'){
        setResult({type:'picker',items:data.picker,audio:data.audio});
      } else throw new Error('Resposta inesperada: '+data.status);
    }catch(e){setErr({msg:e.message,hint:getHint(e.message)});}
    setLoading(false);
  };

  return(
    <div className="fadein col" style={{gap:16}}>
      <div><h2 style={{fontFamily:'Syne',fontWeight:800,fontSize:22,marginBottom:4}}>Baixar Vídeo</h2>
        <p style={{color:C.muted,fontSize:13}}>YouTube · Instagram · TikTok · Twitter · Reddit · Twitch · Vimeo e mais</p></div>

      <div className="card" style={{padding:18}}>
        <div className="row" style={{gap:8,marginBottom:12}}>
          <input className="field" value={url} onChange={e=>{setUrl(e.target.value);setResult(null);setErr(null);}}
            onKeyDown={e=>e.key==='Enter'&&download()}
            placeholder="Cole o link do vídeo..." style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:12}}/>
          <button className="btn btn-accent" onClick={download} disabled={loading||!url.trim()}
            style={{opacity:loading||!url.trim()?0.5:1,whiteSpace:'nowrap',minWidth:100}}>
            {loading?<span className="spin">⏳</span>:'⬇ Baixar'}
          </button>
        </div>
        <div className="row" style={{gap:14,flexWrap:'wrap'}}>
          {plat&&<div className="row" style={{gap:5}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:plat.color}}/>
            <span style={{fontSize:11,color:plat.color,fontWeight:600}}>{plat.name}</span>
          </div>}
          <label className="row" style={{gap:6,fontSize:12,color:C.muted,cursor:'pointer',marginLeft:'auto'}}>
            <input type="checkbox" checked={audioOnly} onChange={e=>setAudioOnly(e.target.checked)} style={{accentColor:C.accent}}/>
            Só áudio
          </label>
          <select value={quality} onChange={e=>setQuality(e.target.value)}
            className="field" style={{width:'auto',padding:'5px 10px',fontSize:12,background:'#05050D'}}>
            <option value="max">Melhor qualidade</option>
            <option value="1080">1080p</option><option value="720">720p</option>
            <option value="480">480p</option><option value="360">360p</option>
          </select>
        </div>
      </div>

      {err&&(
        <div className="card fadein" style={{padding:14,borderColor:'#6B1A1A'}}>
          <div style={{color:'#FF6B6B',fontWeight:600,fontSize:13,marginBottom:4}}>⚠ {err.msg}</div>
          <div style={{color:C.muted,fontSize:12}}>💡 {err.hint}</div>
        </div>
      )}

      {result?.type==='single'&&(
        <div className="card fadein" style={{padding:18}}>
          <div style={{color:C.success,fontWeight:700,marginBottom:12,fontSize:14}}>✓ Pronto para download!</div>
          <div className="row" style={{gap:8,flexWrap:'wrap'}}>
            <a href={result.url} target="_blank" rel="noreferrer">
              <button className="btn btn-accent">⬇ Abrir Download</button>
            </a>
            <button className="btn btn-outline" onClick={()=>navigator.clipboard.writeText(result.url)}>📋 Copiar Link</button>
          </div>
          {result.filename&&<div style={{marginTop:8,fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.muted}}>{result.filename}</div>}
        </div>
      )}
      {result?.type==='picker'&&(
        <div className="card fadein" style={{padding:18}}>
          <div style={{color:C.warn,fontWeight:700,marginBottom:12}}>Escolha a qualidade:</div>
          <div className="col" style={{gap:6}}>
            {result.items?.map((item,i)=>(
              <a key={i} href={item.url} target="_blank" rel="noreferrer" style={{display:'block'}}>
                <button className="btn btn-outline" style={{width:'100%',textAlign:'left',display:'flex',gap:8}}>
                  <span>{item.type==='video'?'🎬':'🎵'}</span><span>{item.quality||`Opção ${i+1}`}</span>
                </button>
              </a>
            ))}
            {result.audio&&<a href={result.audio} target="_blank" rel="noreferrer" style={{display:'block'}}>
              <button className="btn btn-outline" style={{width:'100%',textAlign:'left',display:'flex',gap:8}}>🎵 Apenas Áudio</button>
            </a>}
          </div>
        </div>
      )}

      {history.length>0&&(
        <div>
          <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Histórico recente</div>
          <div className="col" style={{gap:4}}>
            {history.map((h,i)=>(
              <div key={i} className="card2 row" style={{padding:'8px 12px',gap:8,cursor:'pointer'}}
                onClick={()=>{setUrl(h.url);setResult(null);setErr(null);}}>
                <span style={{fontSize:11,color:C.muted}}>{h.plat}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.url}</span>
                <span style={{fontSize:10,color:C.muted,flexShrink:0}}>{new Date(h.ts).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card2" style={{padding:10}}>
        <p style={{fontSize:11,color:C.muted}}>
          ℹ Powered by <a href="https://cobalt.tools" target="_blank" rel="noreferrer" style={{color:C.cyan}}>cobalt.tools</a>. 
          Uso pessoal. Não use para distribuição comercial.
        </p>
      </div>
    </div>
  );
}

// ══ SILENCE REMOVER ════════════════════════════════════════════════

function SilenceTab(){
  const[file,setFile]=useState(null);
  const[thr,setThr]=useLS('sil_thr',0.02);
  const[minSec,setMinSec]=useLS('sil_min',0.5);
  const[processing,setProcessing]=useState(false);
  const[result,setResult]=useState(null);
  const[origUrl,setOrigUrl]=useState(null);
  const[err,setErr]=useState(null);
  const[dragging,setDragging]=useState(false);
  const[comparing,setComparing]=useState(false);
  const inputRef=useRef();

  const onDrop=e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f){setFile(f);setResult(null);setErr(null);}};

  const process=async()=>{
    if(!file)return;
    setProcessing(true);setResult(null);setErr(null);
    try{
      const ab=await file.arrayBuffer();
      if(origUrl)URL.revokeObjectURL(origUrl);
      const origBlob=new Blob([ab],{type:file.type});
      setOrigUrl(URL.createObjectURL(origBlob));
      const ctx=new (window.AudioContext||window.webkitAudioContext)();
      const decoded=await ctx.decodeAudioData(ab.slice(0));
      await ctx.close();
      const{out,removed}=stripSilences(decoded,thr,minSec);
      const wav=encodeWav(out);
      const blob=new Blob([wav],{type:'audio/wav'});
      const url=URL.createObjectURL(blob);
      setResult({url,removed:removed.toFixed(1),original:(decoded.length/decoded.sampleRate).toFixed(1),
        final:(out.length/out.sampleRate).toFixed(1),size:(blob.size/1024/1024).toFixed(1)});
    }catch(e){setErr('Erro: '+e.message);}
    setProcessing(false);
  };

  const pct=result?Math.round((result.removed/result.original)*100):0;

  return(
    <div className="fadein col" style={{gap:16}}>
      <div><h2 style={{fontFamily:'Syne',fontWeight:800,fontSize:22,marginBottom:4}}>Remover Silêncios</h2>
        <p style={{color:C.muted,fontSize:13}}>Detecta e remove silêncios do áudio. Processado localmente, sem upload.</p></div>

      <div className="card" style={{
        padding:32,textAlign:'center',borderStyle:'dashed',cursor:'pointer',
        borderColor:dragging?C.accent:file?C.purple:C.border,
        background:dragging?C.accent+'08':'transparent',transition:'all .2s'
      }}
        onClick={()=>inputRef.current.click()} onDrop={onDrop}
        onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}>
        <input ref={inputRef} type="file" accept="audio/*,video/*" style={{display:'none'}}
          onChange={e=>{setFile(e.target.files[0]);setResult(null);setErr(null);}}/>
        {file?(<div><div style={{fontSize:26,marginBottom:6}}>🎵</div>
            <div style={{color:C.text,fontWeight:600,fontSize:14}}>{file.name}</div>
            <div style={{color:C.muted,fontSize:12,marginTop:3}}>{(file.size/1024/1024).toFixed(2)} MB · clique para trocar</div>
          </div>):(<div>
            <div style={{fontSize:30,marginBottom:8}}>📂</div>
            <div style={{color:C.text,fontSize:14,fontWeight:500}}>Arraste ou clique para selecionar</div>
            <div style={{color:C.muted,fontSize:12,marginTop:5}}>MP3 · WAV · M4A · AAC · MP4 · MOV</div>
          </div>)}
      </div>

      <div className="card" style={{padding:18}}>
        {[['Limiar de silêncio',thr,setThr,0.001,0.1,0.001,v=>v.toFixed(3),'← mais sensível','menos sensível →'],
          ['Duração mínima',minSec,setMinSec,0.1,3,0.1,v=>v.toFixed(1)+'s','0.1s','3.0s']].map(([lbl,val,set,min,max,step,fmt,lo,hi])=>(
          <div key={lbl} style={{marginBottom:16}}>
            <div className="row" style={{justifyContent:'space-between',marginBottom:7}}>
              <span style={{fontSize:13,fontWeight:600}}>{lbl}</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:C.accent,fontWeight:500}}>{fmt(val)}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={val} onChange={e=>set(+e.target.value)}/>
            <div className="row" style={{justifyContent:'space-between',fontSize:10,color:C.muted,marginTop:3}}><span>{lo}</span><span>{hi}</span></div>
          </div>
        ))}
      </div>

      <button className="btn btn-accent" onClick={process} disabled={!file||processing}
        style={{padding:13,fontSize:14,opacity:!file||processing?0.45:1,borderRadius:8,width:'100%'}}>
        {processing?<><span className="spin">⚙</span> Processando...</>:'✂ Remover Silêncios'}
      </button>

      {err&&<div className="card fadein" style={{padding:13,borderColor:'#6B1A1A'}}>
        <div style={{color:'#FF6B6B',fontSize:12,marginBottom:3}}>⚠ Erro ao processar</div>
        <div style={{color:C.muted,fontSize:12}}>{err}</div>
        <div style={{color:C.muted,fontSize:11,marginTop:4}}>💡 Certifique-se que o arquivo é um áudio válido (MP3, WAV, M4A).</div>
      </div>}

      {result&&(
        <div className="card fadein" style={{padding:18}}>
          <div style={{color:C.success,fontWeight:700,fontSize:15,marginBottom:14}}>✓ Pronto!</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
            {[['Original',result.original+'s',C.muted],['Final',result.final+'s',C.cyan],['Removido',result.removed+'s',C.accent],['Redução',pct+'%',C.success]].map(([l,v,col])=>(
              <div key={l} className="card2" style={{padding:'10px 8px',textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:800,fontFamily:'Syne',color:col}}>{v}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>

          <div className="row" style={{gap:8,marginBottom:12}}>
            <button className="chip" onClick={()=>setComparing(false)}
              style={{borderColor:!comparing?C.cyan:C.border,background:!comparing?C.cyan+'18':'transparent',color:!comparing?C.cyan:C.muted}}>
              Resultado
            </button>
            {origUrl&&<button className="chip" onClick={()=>setComparing(true)}
              style={{borderColor:comparing?C.accent:C.border,background:comparing?C.accent+'18':'transparent',color:comparing?C.accent:C.muted}}>
              Comparar Antes/Depois
            </button>}
          </div>

          {!comparing?(
            <audio controls src={result.url} style={{width:'100%',marginBottom:12}}/>
          ):(
            <div className="col" style={{gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:C.muted,marginBottom:5,fontWeight:600}}>🎵 ANTES — {result.original}s</div>
                <audio controls src={origUrl} style={{width:'100%'}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:C.success,marginBottom:5,fontWeight:600}}>✂ DEPOIS — {result.final}s (−{pct}%)</div>
                <audio controls src={result.url} style={{width:'100%'}}/>
              </div>
            </div>
          )}

          <a href={result.url} download={`sem-silencio_${(file?.name||'audio').replace(/\.[^.]+$/,'')}.wav`} style={{display:'block'}}>
            <button className="btn btn-accent" style={{width:'100%',padding:11}}>⬇ Baixar WAV ({result.size} MB)</button>
          </a>
        </div>
      )}
    </div>
  );
}

// ══ STOCK FOOTAGE ══════════════════════════════════════════════════

function StockTab(){
  const[apiKey,setApiKey]=useLS('pexels_key','');
  const[query,setQuery]=useLS('stock_query','');
  const[orient,setOrient]=useLS('stock_orient','all');
  const[minD,setMinD]=useLS('stock_minD',0);
  const[maxD,setMaxD]=useLS('stock_maxD',120);
  const[results,setResults]=useState([]);
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState(null);
  const[page,setPage]=useState(1);
  const[total,setTotal]=useState(0);
  const[preview,setPreview]=useState(null);
  const[showKey,setShowKey]=useState(!apiKey);

  const ERRORS={401:'API Key inválida. Obtenha uma em pexels.com/api',403:'Sem permissão. Verifique sua API Key.',429:'Muitas requisições. Aguarde um momento.'};

  const search=async(p=1)=>{
    if(!query.trim())return;
    setLoading(true);setErr(null);
    try{
      const params=new URLSearchParams({query:query.trim(),per_page:15,page:p,...(orient!=='all'&&{orientation:orient})});
      const res=await fetch(`https://api.pexels.com/videos/search?${params}`,{headers:{Authorization:apiKey.trim()||'DEMO'}});
      if(!res.ok)throw new Error(ERRORS[res.status]||`Erro ${res.status}. Tente novamente.`);
      const data=await res.json();
      const vids=data.videos.filter(v=>v.duration>=minD&&v.duration<=maxD);
      setResults(p===1?vids:[...results,...vids]);setTotal(data.total_results);setPage(p);
    }catch(e){setErr(e.message);}
    setLoading(false);
  };

  const bestFile=v=>{
    const f=v.video_files||[];
    return f.find(x=>x.quality==='hd'&&x.width<=1920)||f.find(x=>x.quality==='hd')||f.find(x=>x.quality==='sd')||f[0];
  };

  return(
    <div className="fadein col" style={{gap:16}}>
      <div><h2 style={{fontFamily:'Syne',fontWeight:800,fontSize:22,marginBottom:4}}>Stock Footage</h2>
        <p style={{color:C.muted,fontSize:13}}>Busque e baixe vídeos gratuitos do Pexels • API Key salva automaticamente</p></div>

      {showKey?(
        <div className="card fadein" style={{padding:16,borderColor:C.warn+'44'}}>
          <div className="row" style={{justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:600,color:C.warn}}>⚡ API Key do Pexels</span>
            <span style={{fontSize:11,color:C.muted}}>Gratuita · 25k req/mês</span>
          </div>
          <div className="row" style={{gap:8}}>
            <input className="field" value={apiKey} onChange={e=>setApiKey(e.target.value)}
              placeholder="Cole sua chave aqui..." style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}/>
            <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer">
              <button className="btn btn-outline" style={{whiteSpace:'nowrap',fontSize:12}}>Obter grátis →</button>
            </a>
            {apiKey&&<button className="btn btn-cyan" style={{fontSize:12,whiteSpace:'nowrap'}} onClick={()=>setShowKey(false)}>✓ Salvar</button>}
          </div>
        </div>
      ):(
        <div className="row" style={{gap:6}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:C.success}}/>
          <span style={{fontSize:12,color:C.muted}}>API Key salva</span>
          <button style={{fontSize:11,color:C.cyan,background:'none',border:'none',cursor:'pointer'}} onClick={()=>setShowKey(true)}>editar</button>
        </div>
      )}

      <div className="card" style={{padding:18}}>
        <div className="row" style={{gap:8,marginBottom:12}}>
          <input className="field" value={query} style={{flex:1}} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&search(1)} placeholder="natureza, cidade, pessoas, tecnologia..."/>
          <button className="btn btn-accent" onClick={()=>search(1)} disabled={loading}
            style={{whiteSpace:'nowrap',opacity:loading?0.6:1}}>
            {loading?<span className="spin">⏳</span>:'🔍 Buscar'}
          </button>
        </div>
        <div className="row" style={{gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <div className="row" style={{gap:4}}>
            {[['all','Todos'],['landscape','Horizontal'],['portrait','Vertical'],['square','Quadrado']].map(([v,l])=>(
              <button key={v} className="chip" onClick={()=>setOrient(v)}
                style={{borderColor:orient===v?C.accent:C.border,background:orient===v?C.accent+'18':'transparent',color:orient===v?C.accent:C.muted}}>{l}</button>
            ))}
          </div>
          <div className="row" style={{gap:5,fontSize:12,color:C.muted,marginLeft:'auto'}}>
            <span>⏱</span>
            <input type="number" value={minD} min={0} onChange={e=>setMinD(+e.target.value)}
              className="field" style={{width:48,padding:'4px 7px',fontSize:12,textAlign:'center'}}/>
            <span>–</span>
            <input type="number" value={maxD} min={0} onChange={e=>setMaxD(+e.target.value)}
              className="field" style={{width:54,padding:'4px 7px',fontSize:12,textAlign:'center'}}/>
            <span>seg</span>
          </div>
        </div>
      </div>

      {err&&<div className="card fadein" style={{padding:13,borderColor:'#6B1A1A'}}>
        <div style={{color:'#FF6B6B',fontSize:13,marginBottom:3}}>⚠ {err}</div>
      </div>}

      {results.length>0&&(
        <div className="fadein">
          <div style={{fontSize:12,color:C.muted,marginBottom:10}}>
            <span style={{color:C.text,fontWeight:600}}>{total.toLocaleString()}</span> resultados para "{query}"
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
            {results.map(v=>{const f=bestFile(v);return(
              <div key={v.id} className="card hover-lift" style={{overflow:'hidden',cursor:'default'}}>
                <div style={{position:'relative',paddingTop:'58%',background:'#000'}}>
                  <img src={v.image} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
                  <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.78)',opacity:0,display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'opacity .2s'}}
                    onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                    <button onClick={()=>setPreview(v)}
                      style={{background:'rgba(255,255,255,.12)',color:'#fff',border:'1px solid rgba(255,255,255,.2)',borderRadius:6,padding:'5px 10px',fontSize:12,cursor:'pointer'}}>▶</button>
                    {f&&<a href={f.link} target="_blank" rel="noreferrer">
                      <button style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'5px 10px',fontSize:12,cursor:'pointer',fontWeight:700}}>⬇</button>
                    </a>}
                  </div>
                  <div style={{position:'absolute',bottom:5,left:5,background:'rgba(0,0,0,.7)',borderRadius:3,padding:'2px 6px',fontSize:9,color:'#fff'}}>{v.duration}s</div>
                </div>
                <div style={{padding:'7px 9px'}}>
                  <div style={{fontSize:10,color:C.muted}}>{v.width}×{v.height} · {v.user?.name}</div>
                  {f&&<div style={{fontSize:9,color:C.muted,marginTop:1,textTransform:'uppercase'}}>{f.quality}·{f.file_type?.split('/')[1]}</div>}
                </div>
              </div>
            );})}
          </div>
          {results.length<total&&<button className="btn btn-outline" onClick={()=>search(page+1)} disabled={loading} style={{width:'100%',padding:11}}>
            {loading?'⏳ Carregando...':'+ Carregar mais'}
          </button>}
        </div>
      )}

      {preview&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.92)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20}}
          onClick={()=>setPreview(null)}>
          <div className="card" style={{maxWidth:700,width:'100%',padding:0,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
            <video src={bestFile(preview)?.link} controls autoPlay style={{width:'100%',display:'block'}}/>
            <div className="row" style={{padding:'10px 14px',justifyContent:'space-between'}}>
              <span style={{fontSize:11,color:C.muted}}>by {preview.user?.name} · {preview.duration}s</span>
              <div className="row" style={{gap:6}}>
                <a href={bestFile(preview)?.link} target="_blank" rel="noreferrer">
                  <button className="btn btn-accent" style={{fontSize:12,padding:'6px 12px'}}>⬇ Download</button>
                </a>
                <button className="btn-ghost" style={{fontSize:14,padding:'6px 10px'}} onClick={()=>setPreview(null)}>✕</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══ FOLDER GENERATOR ═══════════════════════════════════════════════

const TEMPLATES={
  'YouTube/Vlog':{folders:['01_Footage','02_Audio','03_Music','04_SFX','05_Project','06_Exports','07_Thumbnails','08_Scripts'],desc:'Para vlogs, YouTube e conteúdo geral'},
  'Comercial':{folders:['01_Footage','02_Audio_Locução','03_Music','04_SFX','05_Motion_Graphics','06_Project','07_Exports/Master','07_Exports/Web','08_Roteiros','09_Assets_Cliente'],desc:'Para projetos publicitários e corporativos'},
  'Documentário':{folders:['01_Footage_Bruto','02_Entrevistas','03_BRoll','04_Audio','05_Trilha','06_Project','07_Exports','08_Pesquisa','09_Roteiros'],desc:'Para documentários e reportagens'},
  'Short/Reels':{folders:['01_Footage','02_Audio','03_Project','04_Exports/9x16','04_Exports/1x1','05_Assets'],desc:'Para conteúdo vertical e formato curto'},
  'Podcast':{folders:['01_Gravações','02_Trilha','03_SFX','04_Project','05_Exports/Audio','05_Exports/Video','06_Roteiros','07_Arte'],desc:'Para podcasts em vídeo'},
};

function FolderTab(){
  const[proj,setProj]=useState('');
  const[template,setTemplate]=useLS('folder_tpl','YouTube/Vlog');
  const[custom,setCustom]=useState('');
  const[generated,setGenerated]=useState(null);

  const generate=()=>{
    if(!proj.trim())return;
    const tpl=TEMPLATES[template];
    const extra=custom.split('\n').map(s=>s.trim()).filter(Boolean);
    const all=[...tpl.folders,...extra];
    const clean=proj.trim().replace(/[^a-zA-Z0-9_\-. ]/g,'').replace(/\s+/g,'_');
    setGenerated({name:clean,folders:all,tpl:template});
  };

  const downloadBat=()=>{
    if(!generated)return;
    const lines=['@echo off','echo Criando estrutura de pastas...',`mkdir "${generated.name}"`];
    generated.folders.forEach(f=>lines.push(`mkdir "${generated.name}\\${f.replace(/\//g,'\\')}"`));
    lines.push('echo Pronto!','pause');
    const blob=new Blob([lines.join('\r\n')],{type:'text/plain'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=`criar_${generated.name}.bat`;a.click();
  };

  const downloadSh=()=>{
    if(!generated)return;
    const lines=['#!/bin/bash','echo "Criando estrutura de pastas..."',`mkdir -p "${generated.name}"`];
    generated.folders.forEach(f=>lines.push(`mkdir -p "${generated.name}/${f}"`));
    lines.push('echo "Pronto!"');
    const blob=new Blob([lines.join('\n')],{type:'text/plain'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=`criar_${generated.name}.sh`;a.click();
  };

  return(
    <div className="fadein col" style={{gap:16}}>
      <div><h2 style={{fontFamily:'Syne',fontWeight:800,fontSize:22,marginBottom:4}}>Gerador de Pastas</h2>
        <p style={{color:C.muted,fontSize:13}}>Gera um script que cria a estrutura de pastas do projeto com um clique</p></div>

      <div className="card" style={{padding:18}}>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,color:C.muted,fontWeight:600,display:'block',marginBottom:6}}>NOME DO PROJETO</label>
          <input className="field" value={proj} onChange={e=>setProj(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&generate()}
            placeholder="Ex: Video_Corporativo_Midiograf, Vlog_Europa_2025..."/>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,color:C.muted,fontWeight:600,display:'block',marginBottom:8}}>TEMPLATE</label>
          <div className="col" style={{gap:6}}>
            {Object.entries(TEMPLATES).map(([k,v])=>(
              <label key={k} className="row" style={{gap:10,cursor:'pointer',padding:'10px 12px',borderRadius:8,
                background:template===k?C.accent+'12':'transparent',border:`1px solid ${template===k?C.accent:C.border}`,transition:'all .15s'}}>
                <input type="radio" name="tpl" value={k} checked={template===k} onChange={()=>setTemplate(k)}
                  style={{accentColor:C.accent}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:template===k?C.accent:C.text}}>{k}</div>
                  <div style={{fontSize:11,color:C.muted}}>{v.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,color:C.muted,fontWeight:600,display:'block',marginBottom:6}}>PASTAS EXTRAS (opcional, uma por linha)</label>
          <textarea className="field" value={custom} onChange={e=>setCustom(e.target.value)}
            placeholder={'10_Referências\n11_Contratos'} rows={3} style={{resize:'vertical'}}/>
        </div>
        <button className="btn btn-accent" onClick={generate} disabled={!proj.trim()}
          style={{width:'100%',padding:12,opacity:!proj.trim()?0.5:1}}>📁 Gerar Estrutura</button>
      </div>

      {generated&&(
        <div className="card fadein" style={{padding:18}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12,color:C.success}}>✓ Estrutura gerada para "{generated.name}"</div>
          <div className="card2" style={{padding:14,marginBottom:14,fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.8}}>
            <div style={{color:C.cyan,marginBottom:4}}>📁 {generated.name}/</div>
            {generated.folders.map(f=>(
              <div key={f} style={{color:C.text,paddingLeft:16}}>
                {f.includes('/')?(
                  <><span style={{color:C.muted}}>📁 {f.split('/')[0]}/</span><br/>
                  <span style={{color:C.text,paddingLeft:16}}>└ 📂 {f.split('/')[1]}</span></>
                ):<>└ 📂 {f}</>}
              </div>
            ))}
          </div>
          <div className="row" style={{gap:8}}>
            <button className="btn btn-accent" onClick={downloadBat} style={{flex:1,padding:11}}>
              ⬇ Windows (.bat)
            </button>
            <button className="btn btn-outline" onClick={downloadSh} style={{flex:1,padding:11}}>
              ⬇ Mac/Linux (.sh)
            </button>
          </div>
          <div style={{marginTop:10,fontSize:11,color:C.muted,lineHeight:1.5}}>
            💡 <b>Windows:</b> Dê duplo clique no .bat para criar as pastas.<br/>
            💡 <b>Mac/Linux:</b> Rode <code style={{color:C.cyan}}>chmod +x criar_{generated.name}.sh && ./criar_{generated.name}.sh</code>
          </div>
        </div>
      )}
    </div>
  );
}

// ══ SFX BANK ═══════════════════════════════════════════════════════

function SfxTab(){
  const[apiKey,setApiKey]=useLS('freesound_key','');
  const[query,setQuery]=useState('');
  const[results,setResults]=useState([]);
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState(null);
  const[showKey,setShowKey]=useState(!apiKey);
  const[playing,setPlaying]=useState(null);
  const audioRef=useRef(null);

  const TAGS=['whoosh','impact','click','notification','nature','crowd','footsteps','explosion','door','rain','wind','typing','transition'];

  const search=async(q)=>{
    const qr=q||query;
    if(!qr.trim())return;
    setLoading(true);setErr(null);
    try{
      const params=new URLSearchParams({query:qr,fields:'id,name,previews,tags,duration,filesize,license',page_size:18,token:apiKey.trim()});
      const res=await fetch(`https://freesound.org/apiv2/search/text/?${params}`);
      if(res.status===401)throw new Error('API Key inválida. Cadastre-se em freesound.org/apiv2/apply');
      if(!res.ok)throw new Error(`Erro ${res.status}`);
      const data=await res.json();
      setResults(data.results||[]);
    }catch(e){setErr(e.message);}
    setLoading(false);
  };

  const play=(sound)=>{
    if(playing===sound.id){audioRef.current?.pause();setPlaying(null);return;}
    const url=sound.previews?.['preview-hq-mp3']||sound.previews?.['preview-lq-mp3'];
    if(!url)return;
    if(audioRef.current){audioRef.current.pause();}
    audioRef.current=new Audio(url);
    audioRef.current.play();
    audioRef.current.onended=()=>setPlaying(null);
    setPlaying(sound.id);
  };

  return(
    <div className="fadein col" style={{gap:16}}>
      <div><h2 style={{fontFamily:'Syne',fontWeight:800,fontSize:22,marginBottom:4}}>Banco de SFX</h2>
        <p style={{color:C.muted,fontSize:13}}>Efeitos sonoros gratuitos via Freesound API · Preview instantâneo</p></div>

      {showKey?(
        <div className="card fadein" style={{padding:16,borderColor:C.purple+'44'}}>
          <div className="row" style={{justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:600,color:C.purple}}>🎵 API Key do Freesound</span>
            <span style={{fontSize:11,color:C.muted}}>Gratuita</span>
          </div>
          <div className="row" style={{gap:8}}>
            <input className="field" value={apiKey} onChange={e=>setApiKey(e.target.value)}
              placeholder="Sua API Key do Freesound..." style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}/>
            <a href="https://freesound.org/apiv2/apply/" target="_blank" rel="noreferrer">
              <button className="btn btn-outline" style={{whiteSpace:'nowrap',fontSize:12}}>Obter grátis →</button>
            </a>
            {apiKey&&<button className="btn" style={{background:C.purple,color:'#fff',fontSize:12,whiteSpace:'nowrap'}} onClick={()=>setShowKey(false)}>✓ Salvar</button>}
          </div>
        </div>
      ):(
        <div className="row" style={{gap:6}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:C.success}}/>
          <span style={{fontSize:12,color:C.muted}}>API Key salva</span>
          <button style={{fontSize:11,color:C.purple,background:'none',border:'none',cursor:'pointer'}} onClick={()=>setShowKey(true)}>editar</button>
        </div>
      )}

      <div className="card" style={{padding:18}}>
        <div className="row" style={{gap:8,marginBottom:12}}>
          <input className="field" value={query} style={{flex:1}} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Buscar: swoosh, click, rain, impact..."/>
          <button className="btn" onClick={()=>search()} disabled={loading}
            style={{background:C.purple,color:'#fff',whiteSpace:'nowrap',opacity:loading?0.6:1}}>
            {loading?<span className="spin">⏳</span>:'🔍'}
          </button>
        </div>
        <div className="row" style={{gap:6,flexWrap:'wrap'}}>
          {TAGS.map(t=>(
            <button key={t} className="chip" onClick={()=>{setQuery(t);search(t);}}
              style={{borderColor:C.purple+'44',background:'transparent',color:C.muted,fontSize:11}}>{t}</button>
          ))}
        </div>
      </div>

      {err&&<div className="card fadein" style={{padding:13,borderColor:'#6B1A1A'}}>
        <div style={{color:'#FF6B6B',fontSize:13}}>{err}</div>
      </div>}

      {results.length>0&&(
        <div className="fadein col" style={{gap:6}}>
          {results.map(s=>(
            <div key={s.id} className="card2 row" style={{padding:'10px 14px',gap:12,alignItems:'center'}}>
              <button onClick={()=>play(s)} style={{
                width:34,height:34,borderRadius:'50%',flexShrink:0,border:'none',
                background:playing===s.id?C.purple:C.border,color:'#fff',fontSize:13,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',transition:'background .15s'
              }}>
                {playing===s.id?'⏹':'▶'}
              </button>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:C.text,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:2}}>
                  {s.duration?.toFixed(1)}s · {s.license?.replace('http://creativecommons.org/licenses/','CC ')?.split('/')[0]} · Freesound #{s.id}
                </div>
              </div>
              <a href={`https://freesound.org/s/${s.id}/`} target="_blank" rel="noreferrer">
                <button className="btn btn-outline" style={{padding:'5px 10px',fontSize:11}}>⬇</button>
              </a>
            </div>
          ))}
        </div>
      )}

      {!apiKey&&<div className="card2" style={{padding:12}}>
        <p style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
          ℹ Cadastre-se em <a href="https://freesound.org/apiv2/apply/" target="_blank" rel="noreferrer" style={{color:C.purple}}>freesound.org/apiv2/apply</a> para obter sua chave gratuita. O Freesound tem +500.000 sons com licença Creative Commons.
        </p>
      </div>}
    </div>
  );
}

// ══ TOOLS TAB ══════════════════════════════════════════════════════

const DEFAULT_CHECKLIST=[
  {s:'🎬 Preparação',items:['Organizar clipes em pastas','Renomear arquivos por ordem','Fazer backup dos originais','Criar o projeto no software','Definir FPS e resolução']},
  {s:'✂ Montagem',items:['Montar rough cut','Fazer o corte fino','Ajustar ritmo','Remover clipes ruins','Sincronizar com a música']},
  {s:'🔊 Áudio',items:['Balancear volumes','Reduzir ruído de fundo','Adicionar SFX','Checar em headphone e caixas']},
  {s:'🎨 Visual',items:['Correção de cor','Color grade / LUTs','Consistência entre cenas','Textos e legendas','Transições e motion']},
  {s:'📤 Entrega',items:['Revisar do início ao fim','Exportar corretamente','Renomear arquivo final','Backup do projeto']},
];

const EXPORTS={
  YouTube:{codec:'H.264',resolucao:'1080p ou 4K',fps:'24/30/60',bitrate:'8–15 Mbps',audio:'AAC 320kbps',formato:'MP4',obs:'16:9. Ative "Made for Kids" se infantil.'},
  Instagram:{codec:'H.264',resolucao:'1080×1350 (retrato)',fps:'30',bitrate:'3.5 Mbps',audio:'AAC 128kbps',formato:'MP4',obs:'Reels: até 90s. Feed: até 60s.'},
  TikTok:{codec:'H.264',resolucao:'1080×1920 (vertical)',fps:'30',bitrate:'2–4 Mbps',audio:'AAC 128kbps',formato:'MP4',obs:'Proporção ideal: 9:16.'},
  'Twitter/X':{codec:'H.264',resolucao:'1280×720',fps:'30/60',bitrate:'5–6 Mbps',audio:'AAC 192kbps',formato:'MP4',obs:'Máx 2:20 min. ≤512MB.'},
  LinkedIn:{codec:'H.264',resolucao:'1920×1080',fps:'30',bitrate:'5 Mbps',audio:'AAC 192kbps',formato:'MP4',obs:'Máx 10 min. ≤5GB.'},
  Shorts:{codec:'H.264',resolucao:'1080×1920',fps:'60',bitrate:'4–6 Mbps',audio:'AAC 192kbps',formato:'MP4',obs:'Máx 60s. 9:16 obrigatório.'},
};

const ATALHOS={
  'Premiere Pro':[['Space','Play/Pause'],['C','Razor Tool'],['V','Seleção'],['B','Ripple Edit'],['I / O','In/Out'],['Ctrl+K','Cortar na posição'],['Ctrl+M','Exportar'],['Ctrl+D','Transição padrão'],['F','Match Frame'],['Shift+←/→','5 frames']],
  'DaVinci Resolve':[['Space','Play/Pause'],['A','Arrow Tool'],['B','Blade Tool'],['D','Desabilitar Clipe'],['I / O','In/Out'],['Ctrl+B','Split Clip'],['Ctrl+Shift+E','Export'],['Shift+Z','Fit Timeline'],['Alt+←/→','Nudge 1 frame'],['P','Position Curve']],
  'CapCut':[['Space','Play/Pause'],['←/→','Frame a frame'],['Shift+←/→','1 segundo'],['Delete','Deletar Clipe'],['Ctrl+D','Duplicar'],['Ctrl+S','Salvar'],['M','Adicionar Marca'],['Ctrl+A','Selecionar Tudo']],
  'Final Cut Pro':[['Space','Play/Pause'],['A','Arrow Tool'],['B','Blade Tool'],['R','Range Select'],['W','Insert'],['D','Overwrite'],['Cmd+E','Export'],['Shift+Z','Fit viewer'],['Ctrl+S','Snapshot'],['F','Favoritar']],
};

function ToolsTab(){
  const[checklist,setChecklist]=useLS('checklist_v2',DEFAULT_CHECKLIST);
  const[checked,setChecked]=useLS('checked_v2',{});
  const[exportPlat,setExportPlat]=useLS('export_plat','YouTube');
  const[sw,setSw]=useLS('shortcuts_sw','Premiere Pro');
  const[addingTo,setAddingTo]=useState(null);
  const[newItem,setNewItem]=useState('');

  const toggle=k=>setChecked(p=>({...p,[k]:!p[k]}));
  const allItems=checklist.flatMap(s=>s.items);
  const done=Object.values(checked).filter(Boolean).length;
  const pct=Math.round((done/allItems.length)*100);
  const exp=EXPORTS[exportPlat];

  const addItem=sec=>{
    if(!newItem.trim())return;
    setChecklist(c=>c.map(s=>s.s===sec?{...s,items:[...s.items,newItem.trim()]}:s));
    setNewItem('');setAddingTo(null);
  };
  const removeItem=(sec,item)=>{
    setChecklist(c=>c.map(s=>s.s===sec?{...s,items:s.items.filter(i=>i!==item)}:s));
    const k=sec+item;setChecked(p=>{const n={...p};delete n[k];return n;});
  };

  // Export calculator
  const[durMin,setDurMin]=useState(5);
  const[bitrate,setBitrate]=useState(8);
  const sizeMB=((durMin*60*bitrate*1000000)/8/1024/1024).toFixed(0);

  return(
    <div className="fadein col" style={{gap:28}}>

      {/* Checklist */}
      <div>
        <div className="row" style={{justifyContent:'space-between',alignItems:'flex-end',marginBottom:12}}>
          <div>
            <h2 style={{fontFamily:'Syne',fontWeight:800,fontSize:20,marginBottom:2}}>Checklist</h2>
            <span style={{fontSize:12,color:C.muted}}>{done}/{allItems.length} completas · salvo automaticamente</span>
          </div>
          <div style={{width:40,height:40,borderRadius:'50%',
            background:`conic-gradient(${C.accent} ${pct*3.6}deg, ${C.border} 0)`,
            display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{width:29,height:29,borderRadius:'50%',background:C.card,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>{pct}%</div>
          </div>
        </div>
        <div style={{height:3,background:C.border,borderRadius:2,marginBottom:16,overflow:'hidden'}}>
          <div style={{width:`${pct}%`,height:'100%',background:C.accent,borderRadius:2,transition:'width .4s'}}/>
        </div>
        <div className="col" style={{gap:10}}>
          {checklist.map(sec=>(
            <div key={sec.s} className="card" style={{padding:14}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:9}}>{sec.s}</div>
              <div className="col" style={{gap:5}}>
                {sec.items.map(item=>{
                  const k=sec.s+item;
                  return(
                    <div key={item} className="row" style={{gap:8,group:true}}>
                      <label className="row" style={{gap:8,cursor:'pointer',fontSize:13,flex:1}}>
                        <div onClick={()=>toggle(k)} style={{width:16,height:16,borderRadius:4,flexShrink:0,cursor:'pointer',transition:'all .15s',
                          border:`2px solid ${checked[k]?C.accent:C.border}`,background:checked[k]?C.accent:'transparent',
                          display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {checked[k]&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}
                        </div>
                        <span style={{color:checked[k]?C.muted:C.text,textDecoration:checked[k]?'line-through':'none',transition:'all .15s'}}>{item}</span>
                      </label>
                      <button onClick={()=>removeItem(sec.s,item)} className="btn-ghost"
                        style={{fontSize:10,padding:'2px 5px',opacity:.4,flexShrink:0}}>✕</button>
                    </div>
                  );
                })}
              </div>
              {addingTo===sec.s?(
                <div className="row" style={{gap:6,marginTop:8}}>
                  <input className="field" value={newItem} onChange={e=>setNewItem(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')addItem(sec.s);if(e.key==='Escape'){setAddingTo(null);setNewItem('');}}}
                    placeholder="Nova tarefa..." autoFocus style={{flex:1,fontSize:12,padding:'6px 10px'}}/>
                  <button className="btn btn-accent" style={{padding:'6px 10px',fontSize:12}} onClick={()=>addItem(sec.s)}>+</button>
                  <button className="btn-ghost" style={{fontSize:12}} onClick={()=>{setAddingTo(null);setNewItem('');}}>✕</button>
                </div>
              ):(
                <button className="btn-ghost" style={{marginTop:6,fontSize:11,padding:'4px 0',textAlign:'left'}}
                  onClick={()=>setAddingTo(sec.s)}>+ adicionar tarefa</button>
              )}
            </div>
          ))}
        </div>
        <button className="btn btn-outline" style={{marginTop:10,fontSize:12,padding:'7px 12px'}}
          onClick={()=>{setChecked({});setChecklist(DEFAULT_CHECKLIST);}}>
          ↺ Resetar tudo
        </button>
      </div>

      {/* Export calc */}
      <div>
        <h2 style={{fontFamily:'Syne',fontWeight:800,fontSize:20,marginBottom:14}}>Calculadora de Exportação</h2>
        <div className="card" style={{padding:18}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:14}}>
            <div>
              <label style={{fontSize:11,color:C.muted,fontWeight:600,display:'block',marginBottom:6}}>DURAÇÃO (minutos)</label>
              <input type="number" value={durMin} min={0.5} step={0.5} onChange={e=>setDurMin(+e.target.value)}
                className="field" style={{fontSize:14,fontWeight:600}}/>
            </div>
            <div>
              <label style={{fontSize:11,color:C.muted,fontWeight:600,display:'block',marginBottom:6}}>BITRATE (Mbps)</label>
              <input type="number" value={bitrate} min={1} max={100} onChange={e=>setBitrate(+e.target.value)}
                className="field" style={{fontSize:14,fontWeight:600}}/>
            </div>
          </div>
          <div className="card2" style={{padding:16,textAlign:'center'}}>
            <div style={{fontSize:36,fontWeight:800,fontFamily:'Syne',color:C.cyan}}>{sizeMB} MB</div>
            <div style={{fontSize:13,color:C.muted,marginTop:4}}>≈ {(sizeMB/1024).toFixed(2)} GB · tamanho estimado do arquivo</div>
          </div>
        </div>
      </div>

      {/* Export presets */}
      <div>
        <h2 style={{fontFamily:'Syne',fontWeight:800,fontSize:20,marginBottom:14}}>Presets de Exportação</h2>
        <div className="card" style={{padding:18}}>
          <div className="row" style={{gap:5,marginBottom:14,flexWrap:'wrap'}}>
            {Object.keys(EXPORTS).map(p=>(
              <button key={p} className="chip" onClick={()=>setExportPlat(p)}
                style={{borderColor:exportPlat===p?C.cyan:C.border,background:exportPlat===p?C.cyan+'18':'transparent',color:exportPlat===p?C.cyan:C.muted}}>{p}</button>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
            {[['Codec',exp.codec],['Resolução',exp.resolucao],['FPS',exp.fps],['Bitrate',exp.bitrate],['Áudio',exp.audio],['Formato',exp.formato]].map(([l,v])=>(
              <div key={l} className="card2" style={{padding:'9px 11px'}}>
                <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:2}}>{l}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:C.cyan,fontWeight:500}}>{v}</div>
              </div>
            ))}
          </div>
          <div className="card2" style={{padding:'9px 12px'}}>
            <span style={{fontSize:11,color:C.muted}}>💡 {exp.obs}</span>
          </div>
        </div>
      </div>

      {/* Shortcuts */}
      <div>
        <h2 style={{fontFamily:'Syne',fontWeight:800,fontSize:20,marginBottom:14}}>Atalhos de Teclado</h2>
        <div className="card" style={{padding:18}}>
          <div className="row" style={{gap:5,marginBottom:14,flexWrap:'wrap'}}>
            {Object.keys(ATALHOS).map(s=>(
              <button key={s} className="chip" onClick={()=>setSw(s)}
                style={{borderColor:sw===s?C.accent:C.border,background:sw===s?C.accent+'18':'transparent',color:sw===s?C.accent:C.muted}}>{s}</button>
            ))}
          </div>
          <div className="col" style={{gap:0}}>
            {ATALHOS[sw].map(([k,a])=>(
              <div key={k} className="row" style={{justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.text}}>{a}</span>
                <kbd className="kbd">{k}</kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══ APP ROOT ═══════════════════════════════════════════════════════

export default function App(){
  const[tab,setTab]=useLS('editkit_tab','download');
  const[showOnboard,setShowOnboard]=useLS('onboard_done',true);

  const TABS=[
    {id:'download',icon:'⬇',label:'Downloader'},
    {id:'silence',icon:'🔇',label:'Silêncios'},
    {id:'stock',icon:'🎬',label:'Stock'},
    {id:'folders',icon:'📁',label:'Pastas'},
    {id:'sfx',icon:'🎵',label:'SFX'},
    {id:'tools',icon:'🛠',label:'Ferramentas'},
  ];

  return(
    <div style={{background:C.bg,minHeight:'100vh',color:C.text,fontFamily:"'Outfit',sans-serif"}}>
      <style>{css}</style>

      {/* Header */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,zIndex:10}}>
        <div style={{maxWidth:960,margin:'0 auto',padding:'0 20px'}}>
          <div className="row" style={{padding:'12px 0 0',gap:12}}>
            <div className="row" style={{gap:9,flex:1,minWidth:0}}>
              <div style={{width:34,height:34,borderRadius:9,
                background:`linear-gradient(135deg,${C.accent} 0%,#FF8C00 100%)`,
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>✂</div>
              <div>
                <div style={{fontFamily:'Syne',fontWeight:800,fontSize:18,letterSpacing:'-.02em',lineHeight:1.1}}>EditKit</div>
                <div style={{fontSize:9,color:C.muted,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'.05em'}}>v2.0</div>
              </div>
            </div>
            <Pomodoro/>
          </div>
          <div className="row" style={{gap:0,overflowX:'auto',marginTop:4}}>
            {TABS.map(t=>(
              <button key={t.id} className={`tablink${tab===t.id?' active':''}`} onClick={()=>setTab(t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:960,margin:'0 auto',padding:'22px 20px'}}>
        {showOnboard&&<Onboarding onClose={()=>setShowOnboard(false)}/>}
        {tab==='download'&&<DownloaderTab/>}
        {tab==='silence'&&<SilenceTab/>}
        {tab==='stock'&&<StockTab/>}
        {tab==='folders'&&<FolderTab/>}
        {tab==='sfx'&&<SfxTab/>}
        {tab==='tools'&&<ToolsTab/>}
      </div>
    </div>
  );
}
