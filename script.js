const CONFIG={SCRIPT_URL:'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',CSV_FILE:'cascading_data.csv'};
const USERS_DB={
    // DHMT users
    'dhmt001':{password:'dhmt001',name:'DHMT Officer Bo',role:'dhmt',dp_id:'dp001'},
    'dhmt002':{password:'dhmt002',name:'DHMT Officer Kenema',role:'dhmt',dp_id:'dp005'},
    // PHU users
    'phu001':{password:'phu001',name:'PHU Officer Kakua',role:'phu',dp_id:'dp001'},
    'phu002':{password:'phu002',name:'PHU Officer Nongowa',role:'phu',dp_id:'dp005'},
    // Field agents
    'user001':{password:'pass001',name:'Mohamed Kanu',role:'field_agent',dp_id:'dp001'},
    'user002':{password:'pass002',name:'Fatmata Sesay',role:'field_agent',dp_id:'dp002'},
    'user003':{password:'pass003',name:'Ibrahim Kamara',role:'field_agent',dp_id:'dp005'},
    'user004':{password:'pass004',name:'Aminata Conteh',role:'field_agent',dp_id:'dp006'},
    'user005':{password:'pass005',name:'Abu Bangura',role:'field_agent',dp_id:'dp008'},
    'user006':{password:'pass006',name:'Mariama Jalloh',role:'field_agent',dp_id:'dp011'},
    'user007':{password:'pass007',name:'Samuel Koroma',role:'field_agent',dp_id:'dp013'},
    'user008':{password:'pass008',name:'Hawa Turay',role:'field_agent',dp_id:'dp015'},
    'user009':{password:'pass009',name:'Alhaji Sesay',role:'field_agent',dp_id:'dp016'},
    'user010':{password:'pass010',name:'Isata Mansaray',role:'field_agent',dp_id:'dp019'},
    'sup001':{password:'sup001',name:'John Supervisor',role:'supervisor',dp_id:'dp001'},
    'admin':{password:'admin123',name:'Admin User',role:'admin',dp_id:'dp001'}
};
const ROLE_LABELS={dhmt:'DHMT Distribution',phu:'PHU Distribution',field_agent:'Field Agent',supervisor:'Supervisor',admin:'Administrator'};

let cascadingData=[],csvLoaded=false,lastReceipt=null,progressChart=null,hourlyChart=null;
const state={isLoggedIn:false,currentUser:null,currentDP:null,geoInfo:{},registrations:[],distributions:[],itnStock:[],dhmtRecords:[],phuRecords:[],syncLog:[],isOnline:navigator.onLine};

// INIT
function init(){loadFromStorage();loadCascadingCSV();populateCredentialsTable();setupEventListeners();
    if(state.isLoggedIn&&state.currentUser)routeUser();
    if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(function(){});
}
function loadFromStorage(){try{var s=localStorage.getItem('itn_mass_state');if(s)Object.assign(state,JSON.parse(s));}catch(e){}}
function saveToStorage(){try{localStorage.setItem('itn_mass_state',JSON.stringify(state));}catch(e){}}

// CSV
function loadCascadingCSV(){var el=document.getElementById('csvStatus');
    Papa.parse(CONFIG.CSV_FILE,{download:true,header:true,skipEmptyLines:true,
        complete:function(r){cascadingData=r.data.filter(function(row){return row.district&&row.dp_id;});csvLoaded=true;
            if(el)el.innerHTML='<div class="csv-loaded"><span style="font-size:16px;">✓</span> <span>Loaded <strong>'+cascadingData.length+'</strong> points</span></div>';
            onUserIdInput();populateCredentialsTable();},
        error:function(){csvLoaded=false;if(el)el.innerHTML='<div class="csv-error"><span>✗</span> CSV not loaded</div>';}
    });
}

// CREDENTIALS TABLE
function populateCredentialsTable(){var tb=document.getElementById('credTableBody');if(!tb)return;tb.innerHTML='';
    for(var uid in USERS_DB){var u=USERS_DB[uid];var loc=u.dp_id;
        if(csvLoaded){var r=cascadingData.find(function(x){return x.dp_id===u.dp_id;});if(r)loc=r.distribution_point+' ('+r.district+')';}
        var roleLabel=ROLE_LABELS[u.role]||u.role;
        var badge='';if(u.role==='dhmt')badge='<span style="background:#6f42c1;color:#fff;padding:2px 6px;border-radius:8px;font-size:9px;">DHMT</span>';
        else if(u.role==='phu')badge='<span style="background:#e91e8c;color:#fff;padding:2px 6px;border-radius:8px;font-size:9px;">PHU</span>';
        else badge='<span style="background:#0056a8;color:#fff;padding:2px 6px;border-radius:8px;font-size:9px;">FIELD</span>';
        tb.innerHTML+='<tr><td class="uid">'+uid+'</td><td class="pwd">'+u.password+'</td><td>'+u.name+'</td><td>'+badge+'</td><td>'+loc+'</td></tr>';
    }
}
function toggleCredentials(){var w=document.getElementById('credTableWrap'),c=document.getElementById('credChevron');if(!w)return;
    if(w.style.display==='none'){w.style.display='block';if(c)c.classList.add('open');populateCredentialsTable();}
    else{w.style.display='none';if(c)c.classList.remove('open');}}

// USER ID → AUTO-FILL
function onUserIdInput(){var uid=document.getElementById('loginUserId').value.trim().toLowerCase(),block=document.getElementById('autoAssignment');
    if(!uid||!USERS_DB[uid]||!csvLoaded){if(block)block.style.display='none';return;}
    var u=USERS_DB[uid],dpRow=cascadingData.find(function(r){return r.dp_id===u.dp_id;});
    if(!dpRow){if(block)block.style.display='none';return;}
    document.getElementById('assignRole').value=ROLE_LABELS[u.role]||u.role;
    document.getElementById('assignDP').value=dpRow.distribution_point||'';
    document.getElementById('assignDistrict').value=dpRow.district||'';
    document.getElementById('assignCommunity').value=dpRow.community||'';
    var title=document.getElementById('assignTitleText'),titleDiv=document.getElementById('assignTitle');
    if(u.role==='dhmt'){title.textContent='DHMT — DISTRICT LEVEL';titleDiv.style.background='#6f42c1';}
    else if(u.role==='phu'){title.textContent='PHU — HEALTH UNIT LEVEL';titleDiv.style.background='#e91e8c';}
    else{title.textContent='YOUR ASSIGNED LOCATION';titleDiv.style.background='#28a745';}
    if(block)block.style.display='block';
}

// EVENTS
function setupEventListeners(){
    window.addEventListener('online',function(){state.isOnline=true;updateOnlineStatus();showNotification('Back online!','success');});
    window.addEventListener('offline',function(){state.isOnline=false;updateOnlineStatus();showNotification('Offline — data saved locally','warning');});
    document.addEventListener('input',function(e){
        if(e.target.classList.contains('phone-field')||e.target.type==='tel')e.target.value=e.target.value.replace(/\D/g,'').slice(0,9);
        if(e.target.classList.contains('name-field'))e.target.value=e.target.value.replace(/[0-9]/g,'');
    });
    document.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.id==='dist_voucher_scan'){e.preventDefault();verifyVoucher();}});
}
function updateOnlineStatus(){var i=document.getElementById('statusIndicator'),t=document.getElementById('statusText');if(!i||!t)return;
    if(state.isOnline){i.className='status-indicator online';t.textContent='ONLINE';}else{i.className='status-indicator offline';t.textContent='OFFLINE';}}

// LOGIN → ROUTE BY ROLE
function handleLogin(){
    var uid=document.getElementById('loginUserId').value.trim().toLowerCase(),pw=document.getElementById('loginPassword').value,err=document.getElementById('loginError');err.textContent='';
    if(!uid||!pw){err.textContent='Enter User ID and Password';return;}
    var u=USERS_DB[uid];if(!u||u.password!==pw){err.textContent='Invalid credentials';return;}
    if(!csvLoaded){err.textContent='CSV not loaded';return;}
    var dp=cascadingData.find(function(r){return r.dp_id===u.dp_id;});
    if(!dp){err.textContent='DP '+u.dp_id+' not found';return;}
    state.isLoggedIn=true;state.currentUser={id:uid,name:u.name,role:u.role};
    state.currentDP={id:dp.dp_id,name:dp.distribution_point,district:dp.district,chiefdom:dp.chiefdom||'',community:dp.community||''};
    state.geoInfo={district:dp.district,chiefdom:dp.chiefdom||'',community:dp.community||'',distributionPoint:dp.distribution_point};
    saveToStorage();routeUser();showNotification('Welcome, '+u.name+'!','success');
}
function routeUser(){
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('appScreen').style.display='none';
    document.getElementById('dhmtScreen').style.display='none';
    document.getElementById('phuScreen').style.display='none';
    var role=state.currentUser.role;
    if(role==='dhmt'){showDHMTScreen();}
    else if(role==='phu'){showPHUScreen();}
    else{showAppScreen();}
}
function handleLogout(){if(!confirm('Log out?'))return;state.isLoggedIn=false;state.currentUser=null;state.currentDP=null;saveToStorage();
    document.getElementById('appScreen').style.display='none';document.getElementById('dhmtScreen').style.display='none';
    document.getElementById('phuScreen').style.display='none';document.getElementById('loginScreen').style.display='block';
    document.getElementById('loginUserId').value='';document.getElementById('loginPassword').value='';
    document.getElementById('loginError').textContent='';document.getElementById('autoAssignment').style.display='none';
}

// ============ DHMT SCREEN ============
function showDHMTScreen(){
    document.getElementById('dhmtScreen').style.display='block';
    var ut=document.getElementById('dhmtUserTag');if(ut)ut.textContent=state.currentUser.name.split(' ')[0].toUpperCase();
    document.getElementById('dhmtDistrict').textContent=state.geoInfo.district||'—';
    document.getElementById('dhmt_from').value=state.geoInfo.community||state.geoInfo.district||'';
    var df=document.getElementById('dhmt_date');if(df&&!df.value)df.value=new Date().toISOString().split('T')[0];
    renderDHMTHistory();
}
function submitDHMT(){
    var date=document.getElementById('dhmt_date').value,batch=document.getElementById('dhmt_batch').value.trim();
    var type=document.getElementById('dhmt_type').value,qty=parseInt(document.getElementById('dhmt_qty').value)||0;
    var to=document.getElementById('dhmt_to_phu').value.trim(),from=document.getElementById('dhmt_from').value;
    var notes=document.getElementById('dhmt_notes').value.trim();
    if(!date||!type||qty<1||!to){showNotification('Fill date, type, qty, PHU name','error');return;}
    var rec={id:'DHMT-'+Date.now().toString(36).toUpperCase(),timestamp:new Date().toISOString(),date:date,batch:batch,type:type,quantity:qty,
        toPhu:to,from:from,notes:notes,district:state.geoInfo.district,recordedBy:state.currentUser.name,userId:state.currentUser.id,synced:false};
    state.dhmtRecords.push(rec);saveToStorage();showNotification(qty+' '+type+' ITNs → '+to,'success');
    sendToSheet('dhmt_distribution',rec);renderDHMTHistory();
    ['dhmt_batch','dhmt_qty','dhmt_to_phu','dhmt_notes'].forEach(function(id){document.getElementById(id).value='';});
}
function renderDHMTHistory(){var c=document.getElementById('dhmtHistory');if(!c)return;
    if(!state.dhmtRecords.length){c.innerHTML='<div class="no-data">No records</div>';return;}
    c.innerHTML=state.dhmtRecords.slice().reverse().map(function(r){return '<div class="dist-item"><div><div class="dist-hh-name">→ '+r.toPhu+'</div><div class="dist-voucher-code">'+r.quantity+' '+r.type+' | '+r.date+'</div></div><div><div class="dist-badge pass">SENT</div></div></div>';}).join('');}

// ============ PHU SCREEN ============
function showPHUScreen(){
    document.getElementById('phuScreen').style.display='block';
    var ut=document.getElementById('phuUserTag');if(ut)ut.textContent=state.currentUser.name.split(' ')[0].toUpperCase();
    document.getElementById('phuDistrict').textContent=state.geoInfo.district||'—';
    document.getElementById('phuChiefdom').textContent=state.geoInfo.chiefdom||'—';
    document.getElementById('phu_from').value=state.geoInfo.community||state.geoInfo.chiefdom||'';
    var df=document.getElementById('phu_date');if(df&&!df.value)df.value=new Date().toISOString().split('T')[0];
    renderPHUHistory();
}
function submitPHU(){
    var date=document.getElementById('phu_date').value,batch=document.getElementById('phu_batch').value.trim();
    var type=document.getElementById('phu_type').value,qty=parseInt(document.getElementById('phu_qty').value)||0;
    var to=document.getElementById('phu_to_dp').value.trim(),from=document.getElementById('phu_from').value;
    var notes=document.getElementById('phu_notes').value.trim();
    if(!date||!type||qty<1||!to){showNotification('Fill date, type, qty, DP name','error');return;}
    var rec={id:'PHU-'+Date.now().toString(36).toUpperCase(),timestamp:new Date().toISOString(),date:date,batch:batch,type:type,quantity:qty,
        toDp:to,from:from,notes:notes,district:state.geoInfo.district,chiefdom:state.geoInfo.chiefdom,
        recordedBy:state.currentUser.name,userId:state.currentUser.id,synced:false};
    state.phuRecords.push(rec);saveToStorage();showNotification(qty+' '+type+' ITNs → '+to,'success');
    sendToSheet('phu_distribution',rec);renderPHUHistory();
    ['phu_batch','phu_qty','phu_to_dp','phu_notes'].forEach(function(id){document.getElementById(id).value='';});
}
function renderPHUHistory(){var c=document.getElementById('phuHistory');if(!c)return;
    if(!state.phuRecords.length){c.innerHTML='<div class="no-data">No records</div>';return;}
    c.innerHTML=state.phuRecords.slice().reverse().map(function(r){return '<div class="dist-item"><div><div class="dist-hh-name">→ '+r.toDp+'</div><div class="dist-voucher-code">'+r.quantity+' '+r.type+' | '+r.date+'</div></div><div><div class="dist-badge pass">SENT</div></div></div>';}).join('');}

// ============ FIELD AGENT SCREEN ============
function showAppScreen(){
    document.getElementById('appScreen').style.display='block';
    var ut=document.getElementById('userTag');if(ut)ut.textContent=state.currentUser.name.split(' ')[0].toUpperCase();
    document.getElementById('geoDistrict').textContent=state.geoInfo.district||'—';
    document.getElementById('geoChiefdom').textContent=state.geoInfo.chiefdom||'—';
    document.getElementById('geoCommunity').textContent=state.geoInfo.community||'—';
    document.getElementById('geoDP').textContent=state.geoInfo.distributionPoint||'—';
    // Prefill "Received From" with community name
    var rf=document.getElementById('itn_recv_from');if(rf)rf.value=state.geoInfo.community||state.geoInfo.chiefdom||'';
    updateOnlineStatus();updateAllCounts();updateStockSummary();updateDistHistory();updateSyncStats();generateHHId();captureRegGPS();checkStockForDistribution();
    var df=document.getElementById('itn_recv_date');if(df&&!df.value)df.value=new Date().toISOString().split('T')[0];
}

// TABS
function switchTab(id){
    document.querySelectorAll('.tab-controls .control-btn').forEach(function(b){b.classList.remove('active');});
    document.querySelector('.tab-controls [data-tab="'+id+'"]').classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active');});
    document.getElementById('tab-'+id).classList.add('active');
    if(id==='distribution'){setTimeout(function(){var s=document.getElementById('dist_voucher_scan');if(s)s.focus();},100);checkStockForDistribution();}
    if(id==='dashboard')refreshDashboard();
}

// STOCK CHECK
function getStockReceived(){var t=0;state.itnStock.forEach(function(s){t+=s.quantity;});return t;}
function getDistributed(){return state.distributions.length;}
function getStockRemaining(){return getStockReceived()-getDistributed();}
function checkStockForDistribution(){
    var warn=document.getElementById('stockWarning'),txt=document.getElementById('stockWarningText');if(!warn)return;
    var received=getStockReceived(),remaining=getStockRemaining();
    if(received===0){warn.style.display='flex';warn.style.background='#f8d7da';warn.style.borderColor='#dc3545';warn.style.color='#721c24';txt.textContent='No stock received! Go to ITN STOCK tab first.';return;}
    if(remaining<=0){warn.style.display='flex';warn.style.background='#f8d7da';warn.style.borderColor='#dc3545';warn.style.color='#721c24';txt.textContent='All stock distributed! Record more in ITN STOCK.';return;}
    if(remaining<=5){warn.style.display='flex';warn.style.background='#fff3cd';warn.style.borderColor='#ffc107';warn.style.color='#856404';txt.textContent='Low stock: '+remaining+' ITN(s) remaining.';return;}
    warn.style.display='none';
}

// VOUCHER
function generateVoucherCode(){var dp=state.currentDP?state.currentDP.id.replace('dp','').toUpperCase():'XX';
    var d=new Date(),date=d.getFullYear()+''+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
    return 'VCH-'+dp.padStart(3,'0')+'-'+date+'-'+Math.random().toString(36).toUpperCase().slice(2,8);}
function generateHHId(){var dp=state.currentDP?state.currentDP.id.replace('dp','').toUpperCase():'XX';
    var el=document.getElementById('reg_hh_id');if(el)el.value='HH-'+dp.padStart(3,'0')+'-'+Date.now().toString(36).toUpperCase().slice(-6)+'-'+Math.random().toString(36).toUpperCase().slice(2,5);}

// REG FORM
function onTotalPeopleChange(){var t=parseInt(document.getElementById('reg_total_people').value)||0;showVoucherPreview(t);checkGenderSum();}
function onGenderChange(){checkGenderSum();}
function onVulnerableChange(){
    var t=parseInt(document.getElementById('reg_total_people').value)||0,f=parseInt(document.getElementById('reg_females').value)||0;
    var u5=parseInt(document.getElementById('reg_under5').value)||0,pr=parseInt(document.getElementById('reg_pregnant').value)||0;
    var eU=document.getElementById('error_reg_under5'),eP=document.getElementById('error_reg_pregnant');
    if(u5>t){if(eU){eU.textContent='Cannot exceed total';eU.classList.add('show');}}else{if(eU){eU.textContent='';eU.classList.remove('show');}}
    if(pr>f){if(eP){eP.textContent='Cannot exceed females';eP.classList.add('show');}}else{if(eP){eP.textContent='';eP.classList.remove('show');}}
}
function checkGenderSum(){var t=parseInt(document.getElementById('reg_total_people').value)||0,m=parseInt(document.getElementById('reg_males').value)||0,f=parseInt(document.getElementById('reg_females').value)||0;
    var el=document.getElementById('genderCheck'),tx=document.getElementById('genderCheckText');if(!el||!tx)return;
    if(t>0&&(m>0||f>0)){el.style.display='flex';
        if(m+f===t){el.className='validation-note gender-check match';tx.textContent='✓ Males ('+m+') + Females ('+f+') = Total ('+t+')';}
        else{el.className='validation-note gender-check mismatch';tx.textContent='⚠ Males ('+m+') + Females ('+f+') = '+(m+f)+' ≠ Total ('+t+')';}
    }else el.style.display='none';}
function showVoucherPreview(tp){var b=document.getElementById('voucherPreview');if(tp<=0){b.style.display='none';return;}
    var c;if(tp<=3)c=1;else if(tp<=5)c=2;else c=3;b.style.display='block';
    document.getElementById('voucherPreviewContent').innerHTML='<div class="voucher-formula-text">'+tp+' people → '+c+' voucher(s) = '+c+' ITN(s)</div>';}
function captureRegGPS(){var dot=document.getElementById('regGpsDot'),text=document.getElementById('regGpsText'),coords=document.getElementById('regGpsCoords');
    if(!navigator.geolocation){if(dot)dot.className='gps-icon error';if(text)text.textContent='Not supported';return;}
    if(dot)dot.className='gps-icon loading';if(text)text.textContent='Capturing...';if(coords)coords.textContent='';
    navigator.geolocation.getCurrentPosition(function(p){document.getElementById('reg_gps_lat').value=p.coords.latitude.toFixed(6);document.getElementById('reg_gps_lng').value=p.coords.longitude.toFixed(6);document.getElementById('reg_gps_acc').value=Math.round(p.coords.accuracy);
        if(dot)dot.className='gps-icon success';if(text)text.textContent='GPS captured!';if(coords)coords.textContent=p.coords.latitude.toFixed(5)+', '+p.coords.longitude.toFixed(5);
    },function(){if(dot)dot.className='gps-icon error';if(text)text.textContent='Failed (optional)';},{enableHighAccuracy:true,timeout:15000});}

// SUBMIT REGISTRATION
function submitRegistration(){
    var name=document.getElementById('reg_hh_name').value.trim(),phone=document.getElementById('reg_hh_phone').value.trim();
    var total=parseInt(document.getElementById('reg_total_people').value)||0,males=parseInt(document.getElementById('reg_males').value)||0,females=parseInt(document.getElementById('reg_females').value)||0;
    var under5=parseInt(document.getElementById('reg_under5').value)||0,pregnant=parseInt(document.getElementById('reg_pregnant').value)||0;
    var hhId=document.getElementById('reg_hh_id').value,err=[];
    if(!name||name.length<2)err.push('Name required');if(/[0-9]/.test(name))err.push('No numbers');
    if(!phone||phone.length!==9)err.push('9-digit phone');if(total<1)err.push('Total ≥ 1');
    if(males+females!==total)err.push('M+F must = total');if(under5>total)err.push('U5 ≤ total');if(pregnant>females)err.push('Preg ≤ females');
    if(err.length){showNotification(err[0],'error');return;}
    var count;if(total<=3)count=1;else if(total<=5)count=2;else count=3;
    var vouchers=[];for(var i=0;i<count;i++){var code;do{code=generateVoucherCode();}while(vouchers.includes(code));vouchers.push(code);}
    var rec={id:hhId,timestamp:new Date().toISOString(),distributionPoint:state.currentDP?state.currentDP.name:'',dpId:state.currentDP?state.currentDP.id:'',
        district:state.geoInfo.district,chiefdom:state.geoInfo.chiefdom,community:state.geoInfo.community,
        registeredBy:state.currentUser?state.currentUser.name:'',userId:state.currentUser?state.currentUser.id:'',
        hhName:name,hhPhone:phone,totalPeople:total,males:males,females:females,under5:under5,pregnant:pregnant,
        vouchers:vouchers,voucherCount:vouchers.length,gpsLat:document.getElementById('reg_gps_lat').value,gpsLng:document.getElementById('reg_gps_lng').value,gpsAcc:document.getElementById('reg_gps_acc').value,
        status:'registered',distributed:false,synced:false};
    state.registrations.push(rec);saveToStorage();showNotification('Registered! '+vouchers.length+' voucher(s)','success');
    sendToSheet('registration',rec);updateAllCounts();lastReceipt=rec;buildReceipt(rec);
    document.getElementById('receiptSection').style.display='block';document.getElementById('receiptSection').scrollIntoView({behavior:'smooth'});
}

// RECEIPT WITH QR
function buildReceipt(rec){var c=document.getElementById('voucherReceipt');
    var ds=new Date(rec.timestamp).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    var ts=new Date(rec.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    var vc='';rec.vouchers.forEach(function(v,i){
        vc+='<div class="receipt-voucher-item"><span class="receipt-voucher-label">VOUCHER '+(i+1)+'</span><span class="receipt-voucher-code">'+v+'</span></div>';
        vc+='<div class="receipt-qr" id="qr_placeholder_'+i+'"></div>';
    });
    c.innerHTML='<div class="receipt-header"><h2>ITN MASS CAMPAIGN</h2><p>ITN Distribution — Sierra Leone</p></div><div class="receipt-divider"></div><div class="receipt-body">'+
        '<div class="receipt-hh-name">'+rec.hhName+'</div><div class="receipt-hh-id">'+rec.id+'</div>'+
        '<div class="receipt-info-grid"><div class="receipt-info-item"><div class="receipt-info-label">Phone</div><div class="receipt-info-value">'+rec.hhPhone+'</div></div>'+
        '<div class="receipt-info-item"><div class="receipt-info-label">HH Size</div><div class="receipt-info-value">'+rec.totalPeople+' ('+rec.males+'M/'+rec.females+'F)</div></div>'+
        '<div class="receipt-info-item"><div class="receipt-info-label">Under 5</div><div class="receipt-info-value">'+rec.under5+'</div></div>'+
        '<div class="receipt-info-item"><div class="receipt-info-label">Pregnant</div><div class="receipt-info-value">'+rec.pregnant+'</div></div>'+
        '<div class="receipt-info-item"><div class="receipt-info-label">District</div><div class="receipt-info-value">'+rec.district+'</div></div>'+
        '<div class="receipt-info-item"><div class="receipt-info-label">Community</div><div class="receipt-info-value">'+rec.community+'</div></div></div>'+
        '<div class="receipt-vouchers-title">'+rec.voucherCount+' VOUCHER(S) — '+rec.voucherCount+' ITN(S)</div>'+vc+
        '<div class="receipt-important"><div class="receipt-important-text">⚠ BRING THIS RECEIPT TO COLLECT YOUR ITN(S)</div></div></div>'+
        '<div class="receipt-footer"><div class="receipt-footer-dp">'+rec.distributionPoint+'</div><div class="receipt-footer-text">By: '+rec.registeredBy+'</div><div class="receipt-footer-date">'+ds+' '+ts+'</div></div>';
    setTimeout(function(){rec.vouchers.forEach(function(v,i){
        var ph=document.getElementById('qr_placeholder_'+i);
        if(ph&&typeof qrcode!=='undefined'){var qr=qrcode(0,'M');qr.addData(v);qr.make();
            ph.innerHTML='<div class="qr-wrap">'+qr.createSvgTag({cellSize:4,margin:2})+'<div class="qr-label">'+v+'</div></div>';}
    });},50);
}
function downloadReceiptImage(){var el=document.getElementById('voucherReceipt');showNotification('Generating...','info');
    html2canvas(el,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false}).then(function(canvas){
        var a=document.createElement('a');a.download='ITN_Voucher_'+(lastReceipt?lastReceipt.hhName.replace(/\s+/g,'_'):'receipt')+'.png';a.href=canvas.toDataURL('image/png');a.click();showNotification('Downloaded!','success');
    }).catch(function(){showNotification('Failed — try PDF','error');});}
function downloadReceiptPDF(){var el=document.getElementById('voucherReceipt');showNotification('Generating...','info');
    html2canvas(el,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false}).then(function(canvas){
        var pdf=new jspdf.jsPDF('p','mm','a4'),pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight();
        var r=Math.min((pw-20)/canvas.width,(ph-20)/canvas.height);
        pdf.addImage(canvas.toDataURL('image/png'),'PNG',(pw-canvas.width*r)/2,10,canvas.width*r,canvas.height*r);
        pdf.save('ITN_Voucher_'+(lastReceipt?lastReceipt.hhName.replace(/\s+/g,'_'):'receipt')+'.pdf');showNotification('Downloaded!','success');
    }).catch(function(){showNotification('Failed','error');});}
function closeReceipt(){document.getElementById('receiptSection').style.display='none';lastReceipt=null;
    ['reg_hh_name','reg_hh_phone','reg_total_people','reg_males','reg_females','reg_under5','reg_pregnant'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('voucherPreview').style.display='none';document.getElementById('genderCheck').style.display='none';
    document.querySelectorAll('.field-error').forEach(function(el){el.textContent='';el.classList.remove('show');});
    generateHHId();captureRegGPS();window.scrollTo({top:0,behavior:'smooth'});}

// DISTRIBUTION VERIFY
function verifyVoucher(){var vc=document.getElementById('dist_voucher_scan').value.trim().toUpperCase(),rb=document.getElementById('verifyResultBlock'),rd=document.getElementById('verifyResult');
    if(!vc){showNotification('Enter code','error');return;}rb.style.display='block';
    if(getStockRemaining()<=0){rd.innerHTML='<div class="verify-fail"><div class="verify-title"><span style="font-size:22px;">✗</span> NO STOCK</div><div class="verify-issues"><div class="verify-issue"><span>⚠</span><span>All stock distributed. Record more in ITN STOCK.</span></div></div></div>';document.getElementById('dist_voucher_scan').value='';return;}
    var reg=null;for(var i=0;i<state.registrations.length;i++){if(state.registrations[i].vouchers&&state.registrations[i].vouchers.includes(vc)){reg=state.registrations[i];break;}}
    var issues=[],tips=[];
    if(!reg){issues.push('Voucher NOT found');tips.push('Check code');tips.push('Register first');}
    if(reg){var ed=null;for(var j=0;j<state.distributions.length;j++){if(state.distributions[j].voucherCode===vc){ed=state.distributions[j];break;}}
        if(ed){issues.push('ALREADY REDEEMED '+new Date(ed.timestamp).toLocaleString());tips.push('Contact supervisor');}
        if(state.currentDP&&reg.dpId!==state.currentDP.id){issues.push('Registered at "'+reg.distributionPoint+'"');tips.push('Send to: '+reg.distributionPoint);}
    }
    if(!issues.length&&reg){
        rd.innerHTML='<div class="verify-pass"><div class="verify-title"><span style="font-size:22px;">✓</span> VERIFIED</div><div class="verify-detail"><strong>Name:</strong> '+reg.hhName+'<br><strong>Phone:</strong> '+reg.hhPhone+'<br><strong>Size:</strong> '+reg.totalPeople+' ('+reg.males+'M/'+reg.females+'F)<br><strong>U5:</strong> '+reg.under5+' | <strong>Preg:</strong> '+reg.pregnant+'</div><div class="verify-action"><div class="navigation-buttons"><button type="button" class="btn-nav btn-submit full-width" onclick="confirmDistribution(\''+vc+'\')">GIVE ITN & CONFIRM</button></div></div></div>';
    }else{rd.innerHTML='<div class="verify-fail"><div class="verify-title"><span style="font-size:22px;">✗</span> FAILED</div><div class="verify-issues">'+issues.map(function(i){return '<div class="verify-issue"><span>⚠</span><span>'+i+'</span></div>';}).join('')+'</div><div class="verify-tips"><div class="verify-tips-title">💡 ACTIONS</div>'+tips.map(function(t){return '<div class="verify-tip">'+t+'</div>';}).join('')+'</div></div>';}
    document.getElementById('dist_voucher_scan').value='';document.getElementById('dist_voucher_scan').focus();
}
function confirmDistribution(vc){if(getStockRemaining()<=0){showNotification('No stock!','error');return;}
    var reg=null;for(var i=0;i<state.registrations.length;i++){if(state.registrations[i].vouchers&&state.registrations[i].vouchers.includes(vc)){reg=state.registrations[i];break;}}if(!reg)return;
    var rec={id:'DIST-'+Date.now().toString(36).toUpperCase(),timestamp:new Date().toISOString(),voucherCode:vc,registrationId:reg.id,
        hhName:reg.hhName,hhPhone:reg.hhPhone,totalPeople:reg.totalPeople,males:reg.males,females:reg.females,under5:reg.under5,pregnant:reg.pregnant,
        distributionPoint:state.currentDP?state.currentDP.name:'',dpId:state.currentDP?state.currentDP.id:'',
        distributedBy:state.currentUser?state.currentUser.name:'',userId:state.currentUser?state.currentUser.id:'',
        district:state.geoInfo.district,chiefdom:state.geoInfo.chiefdom,community:state.geoInfo.community,synced:false};
    state.distributions.push(rec);reg.distributed=true;saveToStorage();document.getElementById('verifyResultBlock').style.display='none';
    showNotification('ITN → '+reg.hhName,'success');sendToSheet('distribution',rec);updateAllCounts();updateDistHistory();updateStockSummary();updateSyncStats();checkStockForDistribution();}
function updateDistHistory(){var c=document.getElementById('distHistory');if(!c)return;var r=state.distributions.slice().reverse().slice(0,30);
    if(!r.length){c.innerHTML='<div class="no-data">No distributions yet</div>';return;}
    c.innerHTML=r.map(function(d){return '<div class="dist-item"><div><div class="dist-hh-name">'+d.hhName+'</div><div class="dist-voucher-code">'+d.voucherCode+'</div></div><div style="text-align:right;"><div class="dist-badge pass">DONE</div><div class="dist-time">'+new Date(d.timestamp).toLocaleTimeString()+'</div></div></div>';}).join('');}

// ITN STOCK
function submitITNReceived(){var date=document.getElementById('itn_recv_date').value,batch=document.getElementById('itn_batch').value.trim();
    var type=document.getElementById('itn_recv_type').value,qty=parseInt(document.getElementById('itn_recv_qty').value)||0;
    var from=document.getElementById('itn_recv_from').value,notes=document.getElementById('itn_recv_notes').value.trim();
    if(!date||!type||qty<1){showNotification('Fill date, type, qty','error');return;}
    var rec={id:'STK-'+Date.now().toString(36).toUpperCase(),timestamp:new Date().toISOString(),date:date,batch:batch,type:type,quantity:qty,from:from,notes:notes,
        distributionPoint:state.currentDP?state.currentDP.name:'',dpId:state.currentDP?state.currentDP.id:'',recordedBy:state.currentUser?state.currentUser.name:'',synced:false};
    state.itnStock.push(rec);saveToStorage();showNotification(qty+' '+type+' ITNs recorded!','success');sendToSheet('stock',rec);
    ['itn_batch','itn_recv_qty','itn_recv_notes'].forEach(function(id){document.getElementById(id).value='';});
    updateStockSummary();updateSyncStats();updateAllCounts();}
function updateStockSummary(){var tR=getStockReceived(),tD=getDistributed();
    var e1=document.getElementById('stockReceived');if(e1)e1.textContent=tR;var e2=document.getElementById('stockDistributed');if(e2)e2.textContent=tD;
    var e3=document.getElementById('stockRemaining');if(e3)e3.textContent=tR-tD;
    var c=document.getElementById('stockHistory');if(!c)return;
    if(!state.itnStock.length){c.innerHTML='<div class="no-data">No records</div>';return;}
    c.innerHTML=state.itnStock.slice().reverse().map(function(s){return '<div class="stock-item"><div><strong>'+s.quantity+' '+s.type+'</strong> <span style="color:#999;margin-left:6px;">'+(s.batch||'—')+'</span></div><div style="color:#999;">'+s.date+'</div></div>';}).join('');}

// DASHBOARD
function refreshDashboard(){var regs=state.registrations,dists=state.distributions,el=function(id){return document.getElementById(id);};
    el('dshRegCount').textContent=regs.length;el('dshDistCount').textContent=dists.length;el('dshStockRem').textContent=getStockRemaining();
    var tP=0,tM=0,tF=0,tU=0,tPr=0,tV=0;
    regs.forEach(function(r){tP+=r.totalPeople;tM+=r.males;tF+=r.females;tU+=r.under5;tPr+=r.pregnant;tV+=r.voucherCount;});
    el('dshPeople').textContent=tP;el('dshMales').textContent=tM;el('dshFemales').textContent=tF;el('dshUnder5').textContent=tU;el('dshPregnant').textContent=tPr;
    el('dshVTotal').textContent=tV;el('dshVRedeemed').textContent=dists.length;el('dshVPending').textContent=tV-dists.length;
    el('dshAvgHH').textContent=regs.length>0?(tP/regs.length).toFixed(1):'0';
    var pCtx=document.getElementById('progressChart');
    if(pCtx){if(progressChart)progressChart.destroy();
        progressChart=new Chart(pCtx,{type:'doughnut',data:{labels:['Distributed','Pending','Stock Unused'],datasets:[{data:[dists.length,Math.max(0,tV-dists.length),Math.max(0,getStockRemaining()-tV+dists.length)],backgroundColor:['#28a745','#ffc107','#0056a8'],borderWidth:2}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{family:'Oswald',size:11}}}}}});}
    var hCtx=document.getElementById('hourlyChart');
    if(hCtx){var hrs=new Array(24).fill(0),dH=new Array(24).fill(0);regs.forEach(function(r){hrs[new Date(r.timestamp).getHours()]++;});dists.forEach(function(d){dH[new Date(d.timestamp).getHours()]++;});
        var lbl=[];for(var i=6;i<=20;i++)lbl.push(i+':00');
        if(hourlyChart)hourlyChart.destroy();
        hourlyChart=new Chart(hCtx,{type:'bar',data:{labels:lbl,datasets:[{label:'Registrations',data:lbl.map(function(_,idx){return hrs[idx+6];}),backgroundColor:'rgba(0,86,168,.7)',borderRadius:4},{label:'Distributions',data:lbl.map(function(_,idx){return dH[idx+6];}),backgroundColor:'rgba(40,167,69,.7)',borderRadius:4}]},options:{responsive:true,scales:{y:{beginAtZero:true,ticks:{stepSize:1}}},plugins:{legend:{labels:{font:{family:'Oswald',size:11}}}}}});}
    renderDataTable();}
function renderDataTable(){var filter=document.getElementById('dataFilter').value,search=(document.getElementById('dataSearch').value||'').toLowerCase(),wrap=document.getElementById('dataTableWrap');
    var data=[],headers=[];
    if(filter==='registrations'){headers=['#','Time','Name','Phone','People','M/F','U5','Preg','Vouchers','Status'];
        data=state.registrations.map(function(r,i){return {cells:[i+1,new Date(r.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),r.hhName,r.hhPhone,r.totalPeople,r.males+'/'+r.females,r.under5,r.pregnant,'<span class="mono">'+(r.vouchers||[]).join(', ')+'</span>',r.distributed?'<span style="color:#28a745;">✓</span>':'<span style="color:#fd7e14;">…</span>'],search:(r.hhName+' '+r.hhPhone+' '+(r.vouchers||[]).join(' ')).toLowerCase()};});}
    else if(filter==='distributions'){headers=['#','Time','Name','Voucher','By'];
        data=state.distributions.map(function(d,i){return {cells:[i+1,new Date(d.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),d.hhName,'<span class="mono">'+d.voucherCode+'</span>',d.distributedBy],search:(d.hhName+' '+d.voucherCode).toLowerCase()};});}
    else{headers=['#','Date','Batch','Type','Qty','From'];
        data=state.itnStock.map(function(s,i){return {cells:[i+1,s.date,s.batch||'—',s.type,s.quantity,s.from||'—'],search:(s.batch+' '+s.type+' '+s.from).toLowerCase()};});}
    if(search)data=data.filter(function(d){return d.search.includes(search);});
    if(!data.length){wrap.innerHTML='<div class="no-data">No records</div>';return;}
    wrap.innerHTML='<table class="data-table"><thead><tr>'+headers.map(function(h){return '<th>'+h+'</th>';}).join('')+'</tr></thead><tbody>'+data.map(function(d){return '<tr>'+d.cells.map(function(c){return '<td>'+c+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';}

// SYNC
function updateSyncStats(){var p=state.registrations.filter(function(r){return !r.synced;}).length+state.distributions.filter(function(d){return !d.synced;}).length+state.itnStock.filter(function(s){return !s.synced;}).length+state.dhmtRecords.filter(function(r){return !r.synced;}).length+state.phuRecords.filter(function(r){return !r.synced;}).length;
    var t=state.registrations.filter(function(r){return r.synced;}).length+state.distributions.filter(function(d){return d.synced;}).length+state.itnStock.filter(function(s){return s.synced;}).length;
    var e1=document.getElementById('syncPending');if(e1)e1.textContent=p;var e2=document.getElementById('syncTotal');if(e2)e2.textContent=t;}
async function syncNow(){var gasInput=document.getElementById('gasUrl');if(gasInput&&gasInput.value.trim())CONFIG.SCRIPT_URL=gasInput.value.trim();
    if(!state.isOnline){showNotification('Offline','error');return;}if(CONFIG.SCRIPT_URL.includes('YOUR_SCRIPT_ID')){showNotification('Set GAS URL','error');return;}
    showNotification('Syncing...','info');addSyncLog('Starting...');var total=0;
    var pR=state.registrations.filter(function(r){return !r.synced;});for(var i=0;i<pR.length;i++){try{await postToGAS('registration',pR[i]);pR[i].synced=true;total++;}catch(e){}}
    var pD=state.distributions.filter(function(d){return !d.synced;});for(var j=0;j<pD.length;j++){try{await postToGAS('distribution',pD[j]);pD[j].synced=true;total++;}catch(e){}}
    var pS=state.itnStock.filter(function(s){return !s.synced;});for(var k=0;k<pS.length;k++){try{await postToGAS('stock',pS[k]);pS[k].synced=true;total++;}catch(e){}}
    saveToStorage();updateSyncStats();addSyncLog('Done: '+total);showNotification('Synced '+total+'!','success');}
function addSyncLog(msg){state.syncLog.unshift({time:new Date().toLocaleTimeString(),message:msg});if(state.syncLog.length>50)state.syncLog=state.syncLog.slice(0,50);
    var c=document.getElementById('syncLog');if(!c)return;c.innerHTML=state.syncLog.map(function(l){return '<div class="sync-log-item"><span class="sync-log-time">'+l.time+'</span><span>'+l.message+'</span></div>';}).join('');}
function sendToSheet(type,data){if(!state.isOnline||CONFIG.SCRIPT_URL.includes('YOUR_SCRIPT_ID'))return;try{fetch(CONFIG.SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,...data})});}catch(e){}}
function postToGAS(type,data){return fetch(CONFIG.SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,...data})});}

// EXPORT
function exportData(){var all=[];
    state.registrations.forEach(function(r){all.push({type:'Registration',id:r.id,timestamp:r.timestamp,district:r.district,chiefdom:r.chiefdom,community:r.community,dp:r.distributionPoint,hhName:r.hhName,hhPhone:r.hhPhone,totalPeople:r.totalPeople,males:r.males,females:r.females,under5:r.under5,pregnant:r.pregnant,vouchers:(r.vouchers||[]).join('; '),voucherCount:r.voucherCount,registeredBy:r.registeredBy,distributed:r.distributed?'Yes':'No'});});
    state.distributions.forEach(function(d){all.push({type:'Distribution',id:d.id,timestamp:d.timestamp,district:d.district,dp:d.distributionPoint,hhName:d.hhName,voucherCode:d.voucherCode,distributedBy:d.distributedBy});});
    state.itnStock.forEach(function(s){all.push({type:'Stock',id:s.id,timestamp:s.timestamp,date:s.date,batch:s.batch,itnType:s.type,quantity:s.quantity,from:s.from,dp:s.distributionPoint});});
    state.dhmtRecords.forEach(function(r){all.push({type:'DHMT',id:r.id,timestamp:r.timestamp,date:r.date,batch:r.batch,itnType:r.type,quantity:r.quantity,toPhu:r.toPhu,from:r.from,district:r.district,recordedBy:r.recordedBy});});
    state.phuRecords.forEach(function(r){all.push({type:'PHU',id:r.id,timestamp:r.timestamp,date:r.date,batch:r.batch,itnType:r.type,quantity:r.quantity,toDp:r.toDp,from:r.from,district:r.district,recordedBy:r.recordedBy});});
    if(!all.length){showNotification('No data','info');return;}
    var keys=new Set();all.forEach(function(item){Object.keys(item).forEach(function(k){keys.add(k);});});var h=Array.from(keys);
    var csv=h.join(',')+'\n';all.forEach(function(item){csv+=h.map(function(k){var v=String(item[k]||'');if(v.includes(',')||v.includes('"'))v='"'+v.replace(/"/g,'""')+'"';return v;}).join(',')+'\n';});
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='itn_campaign_'+new Date().toISOString().split('T')[0]+'.csv';a.click();showNotification('Exported!','success');}

function updateAllCounts(){var e1=document.getElementById('regCount');if(e1)e1.textContent=state.registrations.length;
    var e2=document.getElementById('distCount');if(e2)e2.textContent=state.distributions.length;var e3=document.getElementById('stockCount');if(e3)e3.textContent=getStockReceived();}
function showNotification(msg,type){var n=document.getElementById('notification'),t=document.getElementById('notificationText');if(!n||!t)return;n.className='notification '+type+' show';t.textContent=msg;setTimeout(function(){n.classList.remove('show');},4000);}

init();
