import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const W=1600,H=900,DURATION=44;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const ramp=(t,a,b)=>smooth((t-a)/(b-a));
const mix=THREE.MathUtils.lerp;
const TIMELINE=[[0,0],[3.5,5],[9,12],[13,17],[15,20],[20.5,27],[26,33],[33,41],[41,49],[44,52]];
function storyTime(seconds){
 let i=1;while(i<TIMELINE.length-1&&seconds>TIMELINE[i][0])i++;
 const [a,b]=TIMELINE[i-1],[c,d]=TIMELINE[i];return mix(b,d,clamp((seconds-a)/(c-a)));
}
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
let seed=771;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const film=document.querySelector('#film');
function resize(){film.style.transform=`scale(${Math.min(innerWidth/W,innerHeight/H)})`;}
addEventListener('resize',resize);resize();
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.setClearColor(0,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
document.querySelector('#viewport').appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(34,W/H,.05,70);camera.position.set(0,.25,6.7);camera.lookAt(0,.05,0);
scene.add(new THREE.HemisphereLight(0xbfe5f3,0x162837,2.15));
const light=new THREE.DirectionalLight(0xe1f4ff,3.1);light.position.set(2,4,5);scene.add(light);
const rim=new THREE.DirectionalLight(0x5fb5d5,2.2);rim.position.set(-3,1,-4);scene.add(rim);
const warm=new THREE.PointLight(0xffb169,.45,4);warm.position.set(1.3,.65,.7);scene.add(warm);
const patient=new THREE.Group();scene.add(patient);patient.position.set(.78,-.1,0);
const loader=new GLTFLoader();
const [headFile,brainFile,evidence]=await Promise.all([loader.loadAsync('assets/head.glb'),loader.loadAsync('assets/brain.glb'),fetch('../docs/assets/evidence.json').then(r=>r.json())]);
const specimenCase=evidence.cases.find(c=>c.id===2);
document.querySelector('#margin').textContent='+'+specimenCase.mean_margin.toFixed(3);
document.querySelector('#fold-text').textContent=`${specimenCase.aligned_folds} / 5 fold models aligned`;
const points=specimenCase.fold_margins.map((n,i)=>`${17+i*46},${28-n*21}`).join(' ');
document.querySelector('#folds').innerHTML=`<path d="M7 28H215" stroke="#4a6574" stroke-dasharray="3 4"/><polyline points="${points}" stroke="#e7b87d" stroke-width="1.5" fill="none"/>`+specimenCase.fold_margins.map((n,i)=>`<circle cx="${17+i*46}" cy="${28-n*21}" r="3" fill="#e7b87d"/><text x="${17+i*46}" y="51" text-anchor="middle" font-size="9" fill="#7596a9">${i+1}</text>`).join('');
const head=headFile.scene;
const box=new THREE.Box3().setFromObject(head),size=box.getSize(v(0,0,0)),center=box.getCenter(v(0,0,0));
const s=3.05/size.y;head.scale.multiplyScalar(s);head.position.sub(center.multiplyScalar(s));patient.add(head);
const headMaterials=[];
head.traverse(mesh=>{if(!mesh.isMesh)return;mesh.material=new THREE.MeshStandardMaterial({color:0xa8c5d3,roughness:.85,metalness:0,transparent:true,opacity:.19,depthWrite:false,side:THREE.FrontSide});mesh.renderOrder=5;headMaterials.push(mesh.material);});
const outline=head.clone(true);
const fresnel=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide,uniforms:{strength:{value:.55}},vertexShader:`varying vec3 n;varying vec3 view;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);view=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 n;varying vec3 view;uniform float strength;void main(){float f=pow(1.-abs(dot(normalize(n),normalize(view))),4.5);gl_FragColor=vec4(.29,.66,.83,f*strength);}`});
outline.traverse(m=>{if(m.isMesh){m.material=fresnel;m.renderOrder=6;}});patient.add(outline);
const brain=brainFile.scene;brain.scale.set(.90,.75,.58);brain.position.set(0,.96,-.10);patient.add(brain);
const brainMaterials=[];
brain.traverse(m=>{if(m.isMesh){m.geometry.computeVertexNormals();m.material=new THREE.MeshStandardMaterial({color:0x537a8b,emissive:0x203540,emissiveIntensity:.28,roughness:.85,metalness:0,transparent:true,opacity:.90,depthWrite:true,side:THREE.FrontSide});m.renderOrder=3;brainMaterials.push(m.material);}});
const target=v(.34,1.00,.16);
const lesionGroup=new THREE.Group();lesionGroup.position.copy(target);patient.add(lesionGroup);
const lesionGeo=new THREE.SphereGeometry(.245,64,48);
const pos=lesionGeo.attributes.position;
for(let i=0;i<pos.count;i++){const p=v(pos.getX(i),pos.getY(i),pos.getZ(i));const noise=.96+.075*Math.sin(p.x*20+p.y*17)*Math.cos(p.z*21)+.045*Math.sin(p.z*27-p.x*16);p.multiplyScalar(noise);p.y*=.84;p.z*=.9;pos.setXYZ(i,p.x,p.y,p.z);}
lesionGeo.computeVertexNormals();
const lesionMat=new THREE.MeshStandardMaterial({color:0xe9a258,emissive:0x924412,emissiveIntensity:.30,roughness:.63,metalness:.02,transparent:true,opacity:.82,depthWrite:false,depthTest:false});
const lesion=new THREE.Mesh(lesionGeo,lesionMat);lesion.renderOrder=9;lesionGroup.add(lesion);
const halo=new THREE.Mesh(new THREE.IcosahedronGeometry(.264,4),new THREE.MeshBasicMaterial({color:0xf4af63,transparent:true,opacity:.06,wireframe:true,depthWrite:false}));halo.scale.set(1,.86,.95);halo.renderOrder=10;lesionGroup.add(halo);
const pin=new THREE.Mesh(new THREE.SphereGeometry(.037,20,14),new THREE.MeshBasicMaterial({color:0xffe0a0,depthTest:false}));pin.position.copy(target);pin.renderOrder=20;patient.add(pin);
const ring=new THREE.Mesh(new THREE.TorusGeometry(.082,.004,8,64),new THREE.MeshBasicMaterial({color:0xffcf79,depthTest:false,transparent:true,opacity:.8,depthWrite:false}));ring.position.copy(target);ring.position.z+=.045;ring.renderOrder=21;patient.add(ring);
function cylinderBetween(a,b,radius,material){const len=a.distanceTo(b);const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,len,12),material);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(v(0,1,0),b.clone().sub(a).normalize());return m;}
const direction=v(.83,.18,.45).normalize();
const needleMat=new THREE.MeshStandardMaterial({color:0xc6dbe3,metalness:.85,roughness:.16,transparent:true,opacity:1});
const handleMat=new THREE.MeshStandardMaterial({color:0x498aae,metalness:.3,roughness:.3,transparent:true,opacity:1});
const needle=new THREE.Group();patient.add(needle);
needle.add(cylinderBetween(v(0,0,0),direction.clone().multiplyScalar(.95),.015,needleMat));
needle.add(cylinderBetween(direction.clone().multiplyScalar(.92),direction.clone().multiplyScalar(1.20),.055,handleMat));
const tipGeo=new THREE.ConeGeometry(.018,.10,16);const tip=new THREE.Mesh(tipGeo,needleMat);tip.quaternion.setFromUnitVectors(v(0,1,0),direction.clone().negate());needle.add(tip);
const tissueMat=new THREE.MeshStandardMaterial({color:0xf2aa6d,emissive:0xcc621f,emissiveIntensity:.8,roughness:.4,transparent:true});
const tissue=new THREE.Mesh(new THREE.CapsuleGeometry(.031,.16,8,12),tissueMat);tissue.quaternion.setFromUnitVectors(v(0,1,0),direction);scene.add(tissue);
const slideGroup=new THREE.Group();slideGroup.position.set(-1.27,-.63,.45);slideGroup.rotation.set(.45,.2,-.16);scene.add(slideGroup);
const slideMat=new THREE.MeshPhysicalMaterial({color:0xb7dfed,transparent:true,opacity:.32,roughness:.08,metalness:.14,depthWrite:false});
const slide=new THREE.Mesh(new THREE.BoxGeometry(.88,.024,.41),slideMat);slideGroup.add(slide);
const slideEdge=new THREE.LineSegments(new THREE.EdgesGeometry(slide.geometry),new THREE.LineBasicMaterial({color:0x78c4d9,transparent:true,opacity:.8}));slideGroup.add(slideEdge);
const smear=new THREE.Mesh(new THREE.SphereGeometry(.11,24,16),new THREE.MeshStandardMaterial({color:0xdf946c,emissive:0x602400,roughness:.8,transparent:true}));smear.scale.set(1,.06,.65);smear.position.y=.022;slideGroup.add(smear);
const modelPatient=new THREE.Group();scene.add(modelPatient);
const modelAnatomyMaterials=[];
for(const source of [head,brain]){
 const copy=source.clone(true);
 copy.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.depthWrite=false;modelAnatomyMaterials.push({material:m.material,isBrain:source===brain});}});
 modelPatient.add(copy);
}
const modelRegion=new THREE.Group();modelRegion.position.copy(target);modelPatient.add(modelRegion);
const modelLesionMat=lesionMat.clone();modelLesionMat.color.setHex(0x80bdcc);
const modelLesion=new THREE.Mesh(lesionGeo,modelLesionMat);modelRegion.add(modelLesion);
const modelRing=ring.clone();modelRing.material=ring.material.clone();modelRing.position.copy(target);modelRing.position.z+=.08;modelPatient.add(modelRing);
const fixedCore=new THREE.Mesh(tissue.geometry,tissueMat.clone());fixedCore.rotation.z=Math.PI/2;fixedCore.position.set(0,.05,0);fixedCore.scale.setScalar(.85);slideGroup.add(fixedCore);
const localGroup=new THREE.Group();modelRegion.add(localGroup);
const patchCenters=[];const patches=[];const patchMaterial=[];
for(let z=-2;z<=2;z++)for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){
 const p=v(x*.105,y*.098,z*.10);if(p.length()>.225)continue;patchCenters.push(p);
 const color=new THREE.Color().setHSL(.51+.04*random(),.46,.50+.15*random());
 const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.07,depthWrite:false});
 const cube=new THREE.Mesh(new THREE.BoxGeometry(.075,.070,.071),mat);cube.position.copy(p);cube.renderOrder=11;localGroup.add(cube);
 const edge=new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry),new THREE.LineBasicMaterial({color:0x99e5e8,transparent:true,opacity:.65,depthWrite:false}));cube.add(edge);
 patches.push(cube);patchMaterial.push(mat);
}
const graph=new THREE.Group();modelRegion.add(graph);
const graphNodes=[];const nodeMat=new THREE.MeshStandardMaterial({color:0xade9ee,emissive:0x439da9,emissiveIntensity:.45,roughness:.2,metalness:.2,transparent:true,depthWrite:false});
const pick=patchCenters.filter((_,i)=>i%3===0);
for(const p of pick){const node=new THREE.Mesh(new THREE.SphereGeometry(.024,12,8),nodeMat);node.position.copy(p).multiplyScalar(1.55);graph.add(node);graphNodes.push(node);}
const edgePositions=[];const edges=[];
for(let i=0;i<pick.length;i++)for(let j=i+1;j<pick.length;j++){if(pick[i].distanceTo(pick[j])<.20){const a=pick[i].clone().multiplyScalar(1.55),b=pick[j].clone().multiplyScalar(1.55);edgePositions.push(...a,...b);edges.push([a,b]);}}
const edgeGeo=new THREE.BufferGeometry();edgeGeo.setAttribute('position',new THREE.Float32BufferAttribute(edgePositions,3));
const graphLineMat=new THREE.LineBasicMaterial({color:0x6bced3,transparent:true,opacity:.40,depthWrite:false});graph.add(new THREE.LineSegments(edgeGeo,graphLineMat));
const particles=[];
for(let i=0;i<12;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.012,8,6),new THREE.MeshBasicMaterial({color:0xffd296,transparent:true,depthWrite:false}));graph.add(p);particles.push(p);}
const prediction=new THREE.Group();prediction.position.set(-.11,-.35,.35);scene.add(prediction);
const outputMat=new THREE.MeshStandardMaterial({color:0xafd9e5,emissive:0x286f8b,emissiveIntensity:.6,roughness:.2,metalness:.4,transparent:true,opacity:.8});
prediction.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.12,3),outputMat));
const predictionRings=[];for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.TorusGeometry(.19+i*.025,.003,8,64),new THREE.MeshBasicMaterial({color:0x75bacd,transparent:true,opacity:.7}));m.rotation.set(i*.68,.5+i*.48,.3);prediction.add(m);predictionRings.push(m);}
const streamGroup=new THREE.Group();scene.add(streamGroup);const streams=[];
for(let i=0;i<7;i++){const positions=new Float32Array(33*3);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const mat=new THREE.LineBasicMaterial({color:i%2?0x80c6d4:0xeeb97f,transparent:true,opacity:.42});const line=new THREE.Line(geometry,mat);streamGroup.add(line);const dot=new THREE.Mesh(new THREE.SphereGeometry(.021,10,8),new THREE.MeshBasicMaterial({color:0xd8f3f3,transparent:true}));streamGroup.add(dot);streams.push({line,dot});}
const scanGroup=new THREE.Group();modelPatient.add(scanGroup);
const scanTextureCanvas=document.createElement('canvas');scanTextureCanvas.width=128;scanTextureCanvas.height=128;
const ctx=scanTextureCanvas.getContext('2d');ctx.strokeStyle='rgba(128,213,235,.35)';ctx.lineWidth=1;
for(let i=0;i<=128;i+=16){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,128);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(128,i);ctx.stroke();}
const scanMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(scanTextureCanvas),transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false,color:0x8fd6e5});
const scanPlane=new THREE.Mesh(new THREE.PlaneGeometry(2.1,2.1),scanMat);scanPlane.rotation.x=-Math.PI/2;scanGroup.add(scanPlane);
const scanEdge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.1,2.1)),new THREE.LineBasicMaterial({color:0x77d1e6,transparent:true,opacity:.65}));scanEdge.rotation.x=-Math.PI/2;scanGroup.add(scanEdge);
const ground=new THREE.GridHelper(8,24,0x456272,0x294553);ground.position.y=-1.68;ground.material.transparent=true;ground.material.opacity=.13;scene.add(ground);
const dustGeo=new THREE.BufferGeometry();const dust=[];for(let i=0;i<70;i++)dust.push((random()-.5)*9,(random()-.5)*5,(random()-.5)*6-1);
dustGeo.setAttribute('position',new THREE.Float32BufferAttribute(dust,3));const dustMesh=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0x7296ad,size:.011,transparent:true,opacity:.23,depthWrite:false}));scene.add(dustMesh);
const chapterNodes=['#chapter','#title','#description'].map(x=>document.querySelector(x));
const chapters=[
 {start:0,step:0,kicker:'CLINICAL WORKFLOW / LOCAL ORIGIN',title:'A whole tumor.<br>A <em>local sample.</em>',description:'Clinical labels originate in tissue taken from a specific region.'},
 {start:5,step:0,kicker:'CLINICAL WORKFLOW / TISSUE SAMPLING',title:'The needle reaches<br>a particular region.',description:'Sampling anchors the diagnosis to a physical location inside the tumor.'},
 {start:12,step:0,kicker:'CLINICAL WORKFLOW / THE DIAGNOSTIC LABEL',title:'A small specimen.<br>Diagnostic information.',description:'The sampled tissue provides molecular and pathological labels.'},
 {start:17,step:1,kicker:'TWO WORKFLOWS / ONE LOCAL ORIGIN',title:'A local origin for <em>clinical labels.</em>',description:'The sampled region, tissue specimen, and resulting labels become our reference.'},
 {start:20,step:2,kicker:'OUR MODEL / REGIONAL EVIDENCE',title:'Learn the tumor <em>region by region.</em>',description:'MRI regions yield explicit categorical evidence, alongside the clinical sampling workflow.'},
 {start:27,step:2,kicker:'OUR MODEL / LOCAL TO GLOBAL',title:'Local evidence. <em>Patient-level prediction.</em>',description:'Regional context and tumor geometry guide aggregation while preserving local readouts.'},
 {start:33,step:3,kicker:'CLINICAL ALIGNMENT / LOCATION AND LABEL',title:'Match the <em>location.</em> Compare the <span class="cyan">phenotype.</span>',description:'Two correspondences connect the clinical workflow with explicit local MRI evidence.'},
 {start:41,step:4,kicker:'RECORDED-SITE VALIDATION / ACTUAL STUDY CASE 02',title:'Same biopsy site. <span class="cyan">Concordant local evidence.</span>',description:'The Grade IV tissue label matches positive local evidence across all five fitted models.'},
];
function opacity(selector,value){document.querySelector(selector).style.opacity=String(clamp(value));}
function project(point){const p=point.clone().project(camera);return {x:(p.x+1)*W/2,y:(1-p.y)*H/2};}
function drawTrack(name,path,progress){
 for(const suffix of ['base','track','glow']){
  const el=document.querySelector(`#${name}-${suffix}`);el.setAttribute('d',path);
  if(suffix!=='base')el.style.strokeDashoffset=String(1000*(1-progress));
 }
 const route=document.querySelector(`#${name}-track`),point=route.getPointAtLength(route.getTotalLength()*progress);
 const tip=document.querySelector(`#${name}-tip`);tip.setAttribute('cx',point.x);tip.setAttribute('cy',point.y);tip.style.opacity=progress>0&&progress<1?'1':'0';
}
let lastChapter=-1;
function renderAt(seconds){
 const elapsed=clamp(seconds,0,DURATION),t=storyTime(elapsed);
 const split=ramp(t,17,19.7),model=ramp(t,20,23),validation=ramp(t,41,42.2),ending=ramp(t,49,50.3);
 const schematic=1-validation,align=ramp(t,33,34);
 let chapter=chapters.length-1;while(chapter>0&&t<chapters[chapter].start)chapter--;
 if(chapter!==lastChapter){
  const c=chapters[chapter];chapterNodes[0].textContent=c.kicker;chapterNodes[1].innerHTML=c.title;chapterNodes[2].textContent=c.description;
  document.querySelectorAll('[data-step]').forEach(n=>n.classList.toggle('active',Number(n.dataset.step)<=c.step));lastChapter=chapter;
  film.classList.toggle('split-view',t>=17);
 }
 const transition=chapter?.6+.4*ramp(t,chapters[chapter].start,chapters[chapter].start+.6):1;
 opacity('.copy',transition*(1-ending));
 const clinicalTime=Math.min(t,17);
 camera.position.set(mix(.1*Math.sin(clinicalTime*.12),0,split),.20,mix(6.65-.16*Math.sin(clinicalTime*.09),6.65,split));camera.lookAt(0,.03,0);camera.updateMatrixWorld();
 patient.position.set(mix(.83,-1.98,split),mix(-.11+Math.sin(clinicalTime*.37)*.015,-.27,split),0);
 patient.scale.setScalar(mix(1,.56,split));patient.rotation.set(0,mix(-.42+.25*Math.sin(clinicalTime*.18),-.22,split),-.022);patient.visible=schematic>.001;
 headMaterials.forEach(m=>m.opacity=(.075+.065*(1-ramp(t,0,4)))*schematic*(1-.35*align));
 fresnel.uniforms.strength.value=.16*schematic;
 brainMaterials.forEach(m=>m.opacity=(.70+.22*ramp(t,.8,3.8))*schematic*(1-.22*align));
 lesionMat.opacity=(.70+.14*Math.sin(clinicalTime*1.1))*schematic;lesionMat.emissiveIntensity=.27+.08*Math.sin(clinicalTime*1.6);
 halo.material.opacity=.06*schematic;pin.scale.setScalar(1);ring.scale.setScalar(1+.08*align*Math.sin(t*2.4));ring.material.opacity=(.65+.3*align)*schematic;ring.quaternion.copy(camera.quaternion);ring.rotateY(-patient.rotation.y);
 const insertion=ramp(t,5.3,9.5)*(1-ramp(t,10.2,13.2));
 needle.visible=t>=5&&t<14.5;needle.position.copy(target).addScaledVector(direction,(1-insertion)*.70);needleMat.opacity=ramp(t,5,5.7)*(1-ramp(t,13.2,14.5));handleMat.opacity=needleMat.opacity;
 patient.updateMatrixWorld(true);
 slideGroup.position.set(mix(-1.27,-.81,split),mix(-.63,.02,split),.45);slideGroup.scale.setScalar(mix(1,.70,split));slideGroup.rotation.set(.45,.2,-.16);
 tissue.visible=t>=9.7&&t<17.3;
 const sample=patient.localToWorld(target.clone().addScaledVector(direction,(1-insertion)*.70));
 if(t<13.2)tissue.position.copy(sample);
 else{const a=patient.localToWorld(target.clone().addScaledVector(direction,.70)),b=v(-1.1,.35,1.4),c=slideGroup.position.clone().add(v(0,.09,0));tissue.position.copy(new THREE.QuadraticBezierCurve3(a,b,c).getPoint(ramp(t,13.2,16.1)));}
 tissue.rotation.z=.2+Math.sin(t)*.15;tissue.scale.setScalar(1+.6*ramp(t,13,15));tissueMat.opacity=1-ramp(t,16.2,17.3);
 const slideFade=ramp(t,12.2,13.5)*schematic;slideGroup.visible=slideFade>.001;slideMat.opacity=.31*slideFade;slideEdge.material.opacity=.7*slideFade;smear.material.opacity=.6*slideFade*ramp(t,15.6,16.2);fixedCore.material.opacity=slideFade*ramp(t,16.2,17.3);
 opacity('#specimen-label',ramp(t,13.8,14.5)*(1-split));
 modelPatient.visible=t>=19.7&&schematic>.001;modelPatient.position.set(1.72,-.37,0);modelPatient.scale.setScalar(.56);modelPatient.rotation.set(0,-.22+.10*Math.sin((Math.min(t,33)-20)*.16),-.022);
 const modelEntrance=ramp(t,19.7,21);
 modelAnatomyMaterials.forEach(({material,isBrain})=>material.opacity=(isBrain?.42-.29*model:.065-.035*model)*modelEntrance*schematic);
 modelRegion.scale.setScalar(1+1.6*model);modelLesionMat.opacity=(.65-.59*model)*modelEntrance*schematic;
 modelRing.material.opacity=(.2+.7*align)*modelEntrance*schematic;modelRing.scale.setScalar(1+.08*align*Math.sin(t*2.4));modelRing.quaternion.copy(camera.quaternion);modelRing.rotateY(-modelPatient.rotation.y);
 localGroup.visible=model>.001;localGroup.scale.setScalar(1+.25*ramp(t,23,27));
 patches.forEach((p,i)=>{p.material.opacity=(.045+.025*Math.sin(t*1.5+i*.62))*model*schematic;p.rotation.y=.09*model*Math.sin(t*.4+i);p.children[0].material.opacity=.4*model*schematic*(1-.42*align);});
 const graphFade=ramp(t,27,29)*schematic*(1-.48*align);graph.visible=graphFade>.001;graphLineMat.opacity=.38*graphFade;nodeMat.opacity=.9*graphFade;
 particles.forEach((p,i)=>{const e=edges[(i*5)%edges.length];p.position.copy(e[0]).lerp(e[1],(t*.5+i*.17)%1);p.material.opacity=graphFade;});
 prediction.position.set(1.03,-.94,.35);const predictionFade=ramp(t,28.5,30)*schematic*(1-.7*align);prediction.visible=predictionFade>.001;outputMat.opacity=.85*predictionFade;predictionRings.forEach((r,i)=>{r.rotation.y=t*.25+i;r.material.opacity=.68*predictionFade;});
 modelPatient.updateMatrixWorld(true);const centerWorld=modelPatient.localToWorld(target.clone());
 streamGroup.visible=prediction.visible;
 streams.forEach((s,i)=>{const a=centerWorld.clone().add(v(0,(i-3)*.025,.12)),b=prediction.position.clone().add(v(.30,.40+(i-3)*.03,.4));const curve=new THREE.QuadraticBezierCurve3(a,b,prediction.position);const p=s.line.geometry.attributes.position;for(let k=0;k<=32;k++){const q=curve.getPoint(k/32);p.setXYZ(k,q.x,q.y,q.z);}p.needsUpdate=true;s.line.geometry.computeBoundingSphere();s.line.material.opacity=.30*predictionFade;s.dot.position.copy(curve.getPoint((t*.26+i*.11)%1));s.dot.material.opacity=predictionFade;});
 scanGroup.visible=t>=20&&t<27;scanPlane.position.y=scanEdge.position.y=-.18+Math.min(Math.max(0,t-20)*.35,1.6);const scanFade=model*(1-ramp(t,26,27));scanMat.opacity=.32*scanFade;scanEdge.material.opacity=.42*scanFade;
 opacity('#comparison',split*(1-.88*ending));opacity('#clinical-summary',ramp(t,18.7,19.7)*schematic);opacity('#model-summary',ramp(t,22,24)*schematic);opacity('#patient-label',predictionFade);opacity('#model-labels',model*schematic);
 const left=project(patient.localToWorld(target.clone())),right=project(centerWorld),slidePoint=project(slideGroup.position.clone());
 const clinicalPath=`M ${left.x} ${left.y} C ${left.x+85} ${left.y-40},${slidePoint.x} ${slidePoint.y-75},${slidePoint.x} ${slidePoint.y-16} C 700 456,710 525,710 574`;
 const modelPath=`M ${right.x} ${right.y} C ${right.x+118} ${right.y-32},1360 500,1360 574`;
 const travel=ramp(t,33.3,35.8);drawTrack('clinical',clinicalPath,travel);drawTrack('model',modelPath,travel);
 opacity('#routes',ramp(t,19,20)*schematic);
 document.querySelector('#model-base').style.opacity=String(model);
 const siteBridge=document.querySelector('#site-bridge');siteBridge.setAttribute('d',`M ${left.x} ${left.y} C ${left.x+120} 331,${right.x-120} 331,${right.x} ${right.y}`);siteBridge.style.strokeDashoffset=String(1000*(1-ramp(t,34.5,36.5)));
 const labelBridge=document.querySelector('#label-bridge');labelBridge.setAttribute('d','M 747 635 C 873 635,1080 635,1210 635');labelBridge.style.strokeDashoffset=String(1000*(1-ramp(t,36.2,38.1)));
 const locationMatch=ramp(t,34.5,36.5),labelMatch=ramp(t,36.2,38.1);
 opacity('#site-correspondence',ramp(t,34.4,35.2)*schematic);opacity('#label-correspondence',ramp(t,36.1,36.9)*schematic);
 for(const [name,point] of [['left',left],['right',right]]){
  const marker=document.querySelector('#site-pair-'+name);marker.setAttribute('transform',`translate(${point.x},${point.y})`);marker.style.opacity=String(align);
  marker.querySelector('.site-pulse').setAttribute('r',String(23+3*Math.sin(t*2.4)));
 }
 const pathDots=(id,progress)=>{
  const route=document.querySelector('#'+id+'-bridge'),length=route.getTotalLength();
  for(const [side,f] of [['left',.5*(1-progress)],['right',.5+.5*progress]]){
   const pos=route.getPointAtLength(length*f),dot=document.querySelector('#'+id+'-dot-'+side);dot.setAttribute('cx',pos.x);dot.setAttribute('cy',pos.y);dot.style.opacity=progress>0&&progress<1?'1':'0';
  }
 };
 pathDots('site',locationMatch);pathDots('label',labelMatch);
 document.querySelectorAll('.label-pair-badge').forEach(n=>n.style.opacity=String(ramp(t,35.8,36.8)));
 document.querySelectorAll('.clinical-outcome,.model-outcome').forEach(n=>n.style.boxShadow=`0 0 ${24*labelMatch}px rgba(105,211,214,${.17*labelMatch})`);
 document.querySelectorAll('.biopsy-focus').forEach(n=>{n.style.opacity=String(ramp(t,42.2,43.3));n.style.transform=`translate(-50%,-50%) scale(${1+.045*Math.sin(t*2.4)})`;});
 for(const id of ['clinical-label','regional-label'])document.querySelector('#'+id).style.borderColor=`rgba(113,213,216,${.22+.68*labelMatch})`;
 opacity('#validation',validation*(1-.94*ending));opacity('#closing',ending);
 document.querySelector('#source-note').textContent=ending>.2?'Concept anatomy: Lee Perry-Smith (CC BY 3.0) · Thomas Habets (CC BY 4.0)':t>=41?'Recorded study case 02 · MRI and five-fold biopsy evidence':'Concept anatomy · clinical workflow and MRI modeling';
 document.querySelector('#progress').style.width=`${100*elapsed/DURATION}%`;
 dustMesh.rotation.y=Math.min(t,20)*.015;ground.material.opacity=.10*(1-.7*ending);
 renderer.render(scene,camera);
 return {time:elapsed,storyTime:t,locationMatch:ramp(t,34.5,36.5),labelMatch:ramp(t,36.2,38.1),chapter:chapter+1,scanY:scanPlane.position.y,clinicalPose:patient.position.toArray(),clinicalRotation:patient.rotation.y,split,alignment:travel,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
}
window.renderAt=renderAt;window.filmDuration=DURATION;window.filmReady=true;
renderAt(0);
if(!new URLSearchParams(location.search).has('render')){const start=performance.now();function tick(){renderAt(((performance.now()-start)/1000)%DURATION);requestAnimationFrame(tick);}requestAnimationFrame(tick);}
