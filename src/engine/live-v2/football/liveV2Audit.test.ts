import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function files(root:string):string[]{
 return readdirSync(root,{withFileTypes:true}).flatMap(e=>{
  const p=join(root,e.name); return e.isDirectory()?files(p):p.endsWith('.ts')?[p]:[];
 });
}
describe('live-v2 audit',()=>{
 it('contains no Math.random or legacy live imports',()=>{
  const root=join(process.cwd(),'src','engine','live-v2');
  const source=files(root).filter(p=>!p.endsWith('.test.ts')).map(p=>readFileSync(p,'utf8')).join('\n');
  expect(source).not.toContain('Math.random(');
  expect(source).not.toMatch(/from ['"].*engine\/live\//);
 });
});
