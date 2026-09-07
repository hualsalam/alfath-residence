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

      // Furniture: each detected blob becomes a volume whose top face carries that patch of the
      // plan artwork, so beds/sofas/counters read as objects with height rather than flat drawing.
      if (meta && meta.furn && meta.furn.length){
        var fw = imgs[1].width, fh = imgs[1].height, footArea = fw * fh;
        var topMat = new THREE.MeshStandardMaterial({map: tex, roughness: 0.72});
        meta.furn.forEach(function(f){
          var x0 = f[0], y0 = f[1], x1 = f[2], y1 = f[3];
          var bw = (x1 - x0) * u, bd = (y1 - y0) * u, minSide = Math.min(x1 - x0, y1 - y0);
          var h = minSide <= 8 ? 0.12 : (f[7] / footArea > 0.03 ? 0.40 : 0.52);
          var geo = new THREE.BoxGeometry(bw, h, bd);
          var uv = geo.attributes.uv;
          var tu0 = x0 / fw, tu1 = x1 / fw, tv0 = 1 - y1 / fh, tv1 = 1 - y0 / fh;
          uv.setXY(8, tu0, tv1); uv.setXY(9, tu1, tv1); uv.setXY(10, tu0, tv0); uv.setXY(11, tu1, tv0);
          uv.needsUpdate = true;
          var side = new THREE.MeshStandardMaterial({roughness: 0.88});
          side.color.setStyle('rgb(' + f[4] + ',' + f[5] + ',' + f[6] + ')');
          var mesh = new THREE.Mesh(geo, [side, side, topMat, side, side, side]);
          mesh.position.set((x0 + (x1 - x0) / 2) * u - WORLD_W / 2, SLAB_H + h / 2, (y0 + (y1 - y0) / 2) * u - planD / 2);
          mesh.castShadow = true; mesh.receiveShadow = true;
          model.add(mesh);
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
