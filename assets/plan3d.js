/* Al Fath Residence — floor-plan 3D viewer (Three.js, drag to orbit)
   Builds a dollhouse model from two masks per plan:
     *-walls.png  white = wall pixels  -> extruded dark walls
     *-foot.png   white = apartment footprint -> floor slab + texture alpha
     *-tex.jpg    the plan rendering, used as the floor texture            */
(function(){
  var PX_PER_CELL = 1;          // mask pixels per grid cell
  var WORLD_W = 20;             // world units across the plan
  var WALL_H = 1.9, SLAB_H = 0.3;

  function loadImg(src){ return new Promise(function(res, rej){ var i = new Image(); i.onload = function(){ res(i); }; i.onerror = rej; i.src = src; }); }
  function maskGrid(img){
    var cw = Math.floor(img.width / PX_PER_CELL), ch = Math.floor(img.height / PX_PER_CELL);
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var g = c.getContext('2d', {willReadFrequently:true}); g.drawImage(img, 0, 0, cw, ch);
    var d = g.getImageData(0, 0, cw, ch).data, grid = new Uint8Array(cw * ch);
    for (var i = 0; i < cw * ch; i++) grid[i] = d[i * 4] > 127 ? 1 : 0;
    return {w: cw, h: ch, g: grid};
  }
  // greedy rectangle decomposition: horizontal runs merged across identical rows
  function rects(m){
    var out = [], open = {};
    for (var y = 0; y <= m.h; y++){
      var runs = {};
      if (y < m.h){ var x = 0; while (x < m.w){ if (m.g[y*m.w+x]){ var x0 = x; while (x < m.w && m.g[y*m.w+x]) x++; runs[x0+':'+x] = [x0, x]; } else x++; } }
      for (var k in open){ if (runs[k]) { open[k].y1 = y + 1; delete runs[k]; } else { out.push(open[k]); delete open[k]; } }
      for (var k2 in runs) open[k2] = {x0: runs[k2][0], x1: runs[k2][1], y0: y, y1: y + 1};
    }
    for (var k3 in open) out.push(open[k3]);
    return out;
  }

  // ---- furniture models ------------------------------------------------------------------
  // Everything is built with its back toward -Z and then turned to the wall it stands against.
  var PAL = {wood: 0x8a6a4b, woodDark: 0x6d5238, linen: 0xf4efe6, duvet: 0xe8e0d2, pillow: 0xfbfaf6,
             fabric: 0x9aa0a6, stone: 0xece8e0, white: 0xf7f6f2, chrome: 0xc9c5bd, rug: 0xcabfae};
  function mat(c, r){ return new THREE.MeshStandardMaterial({color: c, roughness: r === undefined ? 0.82 : r}); }
  function part(g, w, h, d, m, x, y, z){
    var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x || 0, (y || 0) + h / 2, z || 0);
    b.castShadow = true; b.receiveShadow = true; g.add(b); return b;
  }
  function mkBed(w, d, M, Mh){
    var g = new THREE.Group(), wd = mat(PAL.wood), ln = mat(PAL.linen, 0.9), dv = mat(PAL.duvet, 0.92), pl = mat(PAL.pillow, 0.95);
    part(g, w, 0.26 * Mh, d, wd, 0, 0, 0);                                       // base
    part(g, w * 0.96, 0.22 * Mh, d * 0.94, ln, 0, 0.26 * Mh, 0);                  // mattress
    part(g, w * 0.98, 0.07 * Mh, d * 0.58, dv, 0, 0.48 * Mh, d * 0.19);           // duvet
    part(g, w * 0.38, 0.10 * Mh, d * 0.15, pl, -w * 0.24, 0.48 * Mh, -d * 0.30);  // pillows
    part(g, w * 0.38, 0.10 * Mh, d * 0.15, pl, w * 0.24, 0.48 * Mh, -d * 0.30);
    part(g, w * 1.02, 0.80 * Mh, 0.07 * M, wd, 0, 0, -d / 2);                    // headboard
    return g;
  }
  function mkSofa(w, d, M, Mh, tint){
    var g = new THREE.Group(), fb = mat(tint || PAL.fabric, 0.9), cu = mat((tint || new THREE.Color(PAL.fabric)).clone().offsetHSL(0, 0, 0.07), 0.92);
    part(g, w, 0.32 * Mh, d * 0.96, fb, 0, 0, 0);                                // base
    part(g, w * 0.9, 0.10 * Mh, d * 0.6, cu, 0, 0.32 * Mh, d * 0.14);             // seat cushions
    part(g, w, 0.44 * Mh, 0.16 * M, fb, 0, 0.32 * Mh, -d / 2 + 0.08 * M);         // back
    part(g, 0.15 * M, 0.22 * Mh, d * 0.96, fb, -w / 2 + 0.075 * M, 0.32 * Mh, 0); // arms
    part(g, 0.15 * M, 0.22 * Mh, d * 0.96, fb, w / 2 - 0.075 * M, 0.32 * Mh, 0);
    return g;
  }
  function mkWardrobe(w, d, M, Mh){
    var g = new THREE.Group(), wd = mat(PAL.wood), dk = mat(PAL.woodDark);
    part(g, w, 1.95 * Mh, d, wd, 0, 0, 0);
    part(g, w * 1.02, 0.05 * Mh, d * 1.06, dk, 0, 1.95 * Mh, 0);                  // cornice
    part(g, 0.02 * M, 1.7 * Mh, 0.01 * M, dk, 0, 0.12 * Mh, d / 2 + 0.005 * M);   // door split
    return g;
  }
  function mkCounter(w, d, M, Mh){
    var g = new THREE.Group();
    part(g, w, 0.82 * Mh, d * 0.94, mat(PAL.wood), 0, 0, 0);
    part(g, w * 1.02, 0.06 * Mh, d, mat(PAL.stone, 0.55), 0, 0.82 * Mh, 0);       // worktop
    return g;
  }
  function mkBath(w, d, M, Mh){
    var g = new THREE.Group();
    part(g, w, 0.48 * Mh, d, mat(PAL.white, 0.6), 0, 0, 0);
    part(g, w * 0.82, 0.04 * Mh, d * 0.82, mat(0xdfe6e6, 0.35), 0, 0.46 * Mh, 0); // water
    return g;
  }
  function mkFixture(w, d, M, Mh){
    var g = new THREE.Group();
    part(g, w * 0.9, 0.40 * Mh, d * 0.9, mat(PAL.white, 0.6), 0, 0, 0);
    part(g, w * 0.7, 0.05 * Mh, d * 0.7, mat(PAL.chrome, 0.4), 0, 0.40 * Mh, 0);
    return g;
  }
  function mkRug(w, d, M, Mh){
    var g = new THREE.Group();
    part(g, w * 0.94, 0.02 * Mh, d * 0.94, mat(PAL.rug, 0.95), 0, 0, 0);
    return g;
  }
  function place(g, x, z, side){
    g.position.set(x, SLAB_H, z);
    if (side === 's') g.rotation.y = Math.PI;
    else if (side === 'w') g.rotation.y = -Math.PI / 2;
    else if (side === 'e') g.rotation.y = Math.PI / 2;
    return g;
  }
  // which side of a blob has the most wall just outside it — that is the side a piece backs onto
  function wallSide(walls, x0, y0, x1, y1){
    var band = 5, best = null, bestN = 6, W = walls.w, H = walls.h;
    var count = function(ax0, ay0, ax1, ay1){
      var n = 0;
      for (var y = Math.max(0, ay0); y < Math.min(H, ay1); y++)
        for (var x = Math.max(0, ax0); x < Math.min(W, ax1); x++) if (walls.g[y * W + x]) n++;
      return n;
    };
    var sides = {n: count(x0, y0 - band, x1, y0), s: count(x0, y1, x1, y1 + band),
                 w: count(x0 - band, y0, x0, y1), e: count(x1, y0, x1 + band, y1)};
    for (var k in sides) if (sides[k] > bestN){ bestN = sides[k]; best = k; }
    return best;
  }

  function Viewer(el){
    var self = this;
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.model = null;
    this.yaw = -0.55; this.pitch = 0.95; this.dist = 30; this.targetPitch = 0.95; this.targetYaw = -0.55;
    this.dragging = false; this.idleT = 0; this.last = performance.now();

    var hemi = new THREE.HemisphereLight(0xfff4e6, 0x8c8378, 0.55); this.scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffffff, 1.05); sun.position.set(14, 26, 10); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); var s = 16; sun.shadow.camera.left = -s; sun.shadow.camera.right = s; sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s; sun.shadow.camera.near = 1; sun.shadow.camera.far = 80; sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    var fill = new THREE.DirectionalLight(0xdce8f2, 0.25); fill.position.set(-12, 10, -8); this.scene.add(fill);

    // ground shadow catcher
    var gnd = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({opacity: 0.22}));
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.01; gnd.receiveShadow = true; this.scene.add(gnd);

    this.bind();
    this.resize(); window.addEventListener('resize', function(){ self.resize(); });
    this.running = true; this.loop();
  }
  Viewer.prototype.resize = function(){
    var w = this.el.clientWidth || 600, h = this.el.clientHeight || 420;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };
  Viewer.prototype.bind = function(){
    var self = this, c = this.renderer.domElement, px = 0, py = 0;
    c.style.touchAction = 'pan-y'; c.style.cursor = 'grab'; // one-finger vertical swipes still scroll the page on touch
    c.addEventListener('pointerdown', function(e){ self.dragging = true; px = e.clientX; py = e.clientY; c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing'; self.idleT = 0; });
    c.addEventListener('pointermove', function(e){ if (!self.dragging) return; var dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
      self.targetYaw -= dx * 0.008; self.targetPitch = Math.max(0.12, Math.min(1.45, self.targetPitch + dy * 0.006)); self.idleT = 0; });
    var up = function(e){ self.dragging = false; c.style.cursor = 'grab'; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', function(e){ e.preventDefault(); self.dist = Math.max(16, Math.min(48, self.dist + e.deltaY * 0.02)); self.idleT = 0; }, {passive:false});
    // pinch zoom
    var pinch = null;
    c.addEventListener('touchstart', function(e){ if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, {passive:true});
    c.addEventListener('touchmove', function(e){ if (e.touches.length === 2 && pinch){ var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); self.dist = Math.max(16, Math.min(48, self.dist - (d - pinch) * 0.05)); pinch = d; } }, {passive:true});
    c.addEventListener('touchend', function(){ pinch = null; });
  };
  Viewer.prototype.loop = function(){
    var self = this; if (!this.running) return;
    requestAnimationFrame(function(){ self.loop(); });
    var now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (!this.dragging){ this.idleT += dt; if (this.idleT > 2.5) this.targetYaw += dt * 0.12; }
    this.yaw += (this.targetYaw - this.yaw) * 0.12; this.pitch += (this.targetPitch - this.pitch) * 0.1;
    var cy = Math.sin(this.pitch) * this.dist, r = Math.cos(this.pitch) * this.dist;
    this.camera.position.set(Math.sin(this.yaw) * r, cy, Math.cos(this.yaw) * r);
    this.camera.lookAt(0, 0.4, 0);
    if (this.visible !== false) this.renderer.render(this.scene, this.camera);
  };
  Viewer.prototype.clear = function(){
    if (!this.model) return;
    this.group.remove(this.model);
    this.model.traverse(function(o){
      if (o.geometry) o.geometry.dispose();
      if (!o.material) return;
      // furniture meshes carry a per-face material array
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function(m){
        if (m.map) m.map.dispose(); if (m.alphaMap) m.alphaMap.dispose(); m.dispose();
      });
    });
    this.model = null;
  };
  // Composes the hi-res plan drawing onto the mask grid: meta.jb = content bbox in the JPG, meta.fb = footprint bbox in the mask.
  function floorTexture(jpg, foot, meta){
    var S = 2, W = foot.width, H = foot.height, c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
    var g = c.getContext('2d');
    var sx = (meta.fb[2] - meta.fb[0]) / (meta.jb[2] - meta.jb[0]), sy = (meta.fb[3] - meta.fb[1]) / (meta.jb[3] - meta.jb[1]);
    g.fillStyle = '#efe7da'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(jpg, (meta.fb[0] - meta.jb[0] * sx) * S, (meta.fb[1] - meta.jb[1] * sy) * S, jpg.width * sx * S, jpg.height * sy * S);
    var a = document.createElement('canvas'); a.width = c.width; a.height = c.height; var ag = a.getContext('2d'); ag.drawImage(foot, 0, 0, a.width, a.height);
    var cd = g.getImageData(0, 0, c.width, c.height), ad = ag.getImageData(0, 0, a.width, a.height).data;
    for (var i = 0; i < ad.length; i += 4) cd.data[i + 3] = ad[i];
    g.putImageData(cd, 0, 0);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  Viewer.prototype.load = function(base, meta, cb){
    var self = this, token = (this.token = (this.token || 0) + 1);
    Promise.all([loadImg(base + '-walls.png'), loadImg(base + '-foot.png'), loadImg(meta && meta.tex ? meta.tex : base + '-tex.jpg')]).then(function(imgs){
      if (token !== self.token) return; // superseded
      self.clear();
      var walls = maskGrid(imgs[0]), foot = maskGrid(imgs[1]);
      var W = walls.w, H = walls.h, u = WORLD_W / W, planD = H * u;
      var model = new THREE.Group();
      var wallMat = new THREE.MeshStandardMaterial({color: 0x2b2521, roughness: 0.85, metalness: 0.05});
      var slabMat = new THREE.MeshStandardMaterial({color: 0xe6dccd, roughness: 0.95});
      var box = new THREE.BoxGeometry(1, 1, 1);
      var addRects = function(rs, h, y0, mat, shadow){
        var im = new THREE.InstancedMesh(box, mat, rs.length), m = new THREE.Matrix4();
        for (var i = 0; i < rs.length; i++){ var r = rs[i], w = (r.x1 - r.x0) * u, d = (r.y1 - r.y0) * u;
          m.makeScale(w + u * 0.05, h, d + u * 0.05); m.setPosition((r.x0 + (r.x1 - r.x0) / 2) * u - WORLD_W / 2, y0 + h / 2, (r.y0 + (r.y1 - r.y0) / 2) * u - planD / 2);
          im.setMatrixAt(i, m); }
        im.castShadow = shadow; im.receiveShadow = true; return im;
      };
      model.add(addRects(rects(foot), SLAB_H, 0, slabMat, true));
      model.add(addRects(rects(walls), WALL_H, SLAB_H, wallMat, true));
      // textured floor (hi-res plan drawing registered onto the mask grid) clipped to the footprint
      var tex = (meta && meta.jb) ? floorTexture(imgs[2], imgs[1], meta) : (function(){ var t = new THREE.Texture(imgs[2]); t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; return t; })();
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(imgs[1].width * u, imgs[1].height * u),
        new THREE.MeshStandardMaterial({map: tex, transparent: true, alphaTest: 0.5, roughness: 0.9}));
      floor.rotation.x = -Math.PI / 2; floor.position.y = SLAB_H + 0.012; floor.receiveShadow = true;
      floor.position.x = (imgs[1].width * u - WORLD_W) / 2; floor.position.z = (imgs[1].height * u - planD) / 2;
      model.add(floor);

      // Furniture: every labelled piece is built as a real model (bed with headboard and pillows,
      // sofa with arms and cushions, wardrobe, counter, bath…), sized in metres and turned to face
      // away from the wall it stands against.
      if (meta && meta.furn && meta.furn.length && meta.areaM2){
        var footPx = 0; for (var fi = 0; fi < foot.g.length; fi++) if (foot.g[fi]) footPx++;
        var mpp = Math.sqrt(meta.areaM2 / Math.max(1, footPx));   // metres per plan pixel
        var M = u / mpp;                                          // world units per metre (plan)
        var Mh = WALL_H / 2.9;                                    // vertical: a 2.9 m ceiling maps to the dollhouse wall
        meta.furn.forEach(function(f){
          var kind = f[8]; if (!kind || kind === 'skip') return;
          var x0 = f[0], y0 = f[1], x1 = f[2], y1 = f[3];
          var w = (x1 - x0) * u, d = (y1 - y0) * u;
          var cx = (x0 + x1) / 2 * u - WORLD_W / 2, cz = (y0 + y1) / 2 * u - planD / 2;
          var side = wallSide(walls, x0, y0, x1, y1);
          var tint = new THREE.Color().setStyle('rgb(' + f[4] + ',' + f[5] + ',' + f[6] + ')');
          if (kind === 'sofa' || kind === 'counter'){
            // a large detected area: put the piece along the wall, leave the rest as floor/rug
            var sd = kind === 'sofa' ? Math.min(0.95 * M, d, w) : Math.min(0.65 * M, d, w);
            var horiz = (side === 'e' || side === 'w');
            var sw = horiz ? d : w, sx = cx, sz = cz;
            if (side === 'n') sz = cz - d / 2 + sd / 2; else if (side === 's') sz = cz + d / 2 - sd / 2;
            else if (side === 'w') sx = cx - w / 2 + sd / 2; else if (side === 'e') sx = cx + w / 2 - sd / 2;
            else sz = cz - d / 2 + sd / 2;
            if (kind === 'sofa'){
              model.add(place(mkRug(w, d, M, Mh), cx, cz, null));
              model.add(place(mkSofa(sw, sd, M, Mh, tint), sx, sz, side));
            } else {
              model.add(place(mkCounter(sw, sd, M, Mh), sx, sz, side));
            }
            return;
          }
          var horiz2 = (side === 'e' || side === 'w');
          var lw = horiz2 ? d : w, ld = horiz2 ? w : d, g;
          if (kind === 'bed') g = mkBed(lw, ld, M, Mh);
          else if (kind === 'wardrobe') g = mkWardrobe(lw, Math.max(ld, 0.55 * M), M, Mh);
          else if (kind === 'cab') g = mkCounter(lw, Math.max(ld, 0.5 * M), M, Mh);
          else if (kind === 'tub') g = mkBath(lw, ld, M, Mh);
          else g = mkFixture(lw, ld, M, Mh);
          model.add(place(g, cx, cz, side));
        });
      }
      self.group.add(model); self.model = model;
      // fit distance to plan size
      self.dist = Math.max(22, Math.min(40, 1.35 * Math.max(WORLD_W, planD * self.camera.aspect * 1.1)));
      // intro: flat plan rising into 3D
      self.pitch = 1.5; self.targetPitch = 0.9; self.yaw = self.targetYaw - 0.6; self.idleT = 0;
      if (cb) cb();
    }).catch(function(e){ console.error('plan3d load failed', e); if (cb) cb(e); });
  };
  window.PlanViewer = Viewer;
})();
