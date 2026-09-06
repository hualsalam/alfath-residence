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
    this.model.traverse(function(o){ if (o.geometry) o.geometry.dispose(); if (o.material){ if (o.material.map) o.material.map.dispose(); if (o.material.alphaMap) o.material.alphaMap.dispose(); o.material.dispose(); } });
    this.model = null;
  };
  Viewer.prototype.load = function(base, cb){
    var self = this, token = (this.token = (this.token || 0) + 1);
    Promise.all([loadImg(base + '-walls.png'), loadImg(base + '-foot.png'), loadImg(base + '-tex.jpg')]).then(function(imgs){
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
      // textured floor (plan drawing) clipped to the footprint
      var tex = new THREE.Texture(imgs[2]); tex.needsUpdate = true; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      var alpha = new THREE.Texture(imgs[1]); alpha.needsUpdate = true;
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(imgs[2].width / imgs[0].width * WORLD_W, imgs[2].height / imgs[0].width * WORLD_W),
        new THREE.MeshStandardMaterial({map: tex, alphaMap: alpha, transparent: true, alphaTest: 0.5, roughness: 0.9}));
      floor.rotation.x = -Math.PI / 2; floor.position.y = SLAB_H + 0.012; floor.receiveShadow = true;
      // the texture/alpha images share the same crop as the masks, so center them on the same origin
      floor.position.x = (imgs[2].width / 2 * (WORLD_W / imgs[0].width)) - WORLD_W / 2 + (W * u - WORLD_W) / 2;
      floor.position.z = (imgs[2].height / 2 * (WORLD_W / imgs[0].width)) - planD / 2 + (H * u - planD) / 2;
      // correct for the mask grid flooring (mask is PX_PER_CELL-aligned, texture is not)
      floor.position.x = floor.position.x - ((imgs[0].width - W * PX_PER_CELL) / 2) * (WORLD_W / imgs[0].width);
      floor.position.z = floor.position.z - ((imgs[0].height - H * PX_PER_CELL) / 2) * (WORLD_W / imgs[0].width);
      model.add(floor);
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
