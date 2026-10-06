import type { Role, RoleCategory } from './types';
import { ROLE_CATEGORY } from './types';
import type { Vec2, TeamSide, Pitch } from '../state';

export type RoleMetadata={category:RoleCategory;basePosition:Vec2;movementZone:{minX:number;maxX:number;minY:number;maxY:number};decisionPriority:number};

const Y={min:0,max:64};
const BASE:Record<Role,{x:number;y:number}>={
 GK:{x:5,y:32},DR:{x:20,y:10},DL:{x:20,y:54},WBR:{x:42,y:8},WBL:{x:42,y:56},DC:{x:20,y:32},
 DMC:{x:40,y:32},MC:{x:46,y:32},MR:{x:45,y:10},ML:{x:45,y:54},AMC:{x:58,y:32},AML:{x:62,y:12},AMR:{x:62,y:52},
 GF:{x:66,y:32},ST:{x:70,y:32},KFL:{x:68,y:16},KFR:{x:68,y:48},
};

export function roleMetadata(role:Role,side:TeamSide,pitch:Pitch):RoleMetadata{
 const base=BASE[role]; const mirrored=side==='HOME'?{...base}:{x:pitch.length-base.x,y:base.y};
 let minX=0,maxX=pitch.length;
 const category=ROLE_CATEGORY[role];
 if(role==='GK'){minX=side==='HOME'?0:pitch.length-6;maxX=side==='HOME'?6:pitch.length;}
 else if(category==='DEF'){minX=side==='HOME'?0:52;maxX=side==='HOME'?52:pitch.length;}
 else if(category==='MID'){minX=side==='HOME'?18:38;maxX=side==='HOME'?70:pitch.length-18;}
 else {minX=side==='HOME'?38:0;maxX=side==='HOME'?pitch.length:66;}
 const decisionPriority=role==='GK'?100:category==='DEF'?60:category==='MID'?40:20;
 return {category,basePosition:mirrored,movementZone:{minX,maxX,minY:Y.min,maxY:Y.max},decisionPriority};
}
