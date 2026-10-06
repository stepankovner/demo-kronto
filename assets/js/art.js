// Иллюстрации сайта: <kronto-beacon> (маяк на первом экране), <kronto-waves>
// (зернистые волны) и <kronto-lines> (линейная графика на фоне секций).
//
// Чтобы страница не тормозила:
// — на всю страницу один WebGL-контекст: он рисует кадр и копирует его
//   в обычный <canvas> элемента (drawImage — копия на видеокарте, без
//   кодирования в JPEG и без отдельного контекста на каждую картинку);
// — волны рисуются один раз, когда элемент подходит к экрану, и заново
//   только при заметном изменении размера;
// — без WebGL остаётся CSS-фон элемента (градиент в sections.css).

const LAZY_MARGIN = "600px 0px";

/* ─────────────── общий WebGL ─────────────── */

const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

const WAVES_FS = `precision highp float;
uniform vec2 uRes;uniform float uT,uSeed,uDpr,uFreq,uAmp,uBands,uTilt;
uniform vec3 uDeep,uA,uB,uC,uD,uE;
float h(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}
float bnd(float x,float i){return i*uBands+uAmp*sin(x*uFreq+i*.9+uSeed+uT*.12)+uAmp*.45*sin(x*uFreq*2.1-i*1.7+uSeed*1.3-uT*.08);}
vec3 pal(float k){float m=mod(k,5.);return m<1.?uA:m<2.?uB:m<3.?uC:m<4.?uD:uE;}
void main(){
  vec2 px=gl_FragCoord.xy;
  vec2 uv=px/uRes.y-vec2(uRes.x/uRes.y*.5,.5);
  float ca=cos(uTilt),sa=sin(uTilt);
  uv=mat2(ca,-sa,sa,ca)*uv;
  float x=uv.x,y=uv.y;
  float k=-9.;
  for(int i=-8;i<9;i++){float fi=float(i);if(y>bnd(x,fi))k=fi;}
  float b0=bnd(x,k),b1=bnd(x,k+1.);
  float s=clamp((y-b0)/(b1-b0),0.,1.);
  float body=smoothstep(0.,.88,s);
  float rim=1.-smoothstep(.88,1.,s);
  float L=pow(body,1.5)*rim;
  float along=fbm(vec2(x*1.1+k*3.1,k*.7+uT*.03+uSeed));
  L*=.25+1.2*along;
  L+=(vn(px/uDpr*.33)*.6+vn(px/uDpr*.9)*.4-.5)*.34;
  float g=h(floor(px/uDpr)+uSeed*17.);
  float st=smoothstep(g-.32,g+.32,L);
  vec3 col=mix(uDeep,pal(k),st);
  float hi=smoothstep(g-.2,g+.2,L-.6);
  col=mix(col,uB,hi*.55);
  col*=.8+.2*fbm(uv*2.5+uT*.02);
  gl_FragColor=vec4(col,1.);
}`;

const BEACON_FS = `precision highp float;
uniform vec2 uRes;uniform float uPx,uLx,uHz;
#define C(r,g,b) (vec3(r,g,b)/255.)
float h(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p*=2.02;a*=.5;}return s;}
float aa(float d,float fw){return clamp(.5-d/fw,0.,1.);}
const vec2 DIR=vec2(-.9627,.2706);
const vec2 PER=vec2(-.2706,-.9627);
float shape(vec2 p,vec2 L){
  vec2 d=p-L;float u=dot(d,DIR);if(u<0.)return 0.;
  float v=dot(d,PER);float w=.014+u*.3;
  return exp(-pow(v/w,2.)*1.5)/(1.+u*.8)*smoothstep(0.,.04,u);
}
float glit(vec2 p,vec2 L,float off){
  vec2 d=p-L;float u=dot(d,DIR);if(u<0.)return 0.;
  float w=.014+u*.3;float q=dot(d,PER)/w+off;
  vec2 cc=vec2(u/(.0025+u*.009),q*34.);
  vec2 cell=floor(cc);
  float r=h(cell);
  float fx=fract(cc.x),fy=fract(cc.y);
  float soft=smoothstep(0.,.35,fx)*smoothstep(1.,.65,fx)*smoothstep(0.,.3,fy)*smoothstep(1.,.7,fy);
  float clump=fbm(vec2(u*2.6,q*1.1)+4.);
  float g=smoothstep(.55,1.,r*(.4+clump*1.1))*(.35+.65*soft);
  return g*exp(-q*q*1.1)/(1.+u*.6)*smoothstep(0.,.06,u);
}
void main(){
  vec2 px=gl_FragCoord.xy;vec2 p=px/uRes.y;float ar=uRes.x/uRes.y;
  float hz=uHz;vec2 L=vec2(ar*uLx,min(hz+.3,.9));
  vec3 cream=C(240,231,213),teal=C(124,196,186),warm=C(255,208,162);
  vec3 col;
  if(p.y>=hz){
    float t=smoothstep(hz,1.,p.y);
    col=mix(C(38,47,80),C(10,13,28),pow(t,.7));
    col+=C(70,84,128)*.25*exp(-(p.y-hz)*9.);
    col+=C(60,72,112)*.18*fbm(vec2(p.x*1.6,p.y*3.)+1.)*(1.-t);
    float sh=shape(p,L);
    col+=mix(cream,C(170,190,220),.35)*sh*.42;
    float gA=glit(p,L,-.07),gB=glit(p,L,0.),gC=glit(p,L,.07);
    col+=warm*gA*.4+cream*gB*.75+teal*gC*.45;
    float st=step(.9993,h(floor(px/(1.6*uPx))))*smoothstep(hz+.18,1.,p.y)*(1.-min(sh*4.,1.));
    col+=st*.55;
  }else{
    float dp=hz-p.y;
    col=mix(C(28,35,62),C(7,9,20),smoothstep(0.,hz,dp));
    col+=C(70,84,128)*.16*exp(-dp*16.);
    float rip=(vn(vec2(p.x*6.,dp*50.))-.5)*.05*min(dp*6.,1.);
    vec2 m=vec2(p.x+rip,hz+dp*1.05);
    float row=floor(log(dp+.003)*44.);
    float cw=.002+dp*.05;
    float o=h(vec2(row,7.))*9.;
    float rA=h(vec2(floor((p.x-cw*.28)/cw+o),row));
    float rB=h(vec2(floor(p.x/cw+o),row));
    float rC=h(vec2(floor((p.x+cw*.28)/cw+o),row));
    float bs=shape(m,L)*1.5+glit(m,L,0.)*.9;
    float lc=exp(-abs(p.x-L.x)/(.006+dp*.22))*exp(-dp*2.)*1.25;
    float I=bs+lc;
    float k=.9;
    col+=warm*I*smoothstep(.42,1.,rA)*.5*k+cream*I*smoothstep(.42,1.,rB)*.85*k+teal*I*smoothstep(.42,1.,rC)*.5*k;
    col+=cream*.025*smoothstep(.85,1.,rB)*exp(-dp*5.);
  }
  // Силуэт со сглаженными краями: d — расстояние до края (снаружи > 0),
  // покрытие плавно меняется в пределах одного пикселя.
  float fw=1./uRes.y;
  vec2 rs=vec2(.12,.03);
  vec2 rq=(p-vec2(L.x+.012,hz-.003))/rs;
  float rl=max(length(rq),1e-4);
  float rd=(rl-1.)/length((rq/rl)/rs);
  float rock=aa(max(rd,(hz-.014)-p.y),fw);
  float base=hz+.01,top=L.y-.024;
  float ty=clamp((p.y-base)/(top-base),0.,1.);
  float hw=mix(.024,.0135,ty);
  float dx=abs(p.x-L.x);
  float tower=aa(max(dx-hw,max((base-.01)-p.y,p.y-top)),fw);
  float gal=aa(max(dx-.021,max(top-p.y,p.y-(top+.005))),fw);
  float lamp=aa(max(dx-.0115,max((top+.005)-p.y,p.y-(L.y+.013))),fw);
  float ry=(p.y-(L.y+.013))/.022;
  float roof=aa(max(max(-ry*.022,(ry-1.)*.022),(dx-.015*(1.-ry))*.83),fw);
  vec3 sil=C(7,9,20);
  float rim=smoothstep(hw*.4,hw,L.x-p.x)*.05;
  col=mix(col,sil+C(120,140,190)*rim,max(max(rock,tower),max(gal,roof)));
  float bx=fract((p.x-L.x)*150.),bw=fw*150.;
  float bars=smoothstep(.28-bw,.28+bw,bx)*smoothstep(1.,1.-bw,bx);
  col=mix(col,mix(sil,C(255,246,226),bars),lamp);
  float dl=length((p-L)*vec2(1.,1.15));
  col+=C(255,244,222)*(exp(-dl*38.)*1.3+exp(-dl*10.)*.28+exp(-dl*3.)*.07);
  vec2 vq=px/uRes-.5;
  col*=1.-.5*dot(vq*vec2(1.,1.3),vq*vec2(1.,1.3));
  col+=(h(px*.731)-.5)*.008;
  gl_FragColor=vec4(col,1.);
}`;

let GL; // { gl, canvas, programs } | null после неудачи

function gpu() {
  if (GL !== undefined) return GL;
  GL = null;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    if (!gl) return GL;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    GL = { gl, canvas, programs: {} };
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); GL = null; });
  } catch {
    GL = null;
  }
  return GL;
}

function program(name, fs, uniforms) {
  const ctx = gpu();
  if (!ctx) return null;
  if (ctx.programs[name]) return ctx.programs[name];
  const { gl } = ctx;
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const pr = gl.createProgram();
  gl.attachShader(pr, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  const u = {};
  uniforms.forEach((n) => { u[n] = gl.getUniformLocation(pr, n); });
  const loc = gl.getAttribLocation(pr, "p");
  ctx.programs[name] = { pr, u, loc };
  return ctx.programs[name];
}

// Нарисовать кадр шейдером и скопировать его в canvas элемента.
function paint(target, w, h, name, fs, uniformNames, setUniforms) {
  const prog = program(name, fs, uniformNames);
  if (!prog) return false;
  const { gl, canvas } = GL;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.useProgram(prog.pr);
  gl.enableVertexAttribArray(prog.loc);
  gl.vertexAttribPointer(prog.loc, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, w, h);
  setUniforms(gl, prog.u);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }
  const ctx2d = target.getContext("2d", { alpha: false });
  if (!ctx2d) return false;
  ctx2d.drawImage(canvas, 0, 0);
  return true;
}

// Очередь: одна картинка за кадр, чтобы не было длинных задач на главном потоке.
const queue = new Set();
let pumping = false;

function schedule(el) {
  queue.add(el);
  if (pumping) return;
  pumping = true;
  requestAnimationFrame(function pump() {
    const [next] = queue;
    if (next) {
      queue.delete(next);
      next.draw();
    }
    if (queue.size) requestAnimationFrame(pump);
    else pumping = false;
  });
}

// Элементы рисуются, когда подходят к экрану.
const near = new WeakMap();
const io = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      near.set(e.target, e.isIntersecting);
      if (e.isIntersecting && e.target.needsDraw) schedule(e.target);
    });
  }, { rootMargin: LAZY_MARGIN })
  : null;

class Painted extends HTMLElement {
  connectedCallback() {
    if (!this.cv) {
      this.cv = document.createElement("canvas");
      this.cv.setAttribute("aria-hidden", "true");
      this.appendChild(this.cv);
    }
    this.needsDraw = true;
    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(this);
    if (io) io.observe(this);
    else schedule(this);
  }

  disconnectedCallback() {
    this.ro?.disconnect();
    io?.unobserve(this);
    queue.delete(this);
  }

  attributeChangedCallback() {
    if (this.cv) this.request();
  }

  onResize() {
    const w = this.clientWidth;
    const h = this.clientHeight;
    if (!this.drawnW) {
      this.request();
      return;
    }
    if (Math.abs(w - this.drawnW) > this.resizeStep || Math.abs(h - this.drawnH) > this.resizeStep) {
      // Пока окно тянут, старый кадр просто растягивается; рисуем, когда размер устоялся
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.request(), 150);
    }
  }

  request() {
    this.needsDraw = true;
    if (!io || near.get(this)) schedule(this);
  }

  num(name, fallback) {
    const v = parseFloat(this.getAttribute(name));
    return Number.isFinite(v) ? v : fallback;
  }
}

/* ─────────────── волны ─────────────── */

const hex = (c) => [0, 2, 4].map((i) => parseInt(c.slice(1 + i, 3 + i), 16) / 255);

const PALETTES = {
  night: ["#0e1324", "#2a3356", "#F0E7D5", "#46507e", "#2F6B66", "#1a3d3b"],
  dusk: ["#151b31", "#262F4E", "#F0E7D5", "#3a4470", "#2F6B66", "#5c6898"],
};

const WAVE_UNIFORMS = ["uRes", "uT", "uSeed", "uDpr", "uFreq", "uAmp", "uBands", "uTilt", "uDeep", "uA", "uB", "uC", "uD", "uE"];

class KrontoWaves extends Painted {
  static observedAttributes = ["seed", "palette", "tilt", "freq", "amp", "bands"];
  resizeStep = 40;

  draw() {
    const cw = this.clientWidth;
    const ch = this.clientHeight;
    if (!cw || !ch) return;
    this.needsDraw = false;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5, 1600 / Math.max(cw, ch));
    const w = Math.round(cw * scale);
    const h = Math.round(ch * scale);
    const pal = (PALETTES[this.getAttribute("palette")] || PALETTES.night).map(hex);
    const seed = this.num("seed", 1);
    const ok = paint(this.cv, w, h, "waves", WAVES_FS, WAVE_UNIFORMS, (gl, u) => {
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uT, seed * 7);
      gl.uniform1f(u.uSeed, seed);
      gl.uniform1f(u.uDpr, Math.max(scale, 0.75));
      gl.uniform1f(u.uFreq, this.num("freq", 3.2));
      gl.uniform1f(u.uAmp, this.num("amp", 0.09));
      gl.uniform1f(u.uBands, this.num("bands", 0.16));
      gl.uniform1f(u.uTilt, this.num("tilt", -0.3));
      ["uDeep", "uA", "uB", "uC", "uD", "uE"].forEach((n, i) => gl.uniform3fv(u[n], pal[i]));
    });
    if (ok) {
      this.drawnW = cw;
      this.drawnH = ch;
      this.cv.classList.add("is-ready");
    }
  }
}

/* ─────────────── маяк ─────────────── */

class KrontoBeacon extends Painted {
  static observedAttributes = ["lx", "hz"];
  resizeStep = 2;

  draw() {
    const cw = this.clientWidth;
    const ch = this.clientHeight;
    if (!cw || !ch) return;
    this.needsDraw = false;
    // Полное разрешение экрана (Retina — 2×), но не больше ~4,5 млн
    // пикселей: кадр рисуется один раз, а не каждый кадр анимации.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(dpr, Math.sqrt(4.5e6 / (cw * ch)));
    const w = Math.round(cw * scale);
    const h = Math.round(ch * scale);
    const narrow = cw / ch < 1.25 || cw < 1100;
    const hz = this.num("hz", NaN);
    const ok = paint(this.cv, w, h, "beacon", BEACON_FS, ["uRes", "uPx", "uLx", "uHz"], (gl, u) => {
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uPx, scale);
      gl.uniform1f(u.uLx, this.num("lx", narrow ? 0.74 : 0.6));
      gl.uniform1f(u.uHz, hz > 0.1 && hz < 0.75 ? hz : (narrow ? 0.48 : 0.4));
    });
    if (ok) {
      this.drawnW = cw;
      this.drawnH = ch;
      this.cv.classList.add("is-ready");
    }
  }
}

/* ─────────────── линии (SVG) ─────────────── */

const NS = "http://www.w3.org/2000/svg";

function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

class KrontoLines extends HTMLElement {
  static observedAttributes = ["variant", "color", "seed", "count", "opacity", "fade"];

  connectedCallback() {
    this.ro = new ResizeObserver(() => this.queue());
    this.ro.observe(this);
  }

  disconnectedCallback() {
    this.ro?.disconnect();
  }

  attributeChangedCallback() {
    if (this.ro) this.queue();
  }

  queue() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.render();
    });
  }

  get(name, fallback) {
    const v = this.getAttribute(name);
    if (v == null || v === "") return fallback;
    return typeof fallback === "number" ? parseFloat(v) : v;
  }

  render() {
    const W = this.clientWidth;
    const H = this.clientHeight;
    if (!W || !H || (W === this.w && H === this.h)) return;
    this.w = W;
    this.h = H;
    const v = this.get("variant", "arcs-l");
    const col = this.get("color", "#2F6B66");
    const n = this.get("count", 26);
    const op = this.get("opacity", 1);
    const r = rnd(this.get("seed", 1));
    const fade = this.get("fade", "");
    const mask = fade ? `linear-gradient(${fade}, #000 0%, #000 25%, transparent 70%)` : "";
    this.style.webkitMaskImage = mask;
    this.style.maskImage = mask;

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const style = (i) => {
      const g = i % 6;
      const sw = g === 0 ? 2.4 : g === 3 ? 1.5 : 0.8;
      const o = (g === 0 ? 0.55 : g === 3 ? 0.42 : 0.26 + r() * 0.16) * op;
      return { sw, o };
    };
    const add = (d, i) => {
      const p = document.createElementNS(NS, "path");
      const s = style(i);
      p.setAttribute("d", d);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", col);
      p.setAttribute("stroke-width", s.sw);
      p.setAttribute("stroke-opacity", Math.min(s.o, 1).toFixed(3));
      p.setAttribute("stroke-linecap", "round");
      svg.appendChild(p);
    };
    const f = (x) => x.toFixed(1);
    const S = Math.max(W, H);

    if (v === "arcs-l" || v === "arcs-r") {
      const right = v === "arcs-r";
      const cx = right ? W + S * (0.18 + r() * 0.1) : -S * (0.18 + r() * 0.1);
      const cy = H + S * (0.12 + r() * 0.12);
      let rad = S * 0.32;
      const gap = S * (0.0075 + r() * 0.003);
      for (let i = 0; i < n; i++) {
        add(`M ${f(cx - rad)} ${f(cy)} A ${f(rad)} ${f(rad)} 0 0 1 ${f(cx + rad)} ${f(cy)}`, i);
        rad += gap * (0.7 + r() * 0.9) * (1 + i * 0.03);
      }
    } else if (v === "waves") {
      const fr = (1.2 + r() * 1.2) * Math.PI * 2 / W;
      const ph = r() * 6;
      const amp = H * (0.08 + r() * 0.07);
      const y0 = H * (0.25 + r() * 0.2);
      const gap = H * (0.5 / n);
      for (let i = 0; i < n; i++) {
        let d = "";
        const a = amp * (1 + i * 0.035);
        const pi = ph + i * 0.06;
        for (let x = -20; x <= W + 20; x += 16) {
          const y = y0 + i * gap + Math.sin(x * fr + pi) * a + Math.sin(x * fr * 0.37 + pi * 1.7) * a * 0.6;
          d += `${x === -20 ? "M" : "L"}${f(x)} ${f(y)} `;
        }
        add(d, i);
      }
    } else if (v === "contour") {
      const cx = W * (0.78 + r() * 0.15);
      const cy = H * (0.2 + r() * 0.25);
      for (let i = 0; i < n; i++) {
        const rr = S * 0.03 + i * S * 0.012 * (1 + i * 0.02);
        let d = "";
        for (let k = 0; k <= 72; k++) {
          const t = k / 72 * Math.PI * 2;
          const wob = 1 + 0.12 * Math.sin(t * 3 + i * 0.25) + 0.07 * Math.sin(t * 5 - i * 0.18);
          d += `${k ? "L" : "M"}${f(cx + Math.cos(t) * rr * 1.35 * wob)} ${f(cy + Math.sin(t) * rr * wob)} `;
        }
        add(`${d}Z`, i);
      }
    } else if (v === "streams") {
      // Потоки: линии приходят слева со всей высоты и сходятся в плотный
      // пучок справа — источники компании стекаются в один индекс.
      const fy = H * (0.36 + r() * 0.1);
      const spread = H * 0.07;
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0.5;
        const y0 = H * (-0.25 + 1.5 * t) + (r() - 0.5) * H * 0.04;
        const y1 = fy + (t - 0.5) * spread;
        const bend = (r() - 0.5) * H * 0.35;
        const x1 = W * (0.3 + r() * 0.1);
        const x2 = W * (0.58 + r() * 0.08);
        add(`M -20 ${f(y0)} C ${f(x1)} ${f(y0 + bend)} ${f(x2)} ${f(y1 + (y0 - y1) * 0.12)} ${f(W * 0.82)} ${f(y1)} S ${f(W + 20)} ${f(y1 - (t - 0.5) * spread * 0.4)} ${f(W + 20)} ${f(y1 - (t - 0.5) * spread * 0.4)}`, i);
      }
    }
    this.replaceChildren(svg);
  }
}

customElements.define("kronto-waves", KrontoWaves);
customElements.define("kronto-beacon", KrontoBeacon);
customElements.define("kronto-lines", KrontoLines);
