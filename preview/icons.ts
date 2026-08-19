
import { drawControlIcon, type ControlIcon } from "../src/ui/icons.ts";
import { buttonBox } from "../src/ui/chrome.ts";
interface R{x:number;y:number;w:number;h:number;c:string}
const out:R[]=[];let cur="#000";
const ctx={set fillStyle(v:string){cur=v;},get fillStyle(){return cur;},
 fillRect(x:number,y:number,w:number,h:number){out.push({x,y,w,h,c:cur});}} as unknown as CanvasRenderingContext2D;
const S=1.25, bw=21, bh=20;
const names:ControlIcon[]=["build","skills","equip","bag","quest"];
names.forEach((n,i)=>{
  const x=6+i*(bw+5);
  buttonBox(ctx,x,6,bw,bh,S,{on:i===3,face:i===3?"rgba(202,162,58,.92)":undefined});
  const gs=16;
  drawControlIcon(ctx,n,x+(bw-gs)/2,6+(bh-gs)/2,gs,i===3);
});
console.log(JSON.stringify(out));
