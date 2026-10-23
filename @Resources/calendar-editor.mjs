import { buildMonthMatrix } from './calendar-model.mjs';
import { formatEventTime } from './calendar-week-focus.mjs?v=1.5.0';

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Seoul', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
const dayMs = 86400000;
function midnight(day) { return Date.parse(day + 'T00:00:00+09:00'); }
function nextDay(day, count = 1) { return dayFormat.format(new Date(midnight(day) + count * dayMs)); }
function validDay(day) { return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(midnight(day)) && dayFormat.format(new Date(midnight(day))) === day; }

export function googleEventsByDay(items, range) {
  const result = new Map();
  for (const item of items || []) {
    if (item.status === 'cancelled') continue;
    const allDay = Boolean(item.start?.date);
    const startMs = allDay ? midnight(item.start.date) : Date.parse(item.start?.dateTime);
    const endMs = allDay ? midnight(item.end?.date) : Date.parse(item.end?.dateTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    const first = dayFormat.format(new Date(startMs));
    const lower = range?.start || first, upper = range?.end || nextDay(first, 366);
    for (let time = Math.max(midnight(first), midnight(lower)); time < Math.min(endMs, midnight(upper)); time += dayMs) {
      const key = dayFormat.format(new Date(time));
      const events = result.get(key) || [];
      events.push({
        id:item.id, etag:item.etag, calendarId:range?.calendarId, summary:item.summary??'', title:item.summary || '(제목 없음)', startMs, endMs, allDay, source:'personal',
        recurring:Boolean(item.recurringEventId),
        editable:Boolean(item.id && item.etag && !item.locked && (!item.eventType || item.eventType === 'default') && !item.attendees?.length),
      });
      result.set(key, events);
    }
  }
  for (const events of result.values()) events.sort((a,b) => Number(b.allDay)-Number(a.allDay) || a.startMs-b.startMs || a.title.localeCompare(b.title,'ko'));
  return result;
}

export function eventFormValues(event) {
  const time = value => timeFormat.format(new Date(value)).replace(/:00$/,'');
  return { title:event.summary??event.title, allDay:event.allDay,
    startDate:dayFormat.format(new Date(event.startMs)), endDate:dayFormat.format(new Date(event.endMs - (event.allDay ? 1 : 0))),
    startTime:event.allDay ? '09:00' : time(event.startMs), endTime:event.allDay ? '10:00' : time(event.endMs),
  };
}

export function eventInput(values, {allowEmptyTitle=false} = {}) {
  const summary = String(values.title || '').trim();
  if ((!summary && !allowEmptyTitle) || summary.length > 200) throw new Error('제목을 1~200자로 입력해 주세요.');
  if (!validDay(values.startDate) || !validDay(values.endDate) || values.endDate < values.startDate) throw new Error('시작·종료 날짜를 확인해 주세요.');
  if (values.allDay) return { summary, start:{date:values.startDate}, end:{date:nextDay(values.endDate)} };
  if (![values.startTime,values.endTime].every(value => /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value))) throw new Error('시작·종료 시간을 확인해 주세요.');
  const fullTime = value => value.length === 5 ? value + ':00' : value;
  const start = values.startDate + 'T' + fullTime(values.startTime) + '+09:00', end = values.endDate + 'T' + fullTime(values.endTime) + '+09:00';
  if (Date.parse(end) <= Date.parse(start)) throw new Error('종료 시간은 시작 시간보다 뒤여야 합니다.');
  return { summary, start:{dateTime:start,timeZone:'Asia/Seoul'}, end:{dateTime:end,timeZone:'Asia/Seoul'} };
}

export function eventUpdateInput(values, original) {
  const sameTitle=values.title===(original.summary??original.title);
  const data=eventInput(sameTitle?{...values,title:''}:values,{allowEmptyTitle:true});
  if(sameTitle)delete data.summary;
  return data;
}

const errors = {
  not_connected:'먼저 구글 계정을 연결해 주세요.', denied:'연결 권한을 확인하고 다시 로그인해 주세요.',
  stale:'다른 곳에서 변경된 일정입니다. 목록을 새로고침한 뒤 다시 선택해 주세요.',
  invalid:'입력 내용이나 연결 설정 파일을 확인해 주세요.', timeout:'응답을 받지 못했습니다. 연결 상태를 확인해 주세요.',
  readonly:'참석자가 있거나 읽기 전용인 일정은 구글 캘린더에서 관리해 주세요.',
  busy:'다른 작업을 처리하고 있습니다. 잠시 후 다시 시도해 주세요.',
};
export function createCalendarBridge({ host=globalThis.window, fetcher=globalThis.fetch, delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)), now=Date.now } = {}) {
  let busy = false;
  return {
    get busy() { return busy; },
    async call(action, data = {}) {
      if (busy) throw new Error(errors.busy);
      const api = host?.RainmeterAPI || host?.chrome?.webview?.hostObjects?.sync?.RainmeterAPI;
      if (typeof api?.Bang !== 'function' || typeof api?.ReplaceVariables !== 'function') throw new Error('이 기능은 레인미터에서 사용할 수 있습니다.');
      const requestId = globalThis.crypto.randomUUID();
      const bytes = new TextEncoder().encode(JSON.stringify({ ...data, action, requestId, issuedAt:now() }));
      if (bytes.length > 16000) throw new Error(errors.invalid);
      const payload = btoa(String.fromCharCode(...bytes));
      busy = true;
      try {
        const requestPath = await api.ReplaceVariables('#@#CalendarBridge.ini');
        if (typeof requestPath !== 'string' || !/^(?:[A-Za-z]:\\|\\\\)/.test(requestPath) || /["\r\n]/.test(requestPath) || !requestPath.endsWith('\\CalendarBridge.ini')) throw new Error(errors.invalid);
        await api.Bang('[!WriteKeyValue Variables Request ' + payload + ' "' + requestPath + '"][!CommandMeasure MeasureCalendarBridge "Run"]');
        const deadline = now() + (action === 'connect' ? 220000 : 45000);
        while (now() < deadline) {
          await delay(250);
          let response;
          try {
            const file = await fetcher('./CalendarBridgeResponse.json?ts=' + now(), {cache:'no-store'});
            if (file.ok) response = await file.json();
          } catch {}
          if (response?.requestId !== requestId) continue;
          if (!response.ok) throw new Error(errors[response.error] || '구글 캘린더 요청을 처리하지 못했습니다. 다시 시도해 주세요.');
          return response.data;
        }
        throw new Error(errors.timeout);
      } finally { busy = false; }
    },
  };
}

export function createCalendarEditor({ root=document, host=window, grid, getMonth, onChange }) {
  const bridge = createCalendarBridge({ host, fetcher:host.fetch.bind(host) });
  const get = id => root.querySelector('#' + id);
  const panel = get('calendar-editor'), form = get('editor-form'), view = get('editor-view'), setup = get('editor-setup');
  const status = get('editor-status'), heading = get('editor-heading'), calendarSelect = get('editor-calendar');
  const cards = new WeakMap();
  let connection = {connected:false}, cache = null, current = null, editing = null, pendingDate = null, opener = null, openerDay = null, generation = 0, message = '';
  let queuedMonth = null, reloading = false;
  function busy(value) {
    panel.setAttribute('aria-busy', String(value));
    for (const element of panel.querySelectorAll('button:not(#editor-close), input, select')) element.disabled = value;
    get('editor-start-time').disabled = value || get('editor-all-day').checked;
    get('editor-end-time').disabled = value || get('editor-all-day').checked;
  }
  function connectionUI() {
    get('editor-connection-status').textContent = connection.connected ? '연결됨 · 본인 소유 달력' : '구글 계정 연결이 필요합니다.';
    calendarSelect.replaceChildren();
    for (const calendar of connection.calendars || []) {
      const option = root.createElement('option'); option.value = calendar.id; option.textContent = calendar.summary; calendarSelect.append(option);
    }
    calendarSelect.value = connection.calendarId || '';
    get('editor-calendar-field').hidden = !connection.connected;
    get('editor-disconnect').hidden = !connection.connected;
    get('editor-connect').textContent = connection.connected ? '다른 계정 연결' : '연결 설정 파일 선택';
  }
  function open(title) {
    if (panel.hidden) {opener = root.activeElement;openerDay=opener?.closest?.('.day');}
    get('theme-settings-panel').hidden = true;
    panel.hidden = false; heading.textContent = title; status.textContent = ''; message = '';
    root.querySelector('.calendar-header').inert = true;
    root.querySelector('.calendar-content').inert = true;
    form.hidden = view.hidden = setup.hidden = true; get('editor-confirm').hidden = true;
  }
  function close() {
    panel.hidden = true; root.querySelector('.calendar-header').inert = false; root.querySelector('.calendar-content').inert = false;
    (opener?.isConnected?opener:openerDay?.isConnected?openerDay:get('add-event')).focus({preventScroll:true});
  }
  function openCreate(day = dayFormat.format(new Date())) {
    editing = null; pendingDate = day; open('일정 추가');
    if (!connection.connected) { setup.hidden = false; get('editor-connect').focus(); return; }
    form.hidden = false;
    get('editor-title').required = true;
    get('editor-title').value = '';
    get('editor-start-date').value = get('editor-end-date').value = day;
    get('editor-start-time').value = '09:00'; get('editor-end-time').value = '10:00';
    get('editor-save').textContent = '구글 캘린더에 저장';get('editor-form-note').textContent = '';
    get('editor-all-day').checked = false; busy(false); get('editor-title').focus();
  }
  function openEvent(event, day) {
    editing = null; current = event; open('일정 상세'); view.hidden = false;
    get('editor-event-title').textContent = event.title;
    get('editor-event-time').textContent = formatEventTime(event,day);
    const editable = connection.connected && event.source === 'personal' && event.editable;
    get('editor-delete').hidden = !editable;
    get('editor-edit').hidden = !editable;
    get('editor-readonly').textContent = event.source === 'holidays' ? '공휴일은 읽기 전용입니다.' :
      !editable ? '구글 계정을 연결하면 본인 소유의 개인 일정을 수정·삭제할 수 있습니다. 참석자가 있는 일정은 구글 캘린더에서 관리해 주세요.' :
      event.recurring ? '반복 일정입니다. 수정·삭제하면 선택한 회차에만 적용됩니다.' : '';
  }
  function openEdit() {
    if (!connection.connected || !current?.editable || current.source !== 'personal') {status.textContent=errors.readonly;return;}
    if (current.calendarId !== connection.calendarId) {status.textContent=errors.stale;return;}
    editing = current; open('일정 수정'); form.hidden = false;
    const values = eventFormValues(editing);
    get('editor-title').required = false;
    for (const [key,id] of Object.entries({title:'title',startDate:'start-date',endDate:'end-date',startTime:'start-time',endTime:'end-time'})) get('editor-'+id).value=values[key];
    get('editor-all-day').checked=values.allDay;
    get('editor-save').textContent='변경 사항 저장';
    get('editor-form-note').textContent=editing.recurring?'선택한 회차만 수정합니다. 다른 반복 일정에는 적용되지 않습니다.':'';
    busy(false);get('editor-title').focus();
  }
  async function reload(year, monthIndex) {
    if (!connection.connected) return;
    queuedMonth = {year,monthIndex};
    if (bridge.busy || reloading) return;
    reloading = true;
    try {
      while (queuedMonth && connection.connected) {
        const target=queuedMonth;queuedMonth=null;
        const sequence=++generation, calendarId=connection.calendarId;
        const cells=buildMonthMatrix(target.year,target.monthIndex);
        const start=cells[0].year+'-'+String(cells[0].monthIndex+1).padStart(2,'0')+'-'+String(cells[0].day).padStart(2,'0');
        try {
          const result=await bridge.call('list',{start,end:nextDay(start,42),calendarId});
          if(sequence!==generation||calendarId!==connection.calendarId)continue;
          const range={start,end:nextDay(start,42),calendarId};
          cache={...target,range,map:googleEventsByDay(result.items,range)};message='';
        } catch(error){message=error.message;}
        onChange();
      }
    } finally {reloading=false;}
  }
  async function run(work) {
    if (bridge.busy) { status.textContent = errors.busy; return; }
    busy(true); status.textContent = '처리 중…';
    try { await work(); } catch (error) { status.textContent = error.message; }
    finally { busy(false); }
  }
  get('add-event').addEventListener('click',()=>openCreate());
  get('editor-close').addEventListener('click',close);
  get('editor-edit').addEventListener('click',openEdit);
  get('editor-account').addEventListener('click',()=>{open('구글 캘린더 연결');setup.hidden=false;get('editor-connect').focus();});
  get('editor-connect').addEventListener('click',()=>get('editor-client-file').click());
  get('editor-client-file').addEventListener('change',event=>run(async()=>{
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 12000) throw new Error(errors.invalid);
    const client = JSON.parse(await file.text()).installed;
    if (!client?.client_id?.endsWith('.apps.googleusercontent.com')) throw new Error(errors.invalid);
    status.textContent = '열린 브라우저에서 구글 계정 연결을 완료해 주세요.';
    connection = await bridge.call('connect',{client}); cache = null; connectionUI();
    const month = getMonth(); await reload(month.year,month.monthIndex);
    openCreate(pendingDate || dayFormat.format(new Date()));
  }));
  calendarSelect.addEventListener('change',()=>{
    if(bridge.busy){calendarSelect.value=connection.calendarId;status.textContent=errors.busy;return;}
    run(async()=>{
      const previousId=connection.calendarId;
      try {connection=await bridge.call('select',{calendarId:calendarSelect.value});}
      catch(error){try{connection=await bridge.call('status');}catch{}throw error;}
      finally{
        connectionUI();
        if(previousId!==connection.calendarId){cache=null;onChange();const month=getMonth();await reload(month.year,month.monthIndex);}
      }
      status.textContent='달력을 변경했습니다.';
    });
  });
  get('editor-disconnect').addEventListener('click',()=>run(async()=>{
    await bridge.call('disconnect');++generation;connection={connected:false};cache=null;message='';connectionUI();onChange();status.textContent='이 기기의 계정 연결을 해제했습니다.';
  }));
  get('editor-all-day').addEventListener('change',()=>busy(false));
  form.addEventListener('submit',event=>{
    event.preventDefault();
    run(async()=>{
      const target=editing;
      const values={
        title:get('editor-title').value,startDate:get('editor-start-date').value,endDate:get('editor-end-date').value,
        startTime:get('editor-start-time').value,endTime:get('editor-end-time').value,allDay:get('editor-all-day').checked,
      };
      const data=target?eventUpdateInput(values,target):eventInput(values);
      const saved=await bridge.call(target?'update':'create',{
        event:data,calendarId:target?.calendarId||connection.calendarId,...(target?{eventId:target.id,etag:target.etag}:{}),
      });
      if(cache&&cache.range.calendarId===connection.calendarId){
        if(target){for(const [day,events] of cache.map)cache.map.set(day,events.filter(e=>e.id!==target.id));}
        for(const [day,events] of googleEventsByDay([saved],cache.range))cache.map.set(day,[...(cache.map.get(day)||[]).filter(e=>e.id!==saved.id),...events]);
        onChange();
      }
      const month=getMonth();await reload(month.year,month.monthIndex);close();
    });
  });
  get('editor-delete').addEventListener('click',()=>{get('editor-confirm').hidden=false;get('editor-delete-confirm').focus();});
  get('editor-delete-cancel').addEventListener('click',()=>{get('editor-confirm').hidden=true;get('editor-delete').focus();});
  get('editor-delete-confirm').addEventListener('click',()=>run(async()=>{
    if (!current?.editable || current.source !== 'personal') throw new Error(errors.readonly);
    await bridge.call('delete',{eventId:current.id,etag:current.etag,calendarId:current.calendarId});
    if(cache){for(const [day,events] of cache.map)cache.map.set(day,events.filter(event=>event.id!==current.id));onChange();}
    const month=getMonth();await reload(month.year,month.monthIndex);close();
  }));
  grid.addEventListener('contextmenu',event=>{
    const day=event.target.closest('.day');if(!day)return;event.preventDefault();openCreate(day.dataset.date);
  });
  function activate(event) {
    const card=event.target.closest('.event,.event-detail'), value=card&&cards.get(card);
    if(value) { event.preventDefault();openEvent(value.event,value.day); }
  }
  grid.addEventListener('click',activate);
  grid.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')activate(event);});
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const focusable=[...panel.querySelectorAll('button,input,select,a[href]')].filter(e=>!e.disabled&&e.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&root.activeElement===first){event.preventDefault();last?.focus();}
    if(!event.shiftKey&&root.activeElement===last){event.preventDefault();first?.focus();}
  });
  connectionUI();
  return {
    get connected(){return connection.connected;},
    get message(){return message;},
    personalMap(year,monthIndex){return !connection.connected?null:cache?.year===year&&cache?.monthIndex===monthIndex?cache.map:new Map();},
    bind(element,event,day){cards.set(element,{event,day});element.tabIndex=0;element.setAttribute('role','button');element.setAttribute('aria-label',event.title+' · 상세');},
    reload,
    async initialize(){
      try { connection=await bridge.call('status');connectionUI();if(connection.connected){const m=getMonth();await reload(m.year,m.monthIndex);} }
      catch { get('editor-connection-status').textContent='구글 계정을 연결하면 이곳에서 추가·수정·삭제할 수 있습니다.'; }
    },
  };
}
