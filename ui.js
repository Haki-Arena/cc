const UI = {

dragIndex:null,
activeEnergyMenu:null,

/* =========================
   MODE
========================= */

toggleMode(){
STATE.mode = STATE.mode === "edit" ? "preview" : "edit";
this.render();
},

toggleBorders(){
STATE.borders = !STATE.borders;
this.render();
},

/* =========================
   SAVE / LOAD / EXPORT
========================= */

saveScheme(){
const data = JSON.stringify(STATE,null,2);
const blob = new Blob([data],{type:"application/json"});
const url = URL.createObjectURL(blob);
const a=document.createElement("a");
a.href=url;
a.download=(STATE.character.name||"character")+".scheme";
a.click();
URL.revokeObjectURL(url);
},

loadScheme(){
const input=document.createElement("input");
input.type="file";
input.accept=".scheme,application/json";

input.onchange=e=>{
const file=e.target.files[0];
if(!file) return;

const reader=new FileReader();
reader.onload=()=>{
try{
const loaded=JSON.parse(reader.result);
Object.assign(STATE,loaded);
STATE.skills.forEach(s=>{
if(!s.cost) s.cost=[0,0,0,0,0];
});
UI.render();
}catch{
alert("Invalid scheme file.");
}
};
reader.readAsText(file);
};
input.click();
},

/* =========================
   SAVE PNG
========================= */

async savePNG(){
  if(typeof html2canvas==="undefined"){
    alert("html2canvas not loaded");
    return;
  }

  const oldMode = STATE.mode;

  const safeName = ((STATE.character.name || "character").trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "-")
    .trim()) || "character";

  // Keep export stable (avoid freezes)
  const scale = Math.min(1.5, (window.devicePixelRatio || 1));

  const wait2Frames = () => new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r)));

  try{
    // 1) Switch to preview
    STATE.mode="preview";
    UI.render();

    // 2) Let layout/fonts/images settle
    await wait2Frames();
    if(document.fonts && document.fonts.ready){
      await Promise.race([document.fonts.ready, new Promise(r=>setTimeout(r,1500))]);
    }

    const preview = document.getElementById("preview");
    if(!preview) throw new Error("Preview element not found.");

    const imgs = preview.querySelectorAll("img");
    await Promise.race([
      Promise.all([...imgs].map(img=>{
        if(img.complete) return Promise.resolve();
        return new Promise(res=>{ img.onload = img.onerror = res; });
      })),
      new Promise(r=>setTimeout(r, 3000))
    ]);

    // 3) Screenshot the preview (clone into offscreen wrapper for stability)
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-100000px";
    wrapper.style.top = "0";
    wrapper.style.background = "#ececec";

    const clone = preview.cloneNode(true);
    clone.classList.remove("hidden");
    clone.style.display = "block";

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    await wait2Frames();

    const canvas = await html2canvas(clone,{
      backgroundColor:"#ececec",
      scale,
      useCORS:false,
      allowTaint:true,
      logging:false
    });

    wrapper.remove();

    // watermark (optional)
    const ctx = canvas.getContext("2d");
    ctx.font = "16px Arial";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.textAlign = "center";
    ctx.fillText(
      "Made with Haki-Arena's Character Creator",
      canvas.width/2,
      canvas.height-20
    );

    // 4) Auto-download
    const blob = await new Promise((resolve, reject)=>{
      canvas.toBlob(b=>{
        if(!b) reject(new Error("PNG export failed (toBlob returned null)."));
        else resolve(b);
      }, "image/png");
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}_character.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 15000);

  }catch(err){
    console.error("SavePNG failed:", err);
    alert("Save PNG failed.\n\n" + (err?.message || err));
  }finally{
    // 5) Back to old mode
    STATE.mode = oldMode;
    UI.render();
  }
},


/* =========================
   SAVE PICTURES (MULTI PNG DOWNLOAD)
========================= */

async savePictures(){

  const charNameRaw = (STATE.character.name || "character").trim();
  const safeName = (charNameRaw
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "-")
    .trim()) || "character";

  // Build list in order: 1 = face, 2.. = skills
  const items = [];

  if(STATE.character.faceImage){
    items.push({ idx: 1, dataUrl: STATE.character.faceImage });
  }

  let n = items.length ? 2 : 1;
  for(const s of STATE.skills){
    if(s && s.image){
      items.push({ idx: n, dataUrl: s.image });
      n++;
    }
  }

  if(items.length === 0){
    alert("No pictures found to export.");
    return;
  }

  // dataURL -> Blob
  const dataUrlToBlob = async (dataUrl)=>{
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  // Download helper
  const downloadBlob = (blob, filename)=>{
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  };

  try{
    for(const it of items){
      const blob = await dataUrlToBlob(it.dataUrl);
      const filename = `${safeName}_${it.idx}.png`;
      downloadBlob(blob, filename);
      await new Promise(r=>setTimeout(r, 350));
    }
  }catch(err){
    console.error("savePictures failed:", err);
    alert("Could not export pictures. Check console for details.");
  }
},

/* =========================
   FACE
========================= */

toggleFaceSize(){
STATE.character.faceSize=
STATE.character.faceSize===75?100:75;
this.render();
},

uploadFace(){
UI.pickImageAndMaybeEdit({
kind:"face",
targetSize: STATE.character.faceSize || 75,
onApply:(dataUrl)=>{
STATE.character.faceImage = dataUrl;
UI.render();
}
});
},

/* =========================
   SKILLS
========================= */

addSkill(){
STATE.skills.push(createSkill());
this.render();
},

removeSkill(i){
if(STATE.skills.length<=4) return;
STATE.skills.splice(i,1);
this.render();
},

uploadSkill(i){
UI.pickImageAndMaybeEdit({
kind:"skill",
targetSize:75,
onApply:(dataUrl)=>{
STATE.skills[i].image = dataUrl;
UI.render();
}
});
},

/* =========================
   IMAGE PICK + EDITOR
========================= */

pickImageAndMaybeEdit({ kind, targetSize, onApply }){

const input = document.createElement("input");
input.type="file";
input.accept="image/*";

input.onchange=e=>{
const file=e.target.files[0];
if(!file) return;

const r=new FileReader();
r.onload=()=>{
const src=r.result;

const goEdit=confirm(
"Do you want to edit/crop this image before applying?\n\nOK = Edit\nCancel = Keep as is"
);

if(!goEdit){
onApply(src);
return;
}

UI.openImageEditor({
src,
title: kind==="face"
?`Edit Face (${targetSize}×${targetSize})`
:`Edit Skill (75×75)`,
targetSize,
onSave:onApply
});
};
r.readAsDataURL(file);
};

input.click();
},

openImageEditor({src,title,targetSize,onSave}){

if(typeof Cropper==="undefined"){
alert("CropperJS not loaded.");
return;
}

const modal=document.createElement("div");
modal.className="img-modal";

modal.innerHTML=`
<div class="img-modal-card">
  <div class="img-modal-left">
    <img id="imgEditSource" src="${src}">
  </div>

  <div class="img-modal-right">
    <h3 class="img-modal-title">${title}</h3>

    <div class="ctrl">
      <div class="small" style="margin-bottom:6px;color:#666;">Live preview</div>
      <canvas id="livePrev" width="150" height="150"
        style="width:150px;height:150px;border:1px solid #ccc;border-radius:8px;background:#fff;"></canvas>
    </div>

    <div class="ctrl">
      <label><span>HQ quality</span><span id="hqVal">6×</span></label>
      <input id="hq" type="range" min="2" max="10" value="6">
      <div class="small" style="color:#666;">Higher = sharper (slower). 6× default.</div>
    </div>

    <!-- NEW: Smooth resize + Flip Horizontal -->
    <div class="ctrl">
      <label>
        <span>Smooth resize (bicubic-like)</span>
        <input id="smoothToggle" type="checkbox" checked>
      </label>
      <div class="small" style="color:#666;">Cleaner gradients when shrinking.</div>
    </div>

    <div class="ctrl">
      <label>
        <span>Flip Horizontal</span>
        <input id="flipToggle" type="checkbox">
      </label>
    </div>

    <div class="ctrl">
      <label>
        <span>Sharpen</span>
        <input id="hpToggle" type="checkbox" checked>
      </label>
      <div class="small" style="color:#666;">If it looks crispy, disable Sharpen.</div>
    </div>

    <div class="ctrl">
      <label style="gap:10px;">
        <span>Hue</span>
        <span style="display:flex;gap:6px;align-items:center;">
          <input id="hueNum" type="number" min="-180" max="180" value="0" style="width:72px;">
          <span id="hueVal">0</span>
        </span>
      </label>
      <input id="hue" type="range" min="-180" max="180" value="0">
    </div>

    <div class="ctrl">
      <label style="gap:10px;">
        <span>Saturation</span>
        <span style="display:flex;gap:6px;align-items:center;">
          <input id="satNum" type="number" min="0" max="200" value="100" style="width:72px;">
          <span id="satVal">100</span>
        </span>
      </label>
      <input id="sat" type="range" min="0" max="200" value="100">
    </div>

    <div class="ctrl">
      <label style="gap:10px;">
        <span>Brightness</span>
        <span style="display:flex;gap:6px;align-items:center;">
          <input id="briNum" type="number" min="0" max="200" value="100" style="width:72px;">
          <span id="briVal">100</span>
        </span>
      </label>
      <input id="bri" type="range" min="0" max="200" value="100">
    </div>

    <div class="ctrl">
      <label style="gap:10px;">
        <span>Contrast</span>
        <span style="display:flex;gap:6px;align-items:center;">
          <input id="conNum" type="number" min="0" max="200" value="100" style="width:72px;">
          <span id="conVal">100</span>
        </span>
      </label>
      <input id="con" type="range" min="0" max="200" value="100">
    </div>

    <div class="ctrl-row">
      <button id="undoBtn" disabled>Undo</button>
      <button id="redoBtn" disabled>Redo</button>
      <button id="resetBtn">Reset</button>
    </div>

    <div class="ctrl-row">
      <button id="cancelBtn" class="danger">Cancel</button>
      <button id="saveBtn" class="primary">Save</button>
    </div>

    <div class="small" style="margin-top:10px;color:#666;">
      Tip: scroll to zoom, drag to move. Crop locked to square.
    </div>

  </div>
</div>
`;

document.body.appendChild(modal);

// close on backdrop click
modal.addEventListener("click",(ev)=>{
if(ev.target===modal) cleanup();
});

const img=modal.querySelector("#imgEditSource");

const hpToggle=modal.querySelector("#hpToggle");
const smoothToggle=modal.querySelector("#smoothToggle");
const flipToggle=modal.querySelector("#flipToggle");

const hue=modal.querySelector("#hue");
const sat=modal.querySelector("#sat");
const bri=modal.querySelector("#bri");
const con=modal.querySelector("#con");

const hueNum=modal.querySelector("#hueNum");
const satNum=modal.querySelector("#satNum");
const briNum=modal.querySelector("#briNum");
const conNum=modal.querySelector("#conNum");

const hueVal=modal.querySelector("#hueVal");
const satVal=modal.querySelector("#satVal");
const briVal=modal.querySelector("#briVal");
const conVal=modal.querySelector("#conVal");

const livePrev=modal.querySelector("#livePrev");

const hq=modal.querySelector("#hq");
const hqVal=modal.querySelector("#hqVal");

const undoBtn=modal.querySelector("#undoBtn");
const redoBtn=modal.querySelector("#redoBtn");
const resetBtn=modal.querySelector("#resetBtn");
const cancelBtn=modal.querySelector("#cancelBtn");
const saveBtn=modal.querySelector("#saveBtn");

let cropper=null;

let history=[];
let idx=-1;

function clampInt(v,min,max,def){
const n=parseInt(v,10);
if(Number.isNaN(n)) return def;
return Math.max(min, Math.min(max, n));
}

function updateLabels(){
hueVal.textContent=hue.value;
satVal.textContent=sat.value;
briVal.textContent=bri.value;
conVal.textContent=con.value;

hueNum.value = hue.value;
satNum.value = sat.value;
briNum.value = bri.value;
conNum.value = con.value;

hqVal.textContent = `${hq.value}×`;
}

function snapshot(){
if(!cropper) return;

const data={
crop:cropper.getData(true),
hp:hpToggle.checked,
smooth:smoothToggle.checked,
flip:flipToggle.checked,
h:hue.value,
s:sat.value,
b:bri.value,
c:con.value,
q:hq.value
};

history=history.slice(0,idx+1);
history.push(data);
idx=history.length-1;

undoBtn.disabled=idx<=0;
redoBtn.disabled=idx>=history.length-1;
}

function applyState(st){
if(!cropper) return;

cropper.setData(st.crop);
hpToggle.checked=!!st.hp;
smoothToggle.checked=!!st.smooth;
flipToggle.checked=!!st.flip;

hue.value=st.h;
sat.value=st.s;
bri.value=st.b;
con.value=st.c;
hq.value=st.q;

updateLabels();
scheduleLivePreview();
}

function doUndo(){
if(idx<=0) return;
idx--;
applyState(history[idx]);
undoBtn.disabled=idx<=0;
redoBtn.disabled=idx>=history.length-1;
}

function doRedo(){
if(idx>=history.length-1) return;
idx++;
applyState(history[idx]);
undoBtn.disabled=idx<=0;
redoBtn.disabled=idx>=history.length-1;
}

undoBtn.onclick=doUndo;
redoBtn.onclick=doRedo;

function cleanup(){
try{ cropper && cropper.destroy(); }catch{}
modal.remove();
document.removeEventListener("keydown", onKey);
}

cancelBtn.onclick=cleanup;

function onKey(e){
if(e.key==="Escape") cleanup();
if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="z"){
e.preventDefault();
doUndo();
}
if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="y"){
e.preventDefault();
doRedo();
}
}
document.addEventListener("keydown", onKey);

/* =========================
   HQ pipeline helpers
========================= */

// Fast sharpen kernel (reduced default amount later)
function applySharpen(ctx, amount=0.35){
const w=ctx.canvas.width;
const h=ctx.canvas.height;
const imgData=ctx.getImageData(0,0,w,h);
const src=imgData.data;
const out=new Uint8ClampedArray(src.length);

const idx4=(x,y)=> (y*w+x)*4;

for(let y=0;y<h;y++){
for(let x=0;x<w;x++){
const i=idx4(x,y);

// edges copy
if(x===0 || y===0 || x===w-1 || y===h-1){
out[i]=src[i];
out[i+1]=src[i+1];
out[i+2]=src[i+2];
out[i+3]=src[i+3];
continue;
}

const c=idx4(x,y);
const l=idx4(x-1,y);
const r=idx4(x+1,y);
const u=idx4(x,y-1);
const d=idx4(x,y+1);

for(let ch=0; ch<3; ch++){
const val = (5*src[c+ch] - src[l+ch] - src[r+ch] - src[u+ch] - src[d+ch]);
const mixed = src[c+ch] + (val - src[c+ch]) * amount;
out[i+ch]=Math.max(0, Math.min(255, mixed));
}
out[i+3]=src[i+3];
}
}
imgData.data.set(out);
ctx.putImageData(imgData,0,0);
}

// Bicubic-like downscale (Hermite filter). Better gradients on shrink.
function resizeHermite(srcCanvas, dstW, dstH){
  const srcCtx = srcCanvas.getContext("2d");
  const srcW = srcCanvas.width, srcH = srcCanvas.height;

  const srcImg = srcCtx.getImageData(0,0,srcW,srcH);
  const srcData = srcImg.data;

  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = dstW;
  dstCanvas.height = dstH;
  const dstCtx = dstCanvas.getContext("2d");
  const dstImg = dstCtx.createImageData(dstW, dstH);
  const dstData = dstImg.data;

  const ratioW = srcW / dstW;
  const ratioH = srcH / dstH;
  const ratioWHalf = Math.ceil(ratioW / 2);
  const ratioHHalf = Math.ceil(ratioH / 2);

  for(let j=0; j<dstH; j++){
    for(let i=0; i<dstW; i++){
      const x2 = (i + j*dstW) * 4;
      let weights = 0;
      let r=0, g=0, b=0, a=0;

      const centerY = (j + 0.5) * ratioH;
      const yyStart = Math.floor(j * ratioH);
      const yyEnd = Math.ceil((j+1) * ratioH);

      for(let yy=yyStart; yy<yyEnd; yy++){
        const dy = Math.abs(centerY - (yy + 0.5)) / ratioHHalf;
        const centerX = (i + 0.5) * ratioW;
        const xxStart = Math.floor(i * ratioW);
        const xxEnd = Math.ceil((i+1) * ratioW);

        for(let xx=xxStart; xx<xxEnd; xx++){
          const dx = Math.abs(centerX - (xx + 0.5)) / ratioWHalf;
          const w = Math.sqrt(dx*dx + dy*dy);

          if(w >= 1) continue;
          const weight = 2*w*w*w - 3*w*w + 1; // Hermite

          const pos = (4 * (xx + yy * srcW));
          a += weight * srcData[pos + 3];
          r += weight * srcData[pos];
          g += weight * srcData[pos + 1];
          b += weight * srcData[pos + 2];
          weights += weight;
        }
      }

      dstData[x2]     = r / weights;
      dstData[x2 + 1] = g / weights;
      dstData[x2 + 2] = b / weights;
      dstData[x2 + 3] = a / weights;
    }
  }

  dstCtx.putImageData(dstImg, 0, 0);
  return dstCanvas;
}

function renderOutputToCanvas(outCanvas, finalSize){
if(!cropper) return;

const q = clampInt(hq.value, 2, 10, 6);
const bigSize = finalSize * q;

// 1) crop at big resolution
const big = cropper.getCroppedCanvas({
width: bigSize,
height: bigSize,
imageSmoothingEnabled: true,
imageSmoothingQuality: "high"
});

const bctx = big.getContext("2d");

// 2) apply filters on big canvas
bctx.filter = `
hue-rotate(${hue.value}deg)
saturate(${sat.value}%)
brightness(${bri.value}%)
contrast(${con.value}%)
`;

const tmp=document.createElement("canvas");
tmp.width=big.width;
tmp.height=big.height;
tmp.getContext("2d").drawImage(big,0,0);

bctx.clearRect(0,0,big.width,big.height);
bctx.drawImage(tmp,0,0);
bctx.filter="none";

// 3) sharpen (optional, reduced strength)
if(hpToggle.checked){
applySharpen(bctx, 0.35);
}

// 3.5) flip horizontal (optional)
let bigToUse = big;
if(flipToggle.checked){
  const flipped = document.createElement("canvas");
  flipped.width = big.width;
  flipped.height = big.height;
  const fctx = flipped.getContext("2d");
  fctx.translate(flipped.width, 0);
  fctx.scale(-1, 1);
  fctx.drawImage(big, 0, 0);
  bigToUse = flipped;
}

// 4) downscale to final (smooth bicubic-like OR normal)
let finalCanvas;
if(smoothToggle.checked){
  finalCanvas = resizeHermite(bigToUse, finalSize, finalSize);
} else {
  finalCanvas = document.createElement("canvas");
  finalCanvas.width = finalSize;
  finalCanvas.height = finalSize;
  const octx = finalCanvas.getContext("2d");
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.clearRect(0,0,finalSize,finalSize);
  octx.drawImage(bigToUse, 0, 0, finalSize, finalSize);
}

// Copy into outCanvas
outCanvas.width = finalSize;
outCanvas.height = finalSize;
outCanvas.getContext("2d").clearRect(0,0,finalSize,finalSize);
outCanvas.getContext("2d").drawImage(finalCanvas, 0, 0);
}

/* =========================
   Live preview scheduling
========================= */

let raf=0;
function scheduleLivePreview(){
if(raf) return;
raf = requestAnimationFrame(()=>{
raf=0;
renderOutputToCanvas(livePrev, 150);
});
}

/* =========================
   Init cropper
========================= */

cropper = new Cropper(img,{
aspectRatio:1,
viewMode:1,
dragMode:"move",
autoCropArea:1,
background:false,
responsive:true,
movable:true,
zoomable:true
});

// Cropper emits crop events while moving/zooming
img.addEventListener("crop", ()=>{
scheduleLivePreview();
});

// Sliders: live update on input
[hue,sat,bri,con,hq].forEach(el=>{
el.addEventListener("input", ()=>{
updateLabels();
scheduleLivePreview();
});
});

// Toggle sharpen / smooth / flip: snapshot + preview
hpToggle.addEventListener("change", ()=>{
snapshot();
scheduleLivePreview();
});
smoothToggle.addEventListener("change", ()=>{
snapshot();
scheduleLivePreview();
});
flipToggle.addEventListener("change", ()=>{
snapshot();
scheduleLivePreview();
});

// Commit snapshot on slider release
[hue,sat,bri,con,hq].forEach(el=>{
el.addEventListener("change", ()=>{
updateLabels();
snapshot();
});
});

// Typed inputs → sync to sliders
function bindNumberToRange(numEl, rangeEl, min, max, def){
numEl.addEventListener("input", ()=>{
const v = clampInt(numEl.value, min, max, def);
rangeEl.value = v;
updateLabels();
scheduleLivePreview();
});
numEl.addEventListener("change", ()=>{
const v = clampInt(numEl.value, min, max, def);
rangeEl.value = v;
updateLabels();
snapshot();
scheduleLivePreview();
});
}

bindNumberToRange(hueNum, hue, -180, 180, 0);
bindNumberToRange(satNum, sat, 0, 200, 100);
bindNumberToRange(briNum, bri, 0, 200, 100);
bindNumberToRange(conNum, con, 0, 200, 100);

// First snapshot after cropper settles
setTimeout(()=>{
updateLabels();
snapshot();
scheduleLivePreview();
}, 120);

resetBtn.onclick=()=>{
if(!cropper) return;
cropper.reset();

hpToggle.checked=true;
smoothToggle.checked=true;
flipToggle.checked=false;

hue.value=0; sat.value=100; bri.value=100; con.value=100;
hq.value=6;

updateLabels();
snapshot();
scheduleLivePreview();
};

saveBtn.onclick=()=>{
const out=document.createElement("canvas");
renderOutputToCanvas(out, targetSize);
const dataUrl = out.toDataURL("image/png");
onSave(dataUrl);
cleanup();
};

},

/* =========================
   ENERGY MENU
========================= */

openEnergyMenu(e,index){
e.stopPropagation();
this.closeEnergyMenu();

const skill=STATE.skills[index];
if(!skill.cost) skill.cost=[0,0,0,0,0];

const colors=["#16be48","#eb000b","#e8dc00","#0bb6ff","#1f1f1f"];

const menu=document.createElement("div");
menu.className="energy-menu";
menu.addEventListener("click",ev=>ev.stopPropagation());

menu.innerHTML=skill.cost.map((val,i)=>`
<div class="energy-row">
<span class="energy" style="background:${colors[i]}"></span>
<button onclick="UI.changeEnergy(${index},${i},-1)">-</button>
<span>${val}</span>
<button onclick="UI.changeEnergy(${index},${i},1)">+</button>
</div>
`).join("");

document.body.appendChild(menu);
const rect=e.target.getBoundingClientRect();
menu.style.left=rect.left+"px";
menu.style.top=(rect.bottom+4)+"px";
this.activeEnergyMenu=menu;

setTimeout(()=>{
document.addEventListener("click",UI.closeEnergyMenuBound);
});
},

closeEnergyMenu(){
if(this.activeEnergyMenu){
this.activeEnergyMenu.remove();
this.activeEnergyMenu=null;
document.removeEventListener("click",UI.closeEnergyMenuBound);
}
},

changeEnergy(skillIndex,colorIndex,delta){
const cost=STATE.skills[skillIndex].cost;
cost[colorIndex]=Math.max(0,(cost[colorIndex]||0)+delta);
this.render();
},

closeEnergyMenuBound(){
UI.closeEnergyMenu();
},

/* =========================
   RENDER
========================= */

render(){
document.body.classList.toggle("show-borders",STATE.borders);
document.getElementById("editor").classList.toggle("hidden",STATE.mode==="preview");
document.getElementById("preview").classList.toggle("hidden",STATE.mode==="edit");
STATE.mode==="edit"?this.renderEditor():this.renderPreview();
},

/* =========================
   EDITOR
========================= */

renderEditor(){
const root=document.getElementById("editor");
const faceSize=STATE.character.faceSize||75;

root.innerHTML=`
<div class="card">

<div class="char-title">
<img src="CharIco.png" class="char-small-icon">
<input class="char-name"
value="${STATE.character.name}"
placeholder="Character Name"
oninput="STATE.character.name=this.value">
<button class="face-toggle"
onclick="UI.toggleFaceSize()">
${STATE.character.faceSize===100?"100px":"75px"}
</button>
</div>

<div class="char-main">
<div class="face-pic"
style="width:${faceSize}px;height:${faceSize}px"
onclick="UI.uploadFace()">
${STATE.character.faceImage
? `<img src="${STATE.character.faceImage}" style="width:100%;height:100%;object-fit:cover">`
: `<img src="UploadIco.png" class="upload-overlay">`}
</div>

<div class="char-desc">
<textarea
oninput="STATE.character.description=this.value">${STATE.character.description}</textarea>
</div>
</div>

<div class="req-line">
<b>Requirements to Unlock:</b>
<input value="${STATE.character.requirements}"
oninput="STATE.character.requirements=this.value">
</div>
</div>

<h3>Skills</h3>
<div id="skills" class="skills-grid"></div>
`;

this.renderSkills();
},

/* =========================
   SKILL DRAG & DROP
========================= */

startDragSkill(e, index){
  UI.dragIndex = index;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(index));
},

allowDropSkill(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
},

dropSkill(e, dropIndex){
  e.preventDefault();

  const from = UI.dragIndex;
  if(from === null || from === undefined) return;
  if(from === dropIndex) return;

  const moved = STATE.skills.splice(from, 1)[0];
  STATE.skills.splice(dropIndex, 0, moved);

  UI.dragIndex = null;
  UI.render();
},

renderSkills(){

  const wrap = document.getElementById("skills");
  wrap.innerHTML = "";

  STATE.skills.forEach((skill,index)=>{

    const div = document.createElement("div");
    div.className = "skill";

    // Drop target for reordering
    div.ondragover = UI.allowDropSkill;
    div.ondrop = (e)=>UI.dropSkill(e,index);

    div.innerHTML = `

      <div class="skill-header" style="display:flex;align-items:center;gap:8px;">

        <input class="skill-name"
          style="flex:1;"
          value="${skill.name}"
          placeholder="Skill Name"
          oninput="STATE.skills[${index}].name=this.value">

        <div class="skill-actions" style="display:flex;gap:6px;align-items:center;">

          <button title="Drag to reorder"
            draggable="true"
            ondragstart="UI.startDragSkill(event, ${index})"
            style="border:1px solid #dcdcdc;background:#fff;border-radius:6px;padding:4px 8px;cursor:grab;font-weight:bold;">
            ☰
          </button>

          <button title="Remove skill"
            onclick="UI.removeSkill(${index})"
            style="border:1px solid #dcdcdc;background:#fff;border-radius:6px;padding:4px 8px;cursor:pointer;font-weight:bold;">
            ✕
          </button>

        </div>

      </div>

      <div class="skill-desc">

        <div class="skill-img" onclick="UI.uploadSkill(${index})">
          ${skill.image
            ? `<img src="${skill.image}" style="width:100%;height:100%;object-fit:cover">`
            : `<img src="UploadIco.png" class="upload-overlay">`}
        </div>

        <textarea
          placeholder="Skill Description"
          oninput="STATE.skills[${index}].description=this.value">${skill.description}</textarea>

      </div>

      <div class="skill-footer">

        <div>

          <div class="small"><b>Cooldown:</b>
            <input value="${skill.cooldown||""}"
              placeholder="None"
              oninput="
                let v=this.value.trim();

                if(v===''){
                  STATE.skills[${index}].cooldown='';
                  return;
                }

                if(v.toLowerCase()==='none'){
                  this.value='None';
                  STATE.skills[${index}].cooldown='None';
                  return;
                }

                if(/^[1-9]\\d*$/.test(v)){
                  STATE.skills[${index}].cooldown=v;
                  return;
                }

                this.value=STATE.skills[${index}].cooldown||'';
              ">
          </div>

          <div class="small"><b>Classes:</b>
            <input value="${skill.classes||""}"
              placeholder="None"
              oninput="STATE.skills[${index}].classes=this.value">
          </div>

        </div>

        <div>
          <b>Cost:</b>
          ${this.energyUI(index,true)}
        </div>

      </div>
    `;

    wrap.appendChild(div);
  });
},

energyUI(i,editable=false){
const colors=["#16be48","#eb000b","#e8dc00","#0bb6ff","#1f1f1f"];
const skill=STATE.skills[i];
if(!skill.cost) skill.cost=[0,0,0,0,0];

const squares=skill.cost
.map((c,idx)=>Array(c).fill(
`<span class="energy" style="background:${colors[idx]}"></span>`
).join(""))
.join("");

return `
<span class="energy-display">${squares||"None"}</span>
${editable?`<button onclick="UI.openEnergyMenu(event,${i})">+</button>`:""}
`;
},

/* =========================
   PREVIEW
========================= */

renderPreview(){

const root=document.getElementById("preview");
const border=STATE.borders?"outline:1px solid black":"";

root.innerHTML=`
<div class="card preview-card">

<div class="preview-title preview-divider">
<img src="CharIco.png" class="preview-icon-hq">
<h2 class="char-preview-name">${STATE.character.name||"Character Name"}</h2>
</div>

<div class="preview-main preview-divider">

${STATE.character.faceImage
? `<img class="preview-face"
style="width:${STATE.character.faceSize}px;height:${STATE.character.faceSize}px;${border}"
src="${STATE.character.faceImage}">`
: `<div class="preview-face"
style="width:${STATE.character.faceSize}px;height:${STATE.character.faceSize}px;background:#ddd;"></div>`
}

<div class="preview-desc">${STATE.character.description || "Character Description"}</div>
</div>

<div class="preview-req preview-divider small">
<b>Requirements to Unlock:</b>
${STATE.character.requirements||"None"}
</div>

<div class="preview-skills-grid">
${STATE.skills.map((s,i)=>`
<div class="preview-skill">
<div class="skill-preview-name preview-divider">
${s.name||"Skill Name"}
</div>

<div class="preview-skill-row preview-divider">
${s.image
? `<img class="preview-skill-img" style="${border}" src="${s.image}">`
: `<div class="preview-skill-img"></div>`}

<div class="preview-skill-content">
${s.description||"Skill Description"}
</div>
</div>

<div class="preview-skill-stats">
<div class="preview-left small">
<div><b>Cooldown:</b> ${s.cooldown||"None"}</div>
<div class="preview-classes"><b>Classes:</b> ${s.classes||"None"}</div>
</div>

<div class="preview-right small">
<b>Cost:</b> ${this.energyUI(i,false)}
</div>
</div>
</div>
`).join("")}
</div>
</div>
`;
}

};



