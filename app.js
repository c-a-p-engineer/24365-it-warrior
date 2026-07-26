const ROLES=[
{id:'engineer',name:'エンジニア',stats:{programming:5,infrastructure:2,customer:1,ai:2,research:3},bonus:'プログラミングカードの効果+2'},
{id:'pm',name:'PM',stats:{programming:1,infrastructure:1,customer:5,ai:2,research:4},bonus:'顧客・管理カードの効果+2'},
{id:'infra',name:'インフラエンジニア',stats:{programming:2,infrastructure:5,customer:1,ai:2,research:3},bonus:'インフラカードの効果+2'},
{id:'qa',name:'QAエンジニア',stats:{programming:3,infrastructure:2,customer:2,ai:2,research:5},bonus:'調査判定と再発防止が得意'}
];
const COMPANIES=[
{id:'enterprise',name:'大企業',desc:'安定しているが会議が多い',hp:24,trust:24,incidentMod:-1},
{id:'ses',name:'SES',desc:'初期能力は高いが週ごとに現場が変わる',hp:22,trust:20,incidentMod:1},
{id:'contract',name:'受託開発',desc:'顧客案件が多く、仕様変更と炎上が起きやすい',hp:20,trust:22,incidentMod:1},
{id:'service',name:'自社サービス',desc:'自由度は高いが技術的負債が蓄積する',hp:21,trust:21,incidentMod:0}
];
const CARDS=[
{id:'logs',name:'ログを読む',type:'programming',power:3,desc:'原因または属性を1つ調査する。'},
{id:'patch',name:'修正パッチ',type:'programming',power:7,desc:'バグ・プログラミング属性に強い。'},
{id:'rollback',name:'ロールバック',type:'programming',power:5,desc:'プログラミング・AI事故に有効。'},
{id:'restart',name:'再起動',type:'infrastructure',power:5,desc:'インフラ障害に有効。原因不明でも当たることがある。',risky:true},
{id:'scale',name:'オートスケール',type:'infrastructure',power:7,desc:'クラウド・アクセス集中に強い。'},
{id:'apology',name:'状況説明と謝罪',type:'customer',power:6,desc:'炎上・顧客属性を沈静化し信用低下も防ぐ。'},
{id:'scope',name:'スコープ調整',type:'customer',power:5,desc:'仕様変更・納期障害に有効。'},
{id:'aiAnalyze',name:'AI原因分析',type:'ai',power:4,desc:'複数情報を調査するが、専門外では誤ることがある。'},
{id:'aiCode',name:'AIコード生成',type:'ai',power:8,desc:'高出力。誤適用時は危険度が大きく上がる。',risky:true},
{id:'test',name:'テスト追加',type:'programming',power:4,desc:'バグを沈静化し、再発率を下げる。'},
{id:'assign',name:'担当者アサイン',type:'management',power:4,desc:'人的障害と複合障害に有効。'},
{id:'escalate',name:'エスカレーション',type:'management',power:5,desc:'重大障害の危険度を1下げる。'}
];
const INCIDENT_TEMPLATES=[
{id:'null',name:'本番でNull例外',attrs:['programming','bug'],cause:'未処理のnull値',need:{programming:3},research:3,carry:true,base:8},
{id:'db',name:'DB接続枯渇',attrs:['infrastructure','cloud'],cause:'コネクションプール不足',need:{infrastructure:4},research:4,carry:false,base:11},
{id:'dns',name:'クラウドDNS障害',attrs:['infrastructure','customer'],cause:'DNS設定の反映漏れ',need:{infrastructure:4},research:5,carry:false,base:12},
{id:'spec',name:'突然の仕様変更',attrs:['customer','management'],cause:'要件合意の不足',need:{customer:3},research:3,carry:true,base:9},
{id:'fire',name:'SNSでサービス炎上',attrs:['customer','fire'],cause:'障害告知の遅延',need:{customer:4},research:4,carry:false,base:12},
{id:'aiLeak',name:'AI生成コードから情報漏洩',attrs:['ai','programming','customer'],cause:'生成物の未レビュー',need:{ai:4,programming:3},research:5,carry:false,base:15},
{id:'retired',name:'担当者が退職済み',attrs:['management','programming'],cause:'引き継ぎ資料が存在しない',need:{customer:2,programming:3},research:4,carry:true,base:10},
{id:'latency',name:'API応答遅延',attrs:['programming','infrastructure'],cause:'N+1クエリと負荷集中',need:{programming:4,infrastructure:3},research:5,carry:true,base:13}
];
const WEEKDAYS=['月曜日','火曜日','水曜日','木曜日','金曜日','土曜日','日曜日'];
const PHASES=['出勤時','ランチ','定時後','深夜対応'];
const RANKS=[{name:'新人',days:1,support:0},{name:'一般社員',days:4,support:1},{name:'リーダー',days:10,support:2},{name:'課長',days:20,support:2},{name:'部長',days:35,support:2}];
const BUSINESS=[
{id:'dev',name:'開発',desc:'次の障害を弱体化。低確率で新しいバグを生む。'},
{id:'hire',name:'採用',desc:'職位ポイントを獲得し、支援枠解放を早める。'},
{id:'sales',name:'営業',desc:'信用を回復するが翌日の障害数が増える可能性。'},
{id:'improve',name:'業務改善',desc:'体力を少し消費して手札を1枚強化する。'}
];
let state=null;
const $=id=>document.getElementById(id);
function sample(arr){return arr[Math.floor(Math.random()*arr.length)]}
function shuffle(arr){return [...arr].sort(()=>Math.random()-.5)}
function selectedRole(){return ROLES.find(x=>x.id===document.querySelector('[name=role]:checked')?.value)||ROLES[0]}
function selectedCompany(){return COMPANIES.find(x=>x.id===document.querySelector('[name=company]:checked')?.value)||COMPANIES[0]}
function renderSetup(){
 $('role-options').innerHTML=ROLES.map((r,i)=>`<label class="choice ${i===0?'selected':''}"><input hidden type="radio" name="role" value="${r.id}" ${i===0?'checked':''}><strong>${r.name}</strong><small>${r.bonus}<br>技術${r.stats.programming} 運用${r.stats.infrastructure} 調整${r.stats.customer} 調査${r.stats.research}</small></label>`).join('');
 $('company-options').innerHTML=COMPANIES.map((c,i)=>`<label class="choice ${i===0?'selected':''}"><input hidden type="radio" name="company" value="${c.id}" ${i===0?'checked':''}><strong>${c.name}</strong><small>${c.desc}</small></label>`).join('');
 document.querySelectorAll('.choice input').forEach(x=>x.addEventListener('change',e=>{document.querySelectorAll(`[name=${e.target.name}]`).forEach(i=>i.closest('.choice').classList.toggle('selected',i.checked))}));
 renderBest();
}
function startGame(){
 const role=selectedRole(),company=selectedCompany();
 state={day:1,phase:0,hp:company.hp,trust:company.trust,role,company,incidents:[],deck:shuffle([...CARDS,...CARDS.slice(0,4)]),hand:[],resolved:0,unknownResolved:0,history:[`1日目 ${company.name} ${role.name}として入社`],riskDebt:0,nextWeak:0,nextExtra:0,gameOverReason:''};
 drawTo(5);generateDay();show('game-screen');hide('setup-screen');hide('result-screen');render();
}
function drawTo(n){while(state.hand.length<n){if(!state.deck.length)state.deck=shuffle(CARDS);state.hand.push(state.deck.shift())}}
function currentRank(){return [...RANKS].reverse().find(r=>state.day>=r.days)||RANKS[0]}
function generateDay(){
 state.phase=0;
 const weekday=(state.day-1)%7;
 let count=Math.max(0,1+state.company.incidentMod+state.nextExtra+(weekday===4?1:0));
 if(weekday>=5&&Math.random()<.5)count=0;
 if(weekday>=5&&Math.random()<.25)count=1;
 state.nextExtra=0;
 const existing=state.incidents.filter(i=>i.carry);
 state.incidents=existing;
 for(let i=0;i<count;i++)state.incidents.push(createIncident(weekday));
 log(`${state.day}日目 ${WEEKDAYS[weekday]}。${state.incidents.length?`${state.incidents.length}件の障害を確認。`:'障害は発生していない。'}`);
 autoInspect();
}
function createIncident(weekday){
 const t=sample(INCIDENT_TEMPLATES);let max=t.base+Math.floor(state.day/7)+(weekday===4?3:0)-state.nextWeak;state.nextWeak=0;
 return {...t,uid:crypto.randomUUID?.()||String(Math.random()),max,remain:max,danger:weekday===4?3:2,revealedAttrs:[],causeKnown:false};
}
function autoInspect(){state.incidents.forEach(i=>{
 const stats=state.role.stats;const relevant=Object.entries(i.need).some(([k,v])=>stats[k]>=v);const research=stats.research>=i.research;
 if(relevant||research){i.causeKnown=true;i.revealedAttrs=[...i.attrs];log(`${i.name}の原因を確定特定：${i.cause}`)}else{
  i.revealedAttrs=i.attrs.filter(a=>{const val=stats[a]||0;const need=i.need[a]||4;if(val<=0)return false;return Math.random()<Math.max(.15,.75-(need-val)*.2)});
 }});}
function inspectIncident(i,card){
 const stats=state.role.stats;const guaranteed=stats.research+card.power>=i.research+4;
 if(guaranteed||Math.random()<.65){i.causeKnown=true;i.revealedAttrs=[...i.attrs];log(`${card.name}で${i.name}の原因を特定：${i.cause}`)}else{const hidden=i.attrs.filter(a=>!i.revealedAttrs.includes(a));if(hidden.length)i.revealedAttrs.push(sample(hidden));log(`${card.name}で${i.name}の属性を一部確認した。`)}
}
function cardMatches(card,incident){
 const aliases={programming:['programming','bug'],infrastructure:['infrastructure','cloud'],customer:['customer','fire'],ai:['ai'],management:['management']};
 return aliases[card.type]?.some(a=>incident.attrs.includes(a));
}
function useCard(cardIndex,incidentIndex){
 if(!state||state.phase>=4)return;
 const card=state.hand[cardIndex],incident=state.incidents[incidentIndex];if(!card||!incident)return;
 if(card.id==='logs'||card.id==='aiAnalyze'){inspectIncident(incident,card)}else if(card.id==='escalate'){incident.danger=Math.max(1,incident.danger-1);log(`${card.name}で${incident.name}の危険度を下げた。`)}else{
  const match=cardMatches(card,incident);let power=card.power;
  if(card.type==='programming'&&state.role.id==='engineer')power+=2;if(card.type==='infrastructure'&&state.role.id==='infra')power+=2;if((card.type==='customer'||card.type==='management')&&state.role.id==='pm')power+=2;
  if(!incident.causeKnown)power=Math.ceil(power*.7);
  if(match){incident.remain=Math.max(0,incident.remain-power);log(`${card.name}が有効。${incident.name}を${power}沈静化。`)}else if(card.id==='restart'&&Math.random()<.35){incident.remain=Math.max(0,incident.remain-power);log(`原因不明だが再起動で${incident.name}が改善した。`)}else{incident.danger=Math.min(5,incident.danger+(card.risky?2:1));log(`${card.name}は誤対応。${incident.name}の危険度が上昇。`)}
 }
 state.hand.splice(cardIndex,1);state.deck.push(card);drawTo(5);resolveIncidents();advancePhase();
}
function resolveIncidents(){
 const cleared=state.incidents.filter(i=>i.remain<=0);cleared.forEach(i=>{state.resolved++;if(!i.causeKnown)state.unknownResolved++;log(`${i.name}を解決。${i.causeKnown?`原因：${i.cause}`:'原因は不明のまま。'}`)});state.incidents=state.incidents.filter(i=>i.remain>0);
}
function enemyAction(){state.incidents.forEach(i=>{const damage=i.danger+(i.attrs.includes('customer')?1:0);if(i.attrs.includes('customer')||i.attrs.includes('fire'))state.trust-=damage;else state.hp-=damage;log(`${i.name}が悪化。${i.attrs.includes('customer')||i.attrs.includes('fire')?'信用':'体力'}-${damage}`)});}
function advancePhase(){
 state.phase++;if(state.phase<4&&state.incidents.length)enemyAction();
 if(state.hp<=0)return endGame('過労による休職');if(state.trust<=0)return endGame('信用失墜による契約終了');
 if(state.phase>=4)endDay();else render();
}
function passTurn(){if(!state)return;const old=state.hand.shift();state.deck.push(old);drawTo(5);log('対応を見送り、手札を交換した。');advancePhase();}
function businessAction(id){
 const b=BUSINESS.find(x=>x.id===id);if(!b||state.phase>=4)return;
 if(id==='dev'){state.nextWeak+=2;if(Math.random()<.2)state.nextExtra++;log('開発を進めた。次の障害は弱体化する。')}
 if(id==='hire'){state.day+=1;state.day-=1;log('採用活動を実施。支援人材候補を確保した。')}
 if(id==='sales'){state.trust=Math.min(30,state.trust+3);if(Math.random()<.4)state.nextExtra++;log('営業活動で信用を回復した。')}
 if(id==='improve'){state.hp-=1;const c=sample(state.hand);c.power+=1;log(`${c.name}を業務改善で強化した。`)}
 state.phase++;if(state.phase>=4)endDay();else render();
}
function leaveEarly(){const heal=Math.max(0,4-state.phase)*2;state.hp=Math.min(30,state.hp+heal);log(`早期退勤。体力を${heal}回復。`);endDay(true)}
function endDay(){
 const fatal=state.incidents.find(i=>!i.carry);if(fatal)return endGame(`${fatal.name}を当日中に解決できなかった`);
 state.incidents.forEach(i=>{i.danger=Math.min(5,i.danger+1);i.max+=2;i.remain+=2});
 state.day++;
 if((state.day-1)%7===0){const options=COMPANIES.filter(c=>c.id!==state.company.id);if(state.company.id==='ses'||Math.random()<.35){const next=sample(options);state.history.push(`${state.day}日目 ${next.name}へ転職`);state.company=next;state.hp=Math.min(30,state.hp+4);log(`週次イベント：${next.name}へ転職した。`)}else{state.history.push(`${state.day}日目 ${state.company.name}に残留`);state.trust=Math.min(30,state.trust+2);log('週次イベント：現職に残留した。')}}
 generateDay();render();
}
function endGame(reason){state.gameOverReason=reason;const record={days:state.day,role:state.role.name,company:state.company.name,rank:currentRank().name,resolved:state.resolved,unknown:state.unknownResolved,history:state.history,reason};const best=JSON.parse(localStorage.getItem('itWarriorBest')||'null');if(!best||record.days>best.days)localStorage.setItem('itWarriorBest',JSON.stringify(record));renderCareer(record);hide('game-screen');show('result-screen');}
function render(){
 $('day-value').textContent=`${state.day}日`;$('weekday-value').textContent=WEEKDAYS[(state.day-1)%7];$('hp-value').textContent=Math.max(0,state.hp);$('trust-value').textContent=Math.max(0,state.trust);$('rank-value').textContent=currentRank().name;$('phase-value').textContent=PHASES[Math.min(state.phase,3)];
 $('incident-list').innerHTML=state.incidents.length?state.incidents.map((i,index)=>`<article class="incident ${i.danger>=4?'danger':''}"><header><h3>${i.name}</h3><strong>危険度 ${i.danger}</strong></header><p>${i.causeKnown?`原因：${i.cause}`:'原因：未特定'} ／ ${i.carry?'持ち越し可':'本日中に解決必須'}</p><div class="tags">${(i.revealedAttrs.length?i.revealedAttrs:['属性不明']).map(a=>`<span class="tag">${a}</span>`).join('')}</div><div class="progress"><span style="width:${Math.max(0,(i.max-i.remain)/i.max*100)}%"></span></div><small>残り対応値 ${i.remain} / ${i.max}</small><div class="incident-target"><label>この障害へ使用：</label><select data-incident="${index}"><option value="">カードを選択</option>${state.hand.map((c,ci)=>`<option value="${ci}">${c.name}</option>`).join('')}</select></div></article>`).join(''):'<p>現在、対応中の障害はありません。</p>';
 document.querySelectorAll('[data-incident]').forEach(s=>s.addEventListener('change',e=>{if(e.target.value!=='')useCard(Number(e.target.value),Number(e.target.dataset.incident))}));
 $('hand').innerHTML=state.hand.map(c=>`<article class="game-card ${c.risky?'risky':''}"><span class="type">${c.type.toUpperCase()}</span><span class="power">${c.power}</span><strong>${c.name}</strong><small>${c.desc}</small></article>`).join('');
 const noIncidents=!state.incidents.length;$('business-panel').classList.toggle('hidden',!noIncidents);$('leave-early').classList.toggle('hidden',!noIncidents);$('pass-turn').disabled=noIncidents;
 $('business-actions').innerHTML=BUSINESS.map(b=>`<button class="business-action" data-business="${b.id}" type="button"><strong>${b.name}</strong><small>${b.desc}</small></button>`).join('');document.querySelectorAll('[data-business]').forEach(b=>b.addEventListener('click',()=>businessAction(b.dataset.business)));
}
function renderCareer(r){$('career-sheet').innerHTML=`<h3>職務経歴書</h3><dl class="career-grid"><dt>通算連勤日数</dt><dd>${r.days}日</dd><dt>最終職種</dt><dd>${r.role}</dd><dt>最終職位</dt><dd>${r.rank}</dd><dt>最終勤務先</dt><dd>${r.company}</dd><dt>障害解決実績</dt><dd>${r.resolved}件（なぜか直った：${r.unknown}件）</dd><dt>勤務経歴</dt><dd>${r.history.join('<br>')}</dd><dt>退職理由</dt><dd>${r.reason}</dd><dt>自己PR</dt><dd>限られた4ターンで複数障害に優先順位を付け、深夜まで対応できます。</dd></dl>`}
function renderBest(){const best=JSON.parse(localStorage.getItem('itWarriorBest')||'null');$('best-record').innerHTML=best?`<strong>${best.days}連勤</strong>／${best.role}／${best.company}／障害${best.resolved}件解決`:'まだ職務経歴がありません。'}
function log(text){const li=document.createElement('li');li.textContent=text;$('battle-log').prepend(li)}
function show(id){$(id).classList.remove('hidden')}function hide(id){$(id).classList.add('hidden')}
$('start-game').addEventListener('click',startGame);$('pass-turn').addEventListener('click',passTurn);$('leave-early').addEventListener('click',leaveEarly);$('retire-button').addEventListener('click',()=>endGame('自己都合退職'));$('retry-button').addEventListener('click',()=>{hide('result-screen');show('setup-screen');renderSetup()});$('reset-save').addEventListener('click',()=>{localStorage.removeItem('itWarriorBest');renderBest()});
renderSetup();
