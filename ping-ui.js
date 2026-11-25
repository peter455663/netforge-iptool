const nfToolBeforePing=toolPage;toolPage=function(id){if(id!=='ping-tool')return nfToolBeforePing(id);active=id;nav('tools');return `<div class="eyebrow">NETWORK / ICMP DIAGNOSTICS</div><h1 class="page-title">Ping Tool</h1><p class="page-desc">Send one ICMP echo request to a supplied IPv4 or IPv6 address through the local NETFORGE service.</p><div class="tool-layout"><section class="panel tool-box"><h3>Target</h3><label class="form-label" for="i1">IPv4 or IPv6 address</label><input id="i1" class="form-control" value="8.8.8.8" placeholder="8.8.8.8 or 2606:4700:4700::1111"><div class="notice">One echo request only; no port scan. Run netforge_local.py to enable ICMP ping.</div><div class="button-row"><button class="btn" id="run">Ping →</button><button class="btn secondary" id="clear">Clear</button></div></section><section class="panel tool-box"><div class="panel-head" style="padding:0 0 12px;border:0"><span>PING RESULT</span><span id="state">READY</span></div><div class="result-box" id="result"><div class="result-empty">One ICMP echo request. No port scan.</div></div><div class="result-actions"><button class="copy-btn" id="copy">COPY</button><button class="copy-btn" id="txt">SAVE TXT</button><button class="copy-btn" id="json">SAVE JSON</button></div></section></div>`};
const nfScriptsBeforeBundle=scripts;scripts=function(){return nfScriptsBeforeBundle().replace('<div class="script-groups">','<section class="panel local-bundle"><div class="panel-head"><span>COMPLETE LOCAL WEBSITE</span><span>ONE FILE · STANDARD LIBRARY</span></div><div class="local-bundle-body"><div><strong>NETFORGE for Python</strong><small>Download one self-contained Python file. Run it to start the full website on localhost, with all browser tools and local ICMP ping.</small></div><a class="download" href="netforge_local.py" download="netforge_local.py">DOWNLOAD .PY</a></div></section><div class="script-groups">')};
const nfExecBeforePing=execTool;execTool=async function(){if(active==='download-speed-tester'||active==='upload-speed-tester'){return runSpeedTest(active==='download-speed-tester'?'download':'upload')}if(active!=='ping-tool')return nfExecBeforePing();let ip=$('#i1').value.trim();$('#state').textContent='PINGING';$('#result').innerHTML='<div class="loading"><span class="spinner"></span> Sending one ICMP echo…</div>';try{let r=await fetch('/api/ping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip})}),d=await r.json();if(!r.ok)throw Error(d.detail||'Local ping service unavailable. Run netforge_local.py.');$('#result').innerHTML=typeof renderResult==='function'?renderResult('ping-tool',d):`<pre class="result-text">${esc(JSON.stringify(d,null,2))}</pre>`;$('#state').textContent=d.reachable?'REPLY':'NO REPLY'}catch(e){$('#result').innerHTML=`<pre class="result-text result-error">${esc(e.message||'Run netforge_local.py for ICMP ping.')}</pre>`;$('#state').textContent='ERROR'}};
const nfExportBeforePing=nfExport;nfExport=function(format){if(format!=='txt'||!window.nfAllResults)return nfExportBeforePing(format);let d=window.nfAllResults;nfDownload([`NETFORGE ALL-IN-ONE IP CHECK`,`Checked: ${d.checkedAt}`,`Target: ${d.checkedAddress}`,`IPv4: ${d.ipv4||'Unavailable'}`,`IPv6: ${d.ipv6||'Unavailable'}`,`ISP: ${d.network.isp||'Unavailable'}`,`Organization: ${d.network.organization||'Unavailable'}`,`ASN: ${d.network.asn||'Unavailable'}`,`Provider domain: ${d.network.providerDomain||'Unavailable'}`,`Location: ${[d.location.city,d.location.region,d.location.country].filter(Boolean).join(', ')||'Unavailable'}`,`Postal code: ${d.location.postalCode||'Unavailable'}`,`Continent: ${d.location.continent||'Unavailable'}`,`Coordinates: ${d.location.latitude??'—'}, ${d.location.longitude??'—'}`,`Timezone: ${d.location.timezone||'Unavailable'}`,`Reverse DNS: ${(d.reverseDns||[]).join(', ')||'Unavailable'}`,`ICMP ping: ${d.ping?.reachable?d.ping.latency_ms+' ms':'Unavailable'}`,`Source: ${d.source}`,`Map: ${$('#map-open').href||'Unavailable'}`,`IP geolocation is approximate.`].join('\n'),'netforge-ip-check.txt','text/plain')};

function speedtestPage(){nav('speedtest');return '<div class="eyebrow">NETWORK / CONNECTION QUALITY</div><h1 class="page-title">Internet speed test</h1><p class="page-desc">Measure your current download, upload and response time through Cloudflare’s global network.</p><section class="panel speedtest-panel"><div class="speedtest-metrics"><div><span>HTTP LATENCY</span><strong id="speed-latency">—</strong><small>milliseconds · not ICMP</small></div><div><span>DOWNLOAD</span><strong id="speed-download">—</strong><small>Mbps</small></div><div><span>UPLOAD</span><strong id="speed-upload">—</strong><small>Mbps</small></div></div><div class="speedtest-controls"><button class="btn" id="run-speedtest">Run speed test →</button><span id="speed-status" aria-live="polite">No test has run.</span></div><p class="speedtest-notice">The test transfers a small amount of data to Cloudflare (about 6 MB). Cloudflare may use aggregated test measurements to improve its network. <a href="https://speed.cloudflare.com/about" target="_blank" rel="noopener">How Cloudflare handles speed test data ↗</a></p></section><div class="section-head"><h2>About this measurement</h2></div><section class="panel tool-box"><p>Download and upload are estimated from browser data transfers to Cloudflare’s speed test service. Results vary with Wi-Fi, other activity on your connection and server routing. The test does not change your network settings.</p><a href="https://speed.cloudflare.com" target="_blank" rel="noopener">Open Cloudflare’s full speed test ↗</a></section>'}
async function runSpeedTest(mode="all"){
 if(typeof mode!=="string")mode="all";
 const button=$("#run-speedtest"),status=$("#speed-status"),result=$("#result");
 if(button){button.disabled=true;button.textContent="Testing…"}
 if(status)status.textContent="Measuring response time…";
 const values={latency:null,downloadMbps:null,uploadMbps:null,provider:"Cloudflare speed test"};
 const timed=async(url,options={})=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{return await fetch(url,{...options,cache:"no-store",signal:controller.signal})}finally{clearTimeout(timer)}};
 const mbps=(bytes,seconds)=>Math.round(bytes*8/seconds/10000)/100;
 try{
  if(mode==="all"||mode==="latency"){
   const samples=[];
   for(let i=0;i<5;i++){const start=performance.now(),response=await timed("https://speed.cloudflare.com/__down?bytes=0&netforge="+Date.now()+"-"+i);if(!response.ok)throw Error("The speed test service did not respond.");await response.arrayBuffer();samples.push(performance.now()-start)}
   values.latency=Math.round(samples.slice(1).reduce((a,b)=>a+b,0)/Math.max(1,samples.length-1));
   if($("#speed-latency"))$("#speed-latency").textContent=String(values.latency);
  }
  if(mode==="all"||mode==="download"){
   if(status)status.textContent="Measuring download speed…";
   const bytes=4*1024*1024,start=performance.now(),response=await timed("https://speed.cloudflare.com/__down?bytes="+bytes+"&netforge="+Date.now());
   if(!response.ok)throw Error("Download measurement was rejected by the speed test service.");
   let count=0;if(response.body?.getReader){const reader=response.body.getReader();while(true){const item=await reader.read();if(item.done)break;count+=item.value.byteLength}}else count=(await response.arrayBuffer()).byteLength;
   values.downloadMbps=mbps(count,(performance.now()-start)/1000);
   if($("#speed-download"))$("#speed-download").textContent=values.downloadMbps.toFixed(2);
  }
  if(mode==="all"||mode==="upload"){
   if(status)status.textContent="Measuring upload speed…";
   try{
    const payload=new Uint8Array(1024*1024),start=performance.now(),response=await timed("https://speed.cloudflare.com/__up?netforge="+Date.now(),{method:"POST",body:new Blob([payload],{type:"text/plain"})});
    if(!response.ok)throw Error("Upload measurement was rejected by the speed test service.");
    await response.arrayBuffer();
    values.uploadMbps=mbps(payload.byteLength,(performance.now()-start)/1000);
    if($("#speed-upload"))$("#speed-upload").textContent=values.uploadMbps.toFixed(2);
   }catch{
    values.uploadMbps="N/A";
    if($("#speed-upload"))$("#speed-upload").textContent="N/A";
   }
  }
  if(status)status.textContent="Test complete.";
  if(result){result.innerHTML=typeof renderResult==="function"?renderResult(active,values):'<pre class="result-text">'+esc(JSON.stringify(values,null,2))+'</pre>';$("#state").textContent="COMPLETE"}
  return values;
 }catch(error){
  if(status)status.textContent=error.name==="AbortError"?"The test timed out. Try again on a stable connection.":(error.message||"The speed test could not complete.");
  if(result){result.innerHTML='<pre class="result-text result-error">'+esc(error.message||"Speed test unavailable.")+'</pre>';$("#state").textContent="ERROR"}
  return null;
 }finally{if(button){button.disabled=false;button.textContent="Run speed test →"}}
}
render();

