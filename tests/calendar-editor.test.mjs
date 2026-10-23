import test from 'node:test';
import assert from 'node:assert/strict';
import { googleEventsByDay, eventInput, eventFormValues, eventUpdateInput, createCalendarBridge } from '../@Resources/calendar-editor.mjs';

test('Google events preserve instance IDs, exclusive ends and read-only guests', () => {
  const events = googleEventsByDay([
    { id:'one_20261016', etag:'"a"', summary:'반복 일정', recurringEventId:'one', start:{dateTime:'2026-10-16T23:00:00+09:00'}, end:{dateTime:'2026-10-17T00:00:00+09:00'} },
    { id:'two', summary:'휴가', start:{date:'2026-10-16'}, end:{date:'2026-10-18'}, attendees:[{email:'guest@example.test'}] },
    { id:'gone', status:'cancelled', start:{date:'2026-10-16'}, end:{date:'2026-10-17'} },
  ]);
  assert.equal(events.get('2026-10-16').length,2);
  assert.equal(events.get('2026-10-17').length,1);
  assert.equal(events.has('2026-10-18'),false);
  const one=events.get('2026-10-16').find(e=>e.id.startsWith('one'));
  assert.equal(one.id,'one_20261016');
  assert.equal(one.recurring,true);
  assert.equal(one.editable,true);
  assert.equal(events.get('2026-10-17')[0].editable,false);
});

test('event input validates dates and emits explicit Seoul offsets', () => {
  const base={title:' 점검 ',startDate:'2026-10-16',endDate:'2026-10-16',startTime:'09:00',endTime:'10:30',allDay:false};
  assert.deepEqual(eventInput(base),{summary:'점검',start:{dateTime:'2026-10-16T09:00:00+09:00',timeZone:'Asia/Seoul'},end:{dateTime:'2026-10-16T10:30:00+09:00',timeZone:'Asia/Seoul'}});
  assert.deepEqual(eventInput({...base,allDay:true,endDate:'2026-10-17'}),{summary:'점검',start:{date:'2026-10-16'},end:{date:'2026-10-18'}});
  assert.throws(()=>eventInput({...base,endTime:'08:00'}));
  assert.throws(()=>eventInput({...base,startDate:'2026-02-30'}));
  assert.throws(()=>eventInput({...base,title:' '}));
});

test('edit values round-trip complete events and inclusive all-day endings in Seoul', () => {
  const input={title:'야간 일정',startDate:'2026-10-23',endDate:'2026-10-24',startTime:'23:30:15',endTime:'00:15:45',allDay:false};
  const timed={title:input.title,allDay:false,startMs:Date.parse('2026-10-23T23:30:15+09:00'),endMs:Date.parse('2026-10-24T00:15:45+09:00')};
  assert.deepEqual(eventFormValues(timed),input);
  assert.equal(eventInput(input).start.dateTime,'2026-10-23T23:30:15+09:00');
  const allDay={title:'휴가',allDay:true,startMs:Date.parse('2026-10-23T00:00:00+09:00'),endMs:Date.parse('2026-10-26T00:00:00+09:00')};
  const values=eventFormValues(allDay);
  assert.equal(values.startDate,'2026-10-23');assert.equal(values.endDate,'2026-10-25');
  assert.equal(eventInput(values).end.date,'2026-10-26');
  assert.throws(()=>eventInput({...input,startTime:'23:30:99'}));
});

test('date-only edits preserve absent and blank titles, while intentional title changes are explicit', () => {
  for(const summary of [undefined,'',' 원래 제목 ','긴'.repeat(201)]){
    const original=googleEventsByDay([{id:'example',etag:'"v1"',summary,start:{date:'2026-10-23'},end:{date:'2026-10-24'}}]).get('2026-10-23')[0];
    const values=eventFormValues(original);
    assert.equal(values.title,summary??'');
    assert.equal(Object.hasOwn(eventUpdateInput({...values,startDate:'2026-10-24',endDate:'2026-10-24'},original),'summary'),false);
    assert.equal(eventUpdateInput({...values,title:'직접 수정'},original).summary,'직접 수정');
  }
  const named={title:'기존 제목',summary:'기존 제목'};
  assert.equal(eventUpdateInput({title:'',allDay:true,startDate:'2026-10-23',endDate:'2026-10-23'},named).summary,'');
  assert.throws(()=>eventUpdateInput({title:'새'.repeat(201),allDay:true,startDate:'2026-10-23',endDate:'2026-10-23'},named));
});

test('native bridge encodes untrusted text and accepts only the matching response', async () => {
  let request, calls=0;
  const bangs=[];
  const bridge=createCalendarBridge({
    host:{RainmeterAPI:{ReplaceVariables:async value=>{assert.equal(value,'#@#CalendarBridge.ini');return 'C:\\Calendar Test\\@Resources\\CalendarBridge.ini';},Bang:async command=>{bangs.push(command);request=JSON.parse(Buffer.from(command.match(/Request ([A-Za-z0-9+/=]+)/)[1],'base64').toString());}}},
    fetcher:async()=>({ok:true,json:async()=>++calls===1?{requestId:'stale',ok:true,data:'old'}:{requestId:request.requestId,ok:true,data:'saved'}}),
    delay:async()=>{},
  });
  assert.equal(await bridge.call('create',{event:{summary:'한글 [!Quit] "제목"'}}),'saved');
  assert.equal(request.event.summary,'한글 [!Quit] "제목"');
  assert.equal(bangs.length,1);
  assert.equal(bangs[0].includes('[!Quit]'),false);
  assert.ok(bangs[0].includes('"C:\\Calendar Test\\@Resources\\CalendarBridge.ini"'));
  assert.equal(bangs[0].includes('#@#'),false);
  assert.equal(bridge.busy,false);
});
