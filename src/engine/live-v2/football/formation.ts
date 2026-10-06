import type { Pitch, TeamSide, Vec2 } from '../state';
import type { FormationName, FormationSlot, Role, Tactics } from './types';

const HOME:Record<FormationName,FormationSlot[]> = {
 '4-4-2':[
  {role:'GK',position:{x:5,y:32}},{role:'DR',position:{x:20,y:10}},{role:'DC',position:{x:20,y:25}},{role:'DC',position:{x:20,y:39}},{role:'DL',position:{x:20,y:54}},
  {role:'MR',position:{x:45,y:10}},{role:'MC',position:{x:45,y:25}},{role:'MC',position:{x:45,y:39}},{role:'ML',position:{x:45,y:54}},
  {role:'ST',position:{x:70,y:25}},{role:'ST',position:{x:70,y:39}}],
 '4-3-3':[
  {role:'GK',position:{x:5,y:32}},{role:'DR',position:{x:20,y:10}},{role:'DC',position:{x:20,y:25}},{role:'DC',position:{x:20,y:39}},{role:'DL',position:{x:20,y:54}},
  {role:'MC',position:{x:43,y:22}},{role:'DMC',position:{x:40,y:32}},{role:'MC',position:{x:43,y:42}},
  {role:'AML',position:{x:67,y:12}},{role:'ST',position:{x:70,y:32}},{role:'AMR',position:{x:67,y:52}}],
 '3-5-2':[
  {role:'GK',position:{x:5,y:32}},{role:'DC',position:{x:20,y:20}},{role:'DC',position:{x:20,y:32}},{role:'DC',position:{x:20,y:44}},
  {role:'WBR',position:{x:42,y:7}},{role:'MC',position:{x:42,y:22}},{role:'DMC',position:{x:40,y:32}},{role:'MC',position:{x:42,y:42}},{role:'WBL',position:{x:42,y:57}},
  {role:'ST',position:{x:68,y:25}},{role:'ST',position:{x:68,y:39}}],
 '4-2-3-1':[
  {role:'GK',position:{x:5,y:32}},{role:'DR',position:{x:20,y:10}},{role:'DC',position:{x:20,y:25}},{role:'DC',position:{x:20,y:39}},{role:'DL',position:{x:20,y:54}},
  {role:'DMC',position:{x:39,y:25}},{role:'DMC',position:{x:39,y:39}},
  {role:'AML',position:{x:61,y:12}},{role:'AMC',position:{x:58,y:32}},{role:'AMR',position:{x:61,y:52}},{role:'ST',position:{x:72,y:32}}],
};
export function formationSlots(name:FormationName,side:TeamSide,pitch:Pitch,tactics:Tactics):FormationSlot[] {
 const mentality=tactics.mentality==='attacking'?4:tactics.mentality==='defensive'?-4:0;
 const line=tactics.defensiveLine==='high'?10:tactics.defensiveLine==='deep'?-8:0;
 const width=tactics.width==='wide'?10:tactics.width==='narrow'?-6:0;
 return HOME[name].map((slot)=>{ let x=slot.position.x,y=slot.position.y;
  if(slot.role!=='GK'&&['DR','DL','DC','WBR','WBL'].includes(slot.role)) x+=line;
  if(['ST','KFL','KFR','GF','AML','AMR','AMC'].includes(slot.role)) x+=mentality;
  if(['MR','ML','WBR','WBL','AML','AMR'].includes(slot.role)) y+=width*(y<pitch.width/2?-1:1);
  if(side==='AWAY') x=pitch.length-x;
  return {role:slot.role,position:{x:Math.max(0,Math.min(pitch.length,x)),y:Math.max(0,Math.min(pitch.width,y))}};
 });
}
export function roleCategory(role:Role):'GK'|'DEF'|'MID'|'ATT' {
 if(role==='GK')return'GK'; if(['DR','DL','WBR','WBL','DC'].includes(role))return'DEF';
 if(['DMC','MC','MR','ML'].includes(role))return'MID'; return'ATT';
}
export function roleBasePosition(role:Role,side:TeamSide,pitch:Pitch):Vec2 {
 const slot=HOME['4-4-2'].find(s=>s.role===role)??HOME['4-4-2'][9];
 return side==='HOME'?{...slot.position}:{x:pitch.length-slot.position.x,y:slot.position.y};
}
