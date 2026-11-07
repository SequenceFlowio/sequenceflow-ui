type Point = { x: number; y: number; z: number };
const CENTER = 63;
function cubic(points: [number, number][], t: number) {
 const s=1-t;
 return { x:s*s*s*points[0][0]+3*s*s*t*points[1][0]+3*s*t*t*points[2][0]+t*t*t*points[3][0],y:s*s*s*points[0][1]+3*s*s*t*points[1][1]+3*s*t*t*points[2][1]+t*t*t*points[3][1] };
}
function project(point: Point, angle: number) {
 const x=point.x-CENTER;
 return { x:CENTER+x*Math.cos(angle)+point.z*Math.sin(angle),y:point.y,z:point.z*Math.cos(angle)-x*Math.sin(angle) };
}
function splitPath(points: Point[], angle: number) {
 let front="",back="";
 for(let index=1;index<points.length;index++) {
  const a=project(points[index-1],angle),b=project(points[index],angle);
  const path=`M${a.x.toFixed(3)} ${a.y.toFixed(3)}L${b.x.toFixed(3)} ${b.y.toFixed(3)}`;
  if((a.z+b.z)/2>=-0.00001) front+=path;else back+=path;
 }
 return { front,back };
}
/** Orthographic yaw of a headset around a solid head; never scales the head itself. */
export function headsetProjection(angle: number) {
 const band:Point[]=[],boom:Point[]=[];
 for(let i=0;i<=48;i++) {
  const t=i/48;
  const point=t<=.5 ? cubic([[12,63],[10,27],[33,6],[60,6]],t*2) : cubic([[60,6],[87,6],[110,27],[108,63]],(t-.5)*2);
  band.push({ ...point,z:0 });
  boom.push({ ...cubic([[12,78],[12,96],[23,106],[36,103]],t),z:24*t });
 }
 const cups=[11,109].map(x=>{
  const p=project({ x,y:65,z:0 },angle);
  return { ...p,scaleX:Math.abs(Math.cos(angle))+Math.abs(Math.sin(angle))*.6,front:p.z>=-0.00001 };
 });
 const mic=project({ x:38,y:102.5,z:24 },angle);
 return { band:splitPath(band,angle),boom:splitPath(boom,angle),cups,mic:{ ...mic,scaleX:Math.max(.3,Math.abs(Math.cos(angle))),front:mic.z>=0 } };
}
