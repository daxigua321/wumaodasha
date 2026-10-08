'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const dashboard = $('#dashboard');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const companies = [
    {floor:12,name:'中色贸易有限公司',revenue:'32.6',description:'主营有色金属进出口贸易，铜铝铅锌品类供应链服务',metal:'silver',mark:'sail'},
    {floor:15,name:'有色金属交易中心',revenue:'48.2',description:'提供有色金属现货交易、仓储物流、供应链金融一站式服务',metal:'blue',mark:'exchange',label:'有色金属企业服务中心'},
    {floor:18,name:'华鑫金属材料有限公司',revenue:'18.7',description:'专注高端金属材料研发与销售，服务先进制造与新能源领域',metal:'gold',mark:'star'},
    {floor:20,name:'中铝上海贸易有限公司',revenue:'65.3',description:'中铝集团旗下核心贸易平台，铝产业链综合服务商',metal:'gold',mark:'alloy'},
    {floor:11,name:'上海铜业发展有限公司',revenue:'27.9',description:'铜产品全产业链运营，打造绿色供应链生态',metal:'silver-gold',mark:'star'},
    {floor:16,name:'鑫达金属集团',revenue:'35.4',description:'国内领先的金属材料服务商，覆盖全国20+城市服务网络',metal:'teal',mark:'exchange'},
    {floor:19,name:'上海有色金属交易中心股份有限公司',revenue:'52.1',description:'行业标杆企业，打造有色金属交易数字化生态平台',metal:'blue',mark:'exchange',featured:true},
  ];
  let selectedFloor = 15;
  let currentRange = 'mid';
  let touring = !reducedMotion;
  let lastTourTime = performance.now();
  let manualPauseUntil = 0;
  let lastDraw = 0;
  let entryTimer;
  let rangeTimer;
  let countAnimation;
  const svgNS = 'http://www.w3.org/2000/svg';
  const floorNodes = new Map();
  const rulerNodes = new Map();
  const rangeFor = floor => floor <= 10 ? 'low' : floor <= 20 ? 'mid' : 'high';
  const inRange = (floor,range) => range === 'all' || rangeFor(floor) === range;

  function makeSvg(tag,attributes) {
    const node = document.createElementNS(svgNS,tag);
    for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,String(value));
    return node;
  }

  // Geometry follows the right window facade of the supplied architectural render.
  // These separate floor polygons remain sharp at any screen resolution.
  function floorGeometry(floor) {
    const t = (floor - 1) / 29;
    const yLeft = 637 - 492 * t;
    const yRight = 619 - 462 * t;
    const corners = [[512,yLeft],[620,yRight],[653,yRight+5],[545,yLeft+8]];
    return {yLeft,yRight,corners,points:corners.map(p=>p.join(',')).join(' '),path:'M'+corners.map(p=>p.join(',')).join(' L')+' Z'};
  }

  function createFloors() {
    for(let floor=1;floor<=30;floor++) {
      const g = floorGeometry(floor);
      const group = makeSvg('g',{class:'floor-layer','data-floor':floor});
      group.append(
        makeSvg('path',{d:g.path,class:'slab-glow'}),
        makeSvg('polygon',{points:g.points,class:'slab-fill'}),
        makeSvg('path',{d:`M512,${g.yLeft} L545,${g.yLeft+8} L653,${g.yRight+5} L620,${g.yRight}`,class:'slab-edge'})
      );
      $('#floorLayers').append(group);
      floorNodes.set(floor,group);
      const hit = makeSvg('polygon',{points:`512,${g.yLeft-7} 653,${g.yRight-3} 653,${g.yRight+12} 512,${g.yLeft+11}`,class:'floor-hit','data-floor':floor});
      hit.addEventListener('click',()=>selectFloor(floor,{manual:true}));
      $('#floorHitAreas').append(hit);
    }
    for(let floor=30;floor>=1;floor--) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ruler-button';
      button.textContent = `${floor}层`;
      button.dataset.floor = floor;
      button.setAttribute('aria-label',`选择${floor}层`);
      button.setAttribute('aria-pressed',String(floor===selectedFloor));
      button.addEventListener('click',()=>selectFloor(floor,{manual:true}));
      button.addEventListener('keydown',event=>{
        if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key==='Home'?30:event.key==='End'?1:Math.max(1,Math.min(30,floor+(event.key==='ArrowUp'?1:-1)));
        selectFloor(next,{manual:true});
        rulerNodes.get(next).focus();
      });
      $('#floorRuler').append(button);
      rulerNodes.set(floor,button);
    }
  }

  function medallion(company) {
    const palette = {
      silver:['#f7efe0','#968d7c','#191c23','#ded8c9'],
      blue:['#cee8ff','#467ebb','#123355','#b8ddf1'],
      gold:['#fff4cf','#b9a277','#554330','#ede3bc'],
      'silver-gold':['#fff5da','#bbab8d','#605143','#ece4ce'],
      teal:['#d5f1fc','#5499bd','#18415a','#d1dfdb'],
    }[company.metal];
    const id='coin-'+company.floor;
    const marks = {
      sail:'M18 44 30 13 32 41 44 43 20 47ZM30 18 20 42 30 38ZM15 47Q31 58 47 44Q45 54 29 57Z',
      exchange:'M20 17 28 17 21 44 28 44 25 49 12 49ZM34 14 40 14 35 34 48 34 45 40 33 40 30 50 24 50ZM31 19 46 19 42 26 29 26Z',
      star:'M18 16 38 11 29 30 46 24 35 44 17 49 24 30 13 34ZM30 31 30 47 42 39 48 29Z',
      alloy:'M28 14 39 14 24 38 45 38 39 47 10 47ZM41 15 32 32 46 32 49 25 38 25Z',
    };
    return `<svg class="medallion" viewBox="0 0 62 68" aria-hidden="true"><defs><linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette[0]}"/><stop offset=".3" stop-color="${palette[1]}"/><stop offset=".52" stop-color="${palette[0]}"/><stop offset=".74" stop-color="${palette[2]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient><linearGradient id="${id}-face" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette[1]}"/><stop offset=".6" stop-color="${palette[2]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient><linearGradient id="${id}-mark" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fffef5"/><stop offset=".5" stop-color="${palette[3]}"/><stop offset=".51" stop-color="${palette[1]}"/><stop offset="1" stop-color="${palette[3]}"/></linearGradient></defs><ellipse cx="31" cy="35" rx="28" ry="31" fill="#021020" stroke="#8ca9be" stroke-width=".5"/><ellipse cx="30" cy="33" rx="27" ry="30" fill="url(#${id}-rim)"/><ellipse cx="30" cy="33" rx="23" ry="26" fill="url(#${id}-face)" stroke="${palette[2]}"/><ellipse cx="30" cy="33" rx="21" ry="24" fill="none" stroke="${palette[3]}" stroke-opacity=".5" stroke-width=".8"/><path d="${marks[company.mark]}" transform="translate(1 2)" fill="#061322" opacity=".65"/><path d="${marks[company.mark]}" fill="url(#${id}-mark)" stroke="${palette[3]}" stroke-width=".4"/><path d="M9 29C12 10 26 2 41 9" fill="none" stroke="#fff9eb" stroke-opacity=".7" stroke-width="1.2"/></svg>`;
  }

  function companyCard(company,index) {
    return `<button type="button" class="company-card${company.featured?' featured':''}${company.floor===selectedFloor?' is-selected':''}" data-floor="${company.floor}" aria-pressed="${company.floor===selectedFloor}" aria-label="${company.floor}层 ${company.name}" style="--card-index:${index}"><span class="selection-edge" aria-hidden="true"></span><div class="company-top">${medallion(company)}<div><span class="company-floor">${company.floor}层</span><h3 class="company-name">${company.name}</h3><p class="company-revenue">年收入 <strong>${company.revenue}</strong>亿元</p></div></div><p class="company-description">${company.description}</p></button>`;
  }

  function renderCompanies(animate=false) {
    const grid = $('#enterpriseGrid');
    const visible = companies.filter(company=>inRange(company.floor,currentRange));
    if(!visible.length) {
      const start = currentRange==='low'?1:21;
      grid.innerHTML = `<div class="range-empty"><div class="empty-building-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M13 42V8l23-4v38M7 42h35M19 14h2m6-1h2m-10 9h2m6-1h2m-10 9h2m6-1h2m-10 9h2m6-1h2"/></svg></div><p class="range-caption">${start}–${start+9}层</p><h3>该区域暂无企业资料</h3><p class="empty-hint">选择楼层，查看楼宇对应位置</p><div class="empty-floor-buttons">${Array.from({length:10},(_,i)=>`<button type="button" data-floor="${start+i}" class="${start+i===selectedFloor?'is-selected':''}" aria-pressed="${start+i===selectedFloor}">${start+i}层</button>`).join('')}</div><div class="empty-selection">当前楼层 <strong>${selectedFloor}层</strong><span>企业资料待补充</span></div></div>`;
    } else {
      const missing = !companies.some(company=>company.floor===selectedFloor);
      const placeholder = missing?`<button class="company-card empty-floor-card is-selected" type="button" data-floor="${selectedFloor}" aria-pressed="true" style="--card-index:0"><strong>${selectedFloor}层</strong><p>企业资料待补充</p><small>暂无该楼层企业信息</small></button>`:'';
      grid.innerHTML = placeholder + visible.map((company,index)=>companyCard(company,index+(missing?1:0))).join('');
    }
    grid.setAttribute('aria-labelledby',`tab-${currentRange}`);
    grid.querySelectorAll('button[data-floor]').forEach(button=>button.addEventListener('click',()=>selectFloor(Number(button.dataset.floor),{manual:true})));
    if(animate) {
      grid.classList.remove('changing');
      requestAnimationFrame(()=>grid.classList.add('changing'));
      clearTimeout(rangeTimer);
      rangeTimer = setTimeout(()=>grid.classList.remove('changing'),900);
    }
  }

  function updateTabs() {
    $$('.floor-tabs button').forEach(button=>{
      const active = button.dataset.range===currentRange;
      button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
    });
  }

  function updateFloorVisuals() {
    for(const [floor,node] of floorNodes) {
      node.classList.toggle('on',floor<=selectedFloor);
      node.classList.toggle('active',floor===selectedFloor);
      node.style.transitionDelay=reducedMotion?'0ms':`${Math.abs(floor-selectedFloor)*13}ms`;
    }
    for(const [floor,button] of rulerNodes) {
      const active = floor===selectedFloor;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    }
    const geometry = floorGeometry(selectedFloor);
    const pointY=geometry.yRight+5;
    const rulerY=98+(30-selectedFloor)*20;
    $('#floorGuide').setAttribute('d',`M89,${rulerY} L148,${rulerY} L506,${geometry.yLeft+3}`);
    $('#floorConnector').setAttribute('d',`M653,${pointY} L665,${pointY}`);
    for(const id of ['activePoint','activePointGlow']) {
      $('#'+id).setAttribute('cx','665');
      $('#'+id).setAttribute('cy',pointY);
    }
    $('#floorCallout').style.top=`${(pointY-17)/876*100}%`;
    $('#selectedFloorNumber').textContent=selectedFloor;
    const company=companies.find(company=>company.floor===selectedFloor);
    $('#selectedFloorCompany').textContent=company?(company.label||company.name):'企业资料待补充';
    $$('.company-card').forEach(card=>{
      const active=Number(card.dataset.floor)===selectedFloor;
      card.classList.toggle('is-selected',active);
      card.setAttribute('aria-pressed',String(active));
    });
  }

  function selectFloor(floor,{manual=false}={}) {
    if(!Number.isInteger(floor)||floor<1||floor>30) return;
    const previous=selectedFloor;
    selectedFloor=floor;
    const rangeChanged=!inRange(floor,currentRange);
    if(rangeChanged) currentRange=rangeFor(floor);
    const hasCurrent=companies.some(company=>company.floor===floor);
    const hadPrevious=companies.some(company=>company.floor===previous);
    if(rangeChanged||!hasCurrent||!hadPrevious) renderCompanies(rangeChanged);
    updateTabs();
    updateFloorVisuals();
    if(manual) {
      manualPauseUntil=performance.now()+24000;
      const company=companies.find(company=>company.floor===floor);
      $('#selectionAnnouncement').textContent=`已选择${floor}层，${company?company.name:'企业资料待补充'}`;
    }
  }

  function changeRange(range) {
    if(!['all','low','mid','high'].includes(range)) return;
    currentRange=range;
    if(!inRange(selectedFloor,range)) selectedFloor=range==='low'?5:range==='high'?25:15;
    manualPauseUntil=performance.now()+24000;
    updateTabs();
    renderCompanies(true);
    updateFloorVisuals();
  }

  $$('.floor-tabs button').forEach((button,index)=>{
    button.addEventListener('click',()=>changeRange(button.dataset.range));
    button.addEventListener('keydown',event=>{
      const tabs=$$('.floor-tabs button');
      let next=index;
      if(event.key==='ArrowRight') next=(index+1)%tabs.length;
      else if(event.key==='ArrowLeft') next=(index+tabs.length-1)%tabs.length;
      else if(event.key==='Home') next=0;
      else if(event.key==='End') next=tabs.length-1;
      else return;
      event.preventDefault();
      tabs[next].focus();
      changeRange(tabs[next].dataset.range);
    });
  });

  function updateTourButton() {
    const button=$('#tourButton');
    button.classList.toggle('is-active',touring);
    button.setAttribute('aria-pressed',String(touring));
    button.setAttribute('aria-label',touring?'暂停自动巡层':'开启自动巡层');
    button.title=touring?'暂停自动巡层':'开启自动巡层';
    button.querySelector('svg').innerHTML=touring?'<path d="M8 6v12M16 6v12"/>':'<path d="m8 5 11 7-11 7Z"/>';
  }
  $('#tourButton').addEventListener('click',()=>{
    touring=!touring;
    lastTourTime=performance.now();
    manualPauseUntil=0;
    updateTourButton();
  });
  $('#fullscreenButton').addEventListener('click',async()=>{
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      else if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else $('#selectionAnnouncement').textContent='当前浏览器不支持页面全屏，请使用浏览器的全屏模式。';
    } catch {
      $('#selectionAnnouncement').textContent='请使用浏览器的全屏按钮进入全屏展示。';
    }
  });
  document.addEventListener('fullscreenchange',()=>{
    const active=!!document.fullscreenElement;
    $('#fullscreenButton').title=active?'退出全屏':'全屏展示';
    $('#fullscreenButton').setAttribute('aria-label',active?'退出全屏':'全屏展示');
    fitScreen();
  });

  function animateCounts() {
    cancelAnimationFrame(countAnimation);
    const start=performance.now();
    const nodes=$$('.metric strong');
    const step=now=>{
      const progress=Math.min(1,(now-start)/1600);
      const eased=1-Math.pow(1-progress,4);
      nodes.forEach(node=>{
        const value=Number(node.dataset.value);
        const decimals=Number(node.dataset.decimals||0);
        node.textContent=(value*eased).toFixed(decimals);
      });
      if(progress<1) countAnimation=requestAnimationFrame(step);
    };
    if(!reducedMotion) countAnimation=requestAnimationFrame(step);
  }

  function playEntry() {
    clearTimeout(entryTimer);
    dashboard.classList.remove('entering');
    requestAnimationFrame(()=>requestAnimationFrame(()=>dashboard.classList.add('entering')));
    animateCounts();
    entryTimer=setTimeout(()=>dashboard.classList.remove('entering'),4100);
    lastTourTime=performance.now();
  }
  $('#replayButton').addEventListener('click',()=>{
    manualPauseUntil=performance.now()+12000;
    playEntry();
  });

  const canvas=$('#network');
  const context=canvas.getContext('2d',{alpha:true});
  let canvasScale=1;
  let canvasWidth=1920;
  let canvasHeight=1080;

  function fitScreen() {
    const mobile=window.innerWidth<=760;
    const scale=mobile?1:Math.min(window.innerWidth/1920,window.innerHeight/1080);
    dashboard.style.setProperty('--stage-scale',String(scale));
    canvasWidth=mobile?window.innerWidth:1920;
    canvasHeight=mobile?1050:1080;
    canvasScale=Math.min(3,Math.max(1,(window.devicePixelRatio||1)*scale));
    canvas.width=Math.round(canvasWidth*canvasScale);
    canvas.height=Math.round(canvasHeight*canvasScale);
    if(context) context.setTransform(canvasScale,0,0,canvasScale,0,0);
    drawNetwork(performance.now());
  }

  // Deterministic network paths: no random changes to the displayed business data.
  function project(x,z) {return [475+(x-z)*.94,778+(x+z)*.4];}
  const routes=[];
  for(let i=-10;i<=18;i++) {
    const offset=i*88;
    routes.push({a:project(offset,-800),b:project(offset,1800),index:i+10,axis:0});
    routes.push({a:project(-900,offset),b:project(1900,offset),index:i+10,axis:1});
  }

  function drawNetwork(now) {
    if(!context) return;
    context.clearRect(0,0,canvasWidth,canvasHeight);
    context.save();
    if(window.innerWidth<=760) context.scale(canvasWidth/950,canvasWidth/950);
    context.beginPath();
    context.rect(0,480,1920,600);
    context.clip();
    const mask=context.createLinearGradient(0,475,0,1050);
    mask.addColorStop(0,'rgba(5,92,197,0)');
    mask.addColorStop(.3,'rgba(5,85,206,.13)');
    mask.addColorStop(.8,'rgba(8,105,229,.28)');
    mask.addColorStop(1,'rgba(10,73,152,.18)');
    context.lineWidth=.65;
    for(const route of routes) {
      context.strokeStyle=mask;
      context.beginPath();context.moveTo(...route.a);context.lineTo(...route.b);context.stroke();
      if(route.index%3===0) {
        const progress=((reducedMotion?0:now*.000022)+(route.index*.147)+(route.axis*.4))%1;
        const tail=Math.max(0,progress-.046);
        const lerp=(t)=>[route.a[0]+(route.b[0]-route.a[0])*t,route.a[1]+(route.b[1]-route.a[1])*t];
        const a=lerp(tail),b=lerp(progress);
        if(b[1]<550||b[1]>1100) continue;
        const isViolet=route.index%7===0;
        const color=isViolet?'139,28,254':'0,142,255';
        const gradient=context.createLinearGradient(...a,...b);
        gradient.addColorStop(0,`rgba(${color},0)`);gradient.addColorStop(.85,`rgba(${color},.44)`);gradient.addColorStop(1,`rgba(${color},.9)`);
        context.strokeStyle=gradient;context.lineWidth=1.6;context.shadowBlur=8;context.shadowColor=`rgba(${color},.7)`;
        context.beginPath();context.moveTo(...a);context.lineTo(...b);context.stroke();
        context.fillStyle=isViolet?'#b754ff':'#4bcaff';context.fillRect(b[0]-1.2,b[1]-1.2,2.4,2.4);context.shadowBlur=0;
      }
    }
    for(let x=-4;x<11;x++) for(let z=-2;z<9;z++) {
      if((x+z)%3!==0) continue;
      const p=project(x*88,z*88);
      const opacity=.23+.2*Math.sin((reducedMotion?0:now*.001)+x+z);
      context.fillStyle=`rgba(32,155,255,${opacity})`;
      context.fillRect(p[0]-1,p[1]-1,2,2);
    }
    context.restore();
  }

  function frame(now) {
    if(!document.hidden) {
      if(!reducedMotion&&now-lastDraw>32) {drawNetwork(now);lastDraw=now;}
      if(touring&&now>manualPauseUntil&&now-lastTourTime>8500) {
        const sequence=companies.map(c=>c.floor);
        const index=sequence.indexOf(selectedFloor);
        selectFloor(sequence[(index+1)%sequence.length]);
        lastTourTime=now;
      }
    }
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize',fitScreen,{passive:true});
  document.addEventListener('visibilitychange',()=>{lastTourTime=performance.now();});
  createFloors();
  renderCompanies();
  updateTabs();
  updateFloorVisuals();
  updateTourButton();
  fitScreen();
  const buildingImage=$('#buildingImage');
  if(buildingImage.complete&&buildingImage.naturalWidth>0) playEntry();
  else {
    buildingImage.addEventListener('load',playEntry,{once:true});
    buildingImage.addEventListener('error',()=>{
      $('#selectionAnnouncement').textContent='建筑图片暂时无法加载，请刷新页面。';
      dashboard.classList.remove('entering');
    },{once:true});
  }
  requestAnimationFrame(frame);
})();
