/* =========================================================================
   MICROVIDA 3D — Modelos 3D procedurais (three.js)
   Todos os modelos são construídos por código, sem arquivos externos.
   Cada modelo devolve: raiz (Group), partes {id: [meshes]}, ancoras {id: Vector3}
   e, opcionalmente, atualizar(dt, t).
   ========================================================================= */
(function () {
  const T = THREE;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  if (T.ColorManagement) T.ColorManagement.legacyMode = false; // cores hexadecimais tratadas como sRGB

  /* ---------- utilitários ---------- */
  function mat(cor, o) {
    o = o || {};
    const m = new T.MeshStandardMaterial({
      color: cor, roughness: o.rough ?? 0.55, metalness: o.metal ?? 0.05,
      transparent: (o.op ?? 1) < 1, opacity: o.op ?? 1, side: o.side || T.FrontSide,
      emissive: o.emis || 0x000000, emissiveIntensity: o.ei ?? 1, flatShading: !!o.flat,
      depthWrite: o.dw ?? ((o.op ?? 1) >= 0.6)
    });
    m.userData.baseOp = o.op ?? 1;
    return m;
  }
  function malha(geo, m, pos, rot, esc) {
    const me = new T.Mesh(geo, m);
    if (pos) me.position.copy(pos);
    if (rot) me.rotation.set(rot[0], rot[1], rot[2]);
    if (esc) { if (typeof esc === "number") me.scale.setScalar(esc); else me.scale.set(esc[0], esc[1], esc[2]); }
    return me;
  }
  // gerador pseudoaleatório com semente (modelos iguais a cada carregamento)
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  // pontos bem distribuídos sobre uma esfera
  function fibonacci(n) {
    const pts = [], g = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i; pts.push(V(Math.cos(th) * r, y, Math.sin(th) * r)); }
    return pts;
  }
  function orientar(obj, normal) { obj.quaternion.setFromUnitVectors(V(0, 1, 0), normal.clone().normalize()); }
  function ruido(p, k) { return Math.sin(p.x * k + 1.3) * Math.sin(p.y * k * 1.1 + 0.7) * Math.sin(p.z * k * 0.9 + 2.1); }
  function deformar(geo, amp, k) {
    const pos = geo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const n = v.clone().normalize(); v.addScaledVector(n, ruido(v, k) * amp); pos.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals(); return geo;
  }
  function tubo(pontos, raio, m, fechado, seg) {
    const c = new T.CatmullRomCurve3(pontos, !!fechado);
    return new T.Mesh(new T.TubeGeometry(c, seg || pontos.length * 8, raio, 8, !!fechado), m);
  }
  // fio enovelado (material genético) dentro de uma esfera de raio r
  function novelo(r, n, seed, raio, m, fechado) {
    const R = rng(seed), pts = []; let p = V(0, 0, 0);
    for (let i = 0; i < n; i++) {
      p = p.clone().add(V(R() - .5, R() - .5, R() - .5).multiplyScalar(r * 0.9));
      if (p.length() > r) p.setLength(r * (0.55 + R() * 0.3));
      pts.push(p);
    }
    return tubo(pts, raio, m, fechado, n * 10);
  }
  function hélice(raio, passo, voltas, raioTubo, m, eixo) {
    const pts = [];
    for (let i = 0; i <= voltas * 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(V(Math.cos(a) * raio, i / 24 * passo, Math.sin(a) * raio)); }
    const me = tubo(pts, raioTubo, m, false, voltas * 40);
    return me;
  }
  function vírusMini(r, cor) { // vírus pequeno com espículas (usado em vários modelos e simulações)
    const g = new T.Group();
    const corpo = malha(new T.IcosahedronGeometry(r, 2), mat(cor, { rough: .4 }));
    g.add(corpo);
    const me = mat(0xfb923c, { rough: .4 });
    const geoE = new T.CylinderGeometry(r * .08, r * .08, r * .45, 5), geoC = new T.SphereGeometry(r * .16, 8, 6);
    fibonacci(18).forEach(n => { const h = malha(geoE, me); h.position.copy(n.clone().multiplyScalar(r * 1.15)); orientar(h, n); g.add(h);
      const c = malha(geoC, me); c.position.copy(n.clone().multiplyScalar(r * 1.42)); g.add(c); });
    return g;
  }
  function anticorpoGeo(esc, m) { // forma em Y
    const g = new T.Group();
    const cap = (r, l) => new T.CapsuleGeometry(r, l, 4, 10);
    const tronco = malha(cap(.32 * esc, 2 * esc), m); tronco.position.y = -1.3 * esc; g.add(tronco);
    [-1, 1].forEach(s => {
      const b = malha(cap(.3 * esc, 2 * esc), m); b.position.set(s * .95 * esc, 0.75 * esc, 0); b.rotation.z = -s * 0.75; g.add(b);
      const l = malha(cap(.2 * esc, 1.4 * esc), m); l.position.set(s * 1.55 * esc, 0.45 * esc, .25 * esc); l.rotation.z = -s * 0.75; g.add(l);
    });
    return g;
  }
  function celulaBola(r, cor, corNuc, nucR, nucPos, op) {
    const g = new T.Group();
    const geo = deformar(new T.IcosahedronGeometry(r, 4), r * .04, 1.6 / r);
    g.add(malha(geo, mat(cor, { op: op ?? .55, rough: .35, side: T.DoubleSide })));
    const n = malha(deformar(new T.IcosahedronGeometry(nucR, 3), nucR * .05, 2 / nucR), mat(corNuc, { rough: .6 }));
    if (nucPos) n.position.copy(nucPos); g.add(n);
    return g;
  }

  /* ---------- registro das partes ---------- */
  function novoModelo() {
    const raiz = new T.Group(), partes = {}, ancoras = {};
    function parte(id, obj, ancora) {
      raiz.add(obj);
      obj.traverse(o => { if (o.isMesh) { o.userData.parte = id; (partes[id] = partes[id] || []).push(o); } });
      if (ancora) ancoras[id] = ancora;
      return obj;
    }
    return { raiz, partes, ancoras, parte };
  }

  const M = {};

  /* =================== VÍRUS ENVELOPADO =================== */
  M.virus = {
    vistas: [["Frente", [0, 2, 25], [0, 0, 0]], ["Perto", [6, 5, 10], [0, 1, 0]], ["Por dentro", [0, 0, 15], [0, 0, 0], { corte: true }]],
    construir() {
      const m = novoModelo();
      const env = deformar(new T.SphereGeometry(5, 72, 54), .12, 2.2);
      m.parte("envelope", malha(env, mat(0xfacc15, { op: .45, rough: .3, side: T.DoubleSide })), V(-3.4, 3.4, 1.4));
      const g = new T.Group(), me = mat(0xfb923c, { rough: .45 });
      const geoH = new T.CylinderGeometry(.13, .2, 1.3, 7), geoC = new T.SphereGeometry(.42, 12, 10);
      fibonacci(70).forEach(n => {
        const h = malha(geoH, me); h.position.copy(n.clone().multiplyScalar(5.6)); orientar(h, n); g.add(h);
        const c = malha(geoC, me, n.clone().multiplyScalar(6.35), null, [1, .8, 1]); orientar(c, n); g.add(c);
      });
      m.parte("espiculas", g, V(0, 6.8, 0.4));
      const cap = new T.Group(), mc = mat(0xa78bfa, { rough: .5, flat: true });
      cap.add(malha(new T.IcosahedronGeometry(3.3, 0), mat(0x8b5cf6, { op: .55, flat: true, side: T.DoubleSide })));
      const ico = new T.IcosahedronGeometry(3.35, 1), pa = ico.attributes.position, vist = {};
      for (let i = 0; i < pa.count; i++) { const p = V(pa.getX(i), pa.getY(i), pa.getZ(i)); const k = p.toArray().map(x => x.toFixed(2)).join(); if (vist[k]) continue; vist[k] = 1; cap.add(malha(new T.IcosahedronGeometry(.38, 1), mc, p)); }
      m.parte("capsideo", cap, V(2.4, 2.3, 1.5));
      m.parte("rna_viral", novelo(2.3, 40, 7, .13, mat(0xf472b6, { emis: 0xbe185d, ei: .6 })), V(0, -.5, 0));
      return Object.assign(m, { atualizar(dt, t) { cap.rotation.y = t * .15; } });
    }
  };

  /* =================== BACTERIÓFAGO =================== */
  M.fago = {
    vistas: [["Frente", [0, 6, 22], [0, 5, 0]], ["Cabeça", [4, 10, 9], [0, 8.5, 0]], ["Base", [6, 1, 9], [0, 1, 0]]],
    construir() {
      const m = novoModelo();
      const cab = malha(new T.IcosahedronGeometry(2.6, 0), mat(0xa78bfa, { op: .5, flat: true, side: T.DoubleSide, rough: .3 }), V(0, 9, 0), null, [1, 1.3, 1]);
      const cabG = new T.Group(); cabG.add(cab);
      const ed = new T.LineSegments(new T.EdgesGeometry(cab.geometry), new T.LineBasicMaterial({ color: 0xddd6fe })); ed.position.copy(cab.position); ed.scale.copy(cab.scale); cabG.add(ed);
      m.parte("capsideo_fago", cabG, V(2.2, 11, 1));
      const dna = novelo(1.6, 34, 3, .11, mat(0xf472b6, { emis: 0xbe185d, ei: .5 })); dna.position.set(0, 9, 0); dna.scale.set(1, 1.25, 1);
      m.parte("dna_fago", dna, V(0, 9, 0));
      const cau = new T.Group(), mcau = mat(0x38bdf8, { rough: .4 });
      cau.add(malha(new T.CylinderGeometry(.5, .5, 5, 16), mcau, V(0, 4.3, 0)));
      for (let i = 0; i < 12; i++) cau.add(malha(new T.TorusGeometry(.62, .14, 8, 20), mcau, V(0, 2.1 + i * .4, 0), [Math.PI / 2, 0, 0]));
      cau.add(malha(new T.CylinderGeometry(1.1, 1.1, .35, 6), mcau, V(0, 6.9, 0)));
      m.parte("cauda", cau, V(1.4, 4.5, 0));
      m.parte("placa_basal", malha(new T.CylinderGeometry(1.5, 1.5, .5, 6), mat(0x34d399, { flat: true }), V(0, 1.6, 0)), V(-1.6, 1.4, .8));
      const fib = new T.Group(), mf = mat(0xfbbf24, { rough: .5 });
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        fib.add(tubo([V(c * 1.4, 1.6, s * 1.4), V(c * 3.3, 2.6, s * 3.3), V(c * 4.6, 0.3, s * 4.6), V(c * 5, -1.4, s * 5)], .13, mf));
      }
      m.parte("fibras_cauda", fib, V(4.4, .4, 2.5));
      // superfície da bactéria (não clicável)
      const sup = malha(new T.CylinderGeometry(30, 30, 1, 64, 1, false, 0, Math.PI * 2), mat(0x1e3a8a, { op: .35 }), V(0, -2.1, 0));
      sup.userData.semCaixa = true; m.raiz.add(sup);
      return Object.assign(m, { atualizar(dt, t) { fib.rotation.y = Math.sin(t * .6) * .05; } });
    }
  };

  /* =================== BACTÉRIA (BACILO) =================== */
  M.bacteria = {
    vistas: [["Frente", [0, 6, 36], [3, 0, 0]], ["Por dentro", [0, 3, 20], [0, 0, 0], { corte: true }], ["Flagelo", [14, 3, 12], [12, 0, 0]]],
    construir() {
      const m = novoModelo();
      const cap = (r) => { const g = new T.CapsuleGeometry(r, 10, 12, 40); g.rotateZ(Math.PI / 2); return g; };
      m.parte("capsula", malha(cap(3.7), mat(0x93c5fd, { op: .14, side: T.DoubleSide, rough: .2 })), V(-6, 3.6, 1.2));
      m.parte("parede_celular", malha(cap(3.15), mat(0x3b82f6, { op: .42, side: T.DoubleSide })), V(-2, 3.05, 0));
      m.parte("membrana_plasmatica", malha(cap(2.9), mat(0x22d3ee, { op: .3, side: T.DoubleSide })), V(3, -2.6, 1.1));
      m.parte("citoplasma", malha(cap(2.75), mat(0x5eead4, { op: .12, side: T.DoubleSide, dw: false })), V(-4.5, -1.2, 1.6));
      // ribossomos
      const R = rng(11), geoR = new T.SphereGeometry(.13, 8, 6), nR = 260;
      const rib = new T.InstancedMesh(geoR, mat(0xfde68a, { rough: .6 }), nR), d = new T.Object3D();
      for (let i = 0; i < nR; i++) { let p; do { p = V((R() - .5) * 14, (R() - .5) * 5, (R() - .5) * 5); } while (Math.hypot(p.y, p.z) > 2.5 || Math.abs(p.x) > 6.5); d.position.copy(p); d.updateMatrix(); rib.setMatrixAt(i, d.matrix); }
      m.parte("ribossomos", rib, V(4.2, 1.6, 1.3));
      const nuc = novelo(1.7, 60, 5, .1, mat(0xf472b6, { emis: 0x9d174d, ei: .5 }), true); nuc.scale.set(2.2, 1, 1);
      m.parte("nucleoide", nuc, V(-.6, .3, 0));
      const pl = new T.Group(), mp = mat(0xe879f9, { emis: 0x86198f, ei: .4 });
      pl.add(malha(new T.TorusGeometry(.55, .08, 8, 30), mp, V(4.3, -1, .8), [1, .4, 0]));
      pl.add(malha(new T.TorusGeometry(.45, .08, 8, 30), mp, V(-4.6, 1.1, -.6), [.3, 1.2, 0]));
      m.parte("plasmideo", pl, V(4.3, -1, .8));
      // flagelo: gancho na ponta da bactéria + filamento helicoidal que gira em torno do próprio eixo (como um saca-rolhas)
      const flG = new T.Group(), giro = new T.Group(), mfl = mat(0xc4b5fd, { rough: .4 });
      flG.position.set(7.75, 0, 0); flG.rotation.z = -Math.PI / 2; // eixo local +y aponta para +x (para fora da bactéria)
      flG.add(malha(new T.CylinderGeometry(.16, .2, .45, 12), mat(0x8b5cf6), V(0, .1, 0))); // motor/gancho
      const ptsF = [];
      for (let i = 0; i <= 7 * 32; i++) { const a = i / 32 * Math.PI * 2, y = .3 + i / 32 * 1.55, r = .6 * Math.min(1, i / 40); ptsF.push(V(Math.cos(a) * r, y, Math.sin(a) * r)); }
      const fl = tubo(ptsF, .1, mfl, false, 7 * 48); giro.add(fl); flG.add(giro);
      m.parte("flagelo", flG, V(15, .7, 0));
      const nF = 150, fim = new T.InstancedMesh(new T.CylinderGeometry(.04, .04, 1.1, 4), mat(0xa3e635), nF);
      for (let i = 0; i < nF; i++) {
        let base, nn;
        if (R() < .72) { const x = (R() - .5) * 10, a = R() * Math.PI * 2; nn = V(0, Math.cos(a), Math.sin(a)); base = V(x, 0, 0); }
        else { const sg = R() < .5 ? -1 : 1; nn = V(sg * R(), R() - .5, R() - .5).normalize(); if (nn.x * sg < .15) nn.x = sg * .3; nn.normalize(); base = V(sg * 5, 0, 0); }
        d.position.copy(base).add(nn.clone().multiplyScalar(3.7)); orientar(d, nn); d.updateMatrix(); fim.setMatrixAt(i, d.matrix);
      }
      m.parte("fimbrias", fim, V(0, -4.1, 1.5));
      return Object.assign(m, { atualizar(dt, t) { giro.rotation.y -= dt * 7; } });
    }
  };

  /* =================== FORMAS DAS BACTÉRIAS =================== */
  M.formas = {
    vistas: [["Lâmina", [0, 14, 20], [0, 0, 0]], ["De cima", [0, 26, .1], [0, 0, 0]], ["Cocos", [-8, 6, 10], [-7, 0, -3]], ["Bacilos e espirais", [8, 6, 12], [6, 0, 3]]],
    construir() {
      const m = novoModelo(), R = rng(21);
      const esf = (r) => new T.SphereGeometry(r, 20, 16);
      // lâmina de vidro
      { const lam = malha(new T.BoxGeometry(32, .4, 18), mat(0xbfdbfe, { op: .22, rough: .1 }), V(0, -1.4, 0)); lam.userData.semCaixa = true; m.raiz.add(lam); }
      const add = (id, g, pos, anc) => { g.position.copy(pos); m.parte(id, g, anc || pos.clone().add(V(0, 2, 0))); };
      let g = new T.Group(); g.add(malha(esf(1), mat(0x60a5fa))); add("cocos", g, V(-12, 0, -4));
      g = new T.Group(); [-0.9, .9].forEach(x => g.add(malha(esf(.95), mat(0x22d3ee), V(x, 0, 0), null, [1, 1, 1]))); add("diplococos", g, V(-7, 0, -4));
      g = new T.Group(); for (let i = 0; i < 8; i++) g.add(malha(esf(.75), mat(0x818cf8), V(i * 1.45 - 5, 0, Math.sin(i * .7) * 1.2))); add("estreptococos", g, V(1, 0, -4.5), V(1, 2, -4));
      g = new T.Group(); for (let i = 0; i < 18; i++) { const p = V(R() - .5, R() - .5, R() - .5).normalize().multiplyScalar(R() * 1.6); g.add(malha(esf(.75), mat(0xf59e0b), p)); } add("estafilococos", g, V(10, .4, -4));
      g = new T.Group(); [[0, 0, 0, .3], [2.6, 0, 1.4, -.5], [-.6, 0, 2.6, 1.2]].forEach(([x, y, z, r]) => { const c = new T.CapsuleGeometry(.6, 2.2, 6, 14); c.rotateZ(Math.PI / 2); g.add(malha(c, mat(0xc084fc), V(x, y, z), [0, r, 0])); });
      add("bacilos", g, V(-10, 0, 3.5));
      g = new T.Group(); const vib = []; for (let i = 0; i <= 10; i++) { const a = -0.9 + i / 10 * 1.8; vib.push(V(Math.sin(a) * 2, 0, Math.cos(a) * 2 - 2)); }
      g.add(tubo(vib, .55, mat(0xf472b6))); g.add(malha(esf(.55), mat(0xf472b6), vib[0])); g.add(malha(esf(.55), mat(0xf472b6), vib[vib.length - 1]));
      { const fv = hélice(.15, .5, 6, .05, mat(0xfbcfe8)); fv.rotation.z = Math.PI / 2; fv.position.set(-2, 0, -.76); g.add(fv); } add("vibriao", g, V(-1.5, 0, 4.5));
      g = new T.Group(); const sp = hélice(.8, 1.1, 6, .32, mat(0x34d399)); sp.rotation.z = -Math.PI / 2; sp.position.x = -3.3; g.add(sp); add("espirilo", g, V(7, 0, 4.5));
      return m;
    }
  };

  /* =================== ESCALA MICROSCÓPICA (1 unidade = 1 µm) =================== */
  M.escala = {
    near: 0.005,
    vistas: [["Célula humana", [0, 8, 46], [8, 0, 0]], ["Hemácia", [21, 3, 10], [20, 0, 0]], ["Bactéria", [28, 1, 3.5], [28, 0, 0]], ["Vírus", [31.05, .08, .4], [31, 0, 0]]],
    escala: "Escala real: 1 unidade = 1 micrômetro (µm). O vírus mede 0,1 µm = 100 nm.",
    construir() {
      const m = novoModelo(), R = rng(31);
      const cel = new T.Group();
      cel.add(malha(deformar(new T.IcosahedronGeometry(12, 5), .5, .25), mat(0xfda4af, { op: .3, side: T.DoubleSide, rough: .3 })));
      for (let i = 0; i < 40; i++) { const p = V(R() - .5, R() - .5, R() - .5).normalize().multiplyScalar(5 + R() * 5.5); cel.add(malha(new T.CapsuleGeometry(.45, 1.4, 4, 8), mat(0xfb923c), p, [R() * 3, R() * 3, 0])); }
      m.parte("celula_humana", cel, V(-6, 10.5, 2));
      m.parte("nucleo_celular", malha(deformar(new T.IcosahedronGeometry(4, 3), .15, .6), mat(0xbe185d, { rough: .6 })), V(0, 4.4, 0));
      const perfil = []; for (let i = 0; i <= 20; i++) { const r = i / 20 * 3.75; const h = .5 * (0.4 + 2.4 * Math.pow(r / 3.75, 2) - 1.9 * Math.pow(r / 3.75, 4)) * Math.sqrt(Math.max(0, 1 - Math.pow(r / 3.75, 2))) + .02; perfil.push(new T.Vector2(r, h)); }
      for (let i = 20; i >= 0; i--) perfil.push(new T.Vector2(perfil[i].x, -perfil[i].y));
      const hem = malha(new T.LatheGeometry(perfil, 48), mat(0xef4444, { rough: .45, side: T.DoubleSide }), V(20, 0, 0), [.55, 0, .2]);
      m.parte("hemacia", hem, V(20, 2.2, 0));
      const bc = new T.CapsuleGeometry(.4, 1.4, 8, 16); bc.rotateZ(Math.PI / 2);
      m.parte("bacteria_escala", malha(bc, mat(0x60a5fa)), V(28, .65, 0));
      const vir = vírusMini(.05, 0xfacc15); vir.position.set(31, 0, 0);
      m.parte("virus_escala", vir, V(31, .1, 0));
      return m;
    }
  };

  /* =================== CÉLULAS DE DEFESA =================== */
  M.defesa = {
    vistas: [["Todas", [0, 7, 34], [0, 0, 0]], ["Anticorpo", [0, 1, 11], [0, 0, 0]], ["Inata", [-10, 3, 14], [-10, 0, -2]], ["Adaptativa", [9, 3, 14], [9, 0, -2]]],
    construir() {
      const m = novoModelo(), R = rng(41);
      // anticorpo (centro)
      const ab = anticorpoGeo(1.4, mat(0x4ade80, { rough: .35 }));
      m.parte("anticorpo", ab, V(0, 3.6, 0));
      // antígenos (vírus) presos ao anticorpo
      const ag = new T.Group(); [-1, 1].forEach(s => { const v = vírusMini(.7, 0xfb7185); v.position.set(s * 3.1, 2.9, 0); ag.add(v); });
      const v3 = vírusMini(.6, 0xfb7185); v3.position.set(4.5, -2, 2); ag.add(v3);
      m.parte("antigeno", ag, V(3.1, 4.4, 0));
      // macrófago
      const mac = new T.Group();
      mac.add(malha(deformar(new T.IcosahedronGeometry(3.4, 4), .9, .7), mat(0xf59e0b, { op: .6, rough: .4, side: T.DoubleSide })));
      for (let i = 0; i < 7; i++) { const n = V(R() - .5, R() - .5, R() - .5).normalize(); const c = malha(new T.ConeGeometry(.6, 2.6, 8), mat(0xf59e0b, { op: .75 })); c.position.copy(n.clone().multiplyScalar(3.6)); orientar(c, n); mac.add(c); }
      mac.add(malha(new T.SphereGeometry(1.1, 16, 12), mat(0x92400e), V(.8, .3, 0), null, [1, .8, .8]));
      for (let i = 0; i < 3; i++) { const b = new T.CapsuleGeometry(.25, .8, 4, 8); mac.add(malha(b, mat(0x60a5fa), V(-1 + i * .7, -1, .6), [0, 0, i])); }
      mac.position.set(-13, 0, -2); m.parte("macrofago", mac, V(-13, 4.6, -2));
      // neutrófilo
      const neu = new T.Group();
      neu.add(malha(new T.SphereGeometry(2.2, 32, 24), mat(0xfcd34d, { op: .45, side: T.DoubleSide })));
      [[-.8, .3, 0], [0, -.4, .2], [.8, .3, 0], [.2, .9, -.2]].forEach(p => neu.add(malha(new T.SphereGeometry(.6, 16, 12), mat(0x7c3aed), V(...p))));
      neu.position.set(-7, -1, 4); m.parte("neutrofilo", neu, V(-7, 1.6, 4));
      // linfócito B (com receptores Y)
      const lb = celulaBola(1.8, 0x38bdf8, 0x1e3a8a, 1.35, V(0, 0, 0), .5);
      fibonacci(26).forEach(n => { const y = anticorpoGeo(.12, mat(0x4ade80)); y.position.copy(n.clone().multiplyScalar(2)); orientar(y, n); lb.add(y); });
      lb.position.set(8, -2, 4); m.parte("linfocito_b", lb, V(8, .5, 4));
      // plasmócito liberando anticorpos
      const pc = celulaBola(2.2, 0x818cf8, 0x312e81, .9, V(1, .4, 0), .5); pc.scale.set(1.3, 1, 1);
      for (let i = 0; i < 6; i++) pc.add(malha(new T.TorusGeometry(.9 + i * .18, .05, 6, 30, Math.PI), mat(0xc7d2fe), V(-.5, -.2, 0), [0, 0, Math.PI * .6]));
      pc.position.set(13, 1.5, -3); m.parte("plasmocito", pc, V(13, 4.4, -3));
      const livres = new T.Group(); for (let i = 0; i < 8; i++) { const y = anticorpoGeo(.25, mat(0x4ade80)); y.position.set(15.5 + R() * 4, -1 + R() * 5, -3 + R() * 3); y.rotation.set(R() * 3, R() * 3, R() * 3); livres.add(y); }
      m.parte("anticorpo", livres);
      // linfócito T (com microvilosidades)
      const lt = celulaBola(1.8, 0xf472b6, 0x831843, 1.3, null, .55);
      fibonacci(60).forEach(n => { const c = malha(new T.CylinderGeometry(.05, .08, .5, 4), mat(0xf9a8d4)); c.position.copy(n.clone().multiplyScalar(2)); orientar(c, n); lt.add(c); });
      lt.position.set(-1, -4, 5); m.parte("linfocito_t", lt, V(-1, -1.6, 5));
      const grupos = { ab, livres, mac };
      return Object.assign(m, { atualizar(dt, t) { ab.rotation.y = Math.sin(t * .4) * .3; livres.children.forEach((y, i) => { y.rotation.x += dt * .3; y.position.y += Math.sin(t + i) * dt * .2; }); mac.rotation.y += dt * .1; } });
    }
  };

  /* =================== CORPO E ÓRGÃOS LINFOIDES =================== */
  M.corpo = {
    vistas: [["Frente", [0, 9, 32], [0, 9, 0]], ["Lado", [30, 10, 6], [0, 9, 0]], ["Tórax", [0, 13, 13], [0, 12.5, 0]], ["Pescoço", [2, 15.5, 7], [0, 15.4, 0]], ["Abdome", [0, 9.5, 12], [0, 9.6, 0]]],
    construir() {
      const m = novoModelo();
      const pele = new T.Group(), mp = mat(0xfcd9b8, { op: .22, side: T.DoubleSide, rough: .5, dw: false });
      const caps = (r, l, p, rz, sx) => { const c = malha(new T.CapsuleGeometry(r, l, 10, 24), mp, p, [0, 0, rz || 0]); if (sx) c.scale.set(sx[0], sx[1], sx[2]); pele.add(c); };
      pele.add(malha(new T.SphereGeometry(1.35, 32, 24), mp, V(0, 16.6, 0), null, [.9, 1.1, 1]));
      caps(.55, .8, V(0, 15, 0));
      caps(2.1, 3.6, V(0, 11.6, 0), 0, [1.15, 1, .62]);
      caps(1.8, 1.2, V(0, 8.2, 0), 0, [1.15, 1, .62]);
      [-1, 1].forEach(s => { caps(.5, 3.2, V(s * 3.1, 11.3, 0), s * .12); caps(.42, 3, V(s * 3.65, 7.5, .3), s * .05);
        caps(.85, 3.8, V(s * 1.1, 4.4, 0)); caps(.62, 3.6, V(s * 1.15, 1.1, 0)); });
      m.parte("pele", pele, V(-2.6, 13.8, .9));
      // medula óssea (ossos longos)
      const med = new T.Group(), mm = mat(0xdc2626, { emis: 0x7f1d1d, ei: .5 });
      [-1, 1].forEach(s => { med.add(malha(new T.CylinderGeometry(.22, .22, 3.6, 10), mm, V(s * 1.1, 4.4, 0)));
        med.add(malha(new T.CylinderGeometry(.18, .18, 3.2, 10), mm, V(s * 1.15, 1.1, 0)));
        med.add(malha(new T.CylinderGeometry(.18, .18, 3, 10), mm, V(s * 3.1, 11.3, 0), [0, 0, s * .12])); });
      med.add(malha(new T.TorusGeometry(1.3, .28, 8, 24, Math.PI), mm, V(0, 7.2, 0), [0, 0, Math.PI]));
      med.add(malha(new T.BoxGeometry(.4, 2.2, .2), mm, V(0, 11.3, .8)));
      m.parte("medula_ossea", med, V(1.6, 4.6, 0));
      const timo = new T.Group(), mt = mat(0xf472b6);
      [-.35, .35].forEach(x => timo.add(malha(new T.SphereGeometry(.45, 16, 12), mt, V(x, 13.2, .55), null, [.8, 1.4, .5])));
      m.parte("timo", timo, V(0, 13.9, .7));
      m.parte("baco", malha(new T.SphereGeometry(.7, 20, 14), mat(0xa855f7), V(1.4, 10.1, -.2), null, [.7, 1.2, .55]), V(1.6, 10.9, -.2));
      const ton = new T.Group(); [-.32, .32].forEach(x => ton.add(malha(new T.SphereGeometry(.18, 12, 8), mat(0xfb7185), V(x, 15.75, .4))));
      m.parte("tonsilas", ton, V(0, 16, .45));
      // linfonodos e vasos
      const posL = [];
      [-1, 1].forEach(s => {
        [[.6, 15.2, .3], [.75, 14.7, .2], [.5, 14.4, .4]].forEach(p => posL.push(V(s * p[0], p[1], p[2])));
        [[2.3, 13.3, .2], [2.5, 12.9, -.1], [2.2, 12.6, .3]].forEach(p => posL.push(V(s * p[0], p[1], p[2])));
        [[1.2, 7.3, .6], [1.5, 7.0, .5], [1.0, 6.8, .7]].forEach(p => posL.push(V(s * p[0], p[1], p[2])));
        [[3.4, 9.6, .2]].forEach(p => posL.push(V(s * p[0], p[1], p[2])));
      });
      [[0, 9.2, .3], [.4, 8.8, .2], [-.4, 8.9, .1]].forEach(p => posL.push(V(...p)));
      const lin = new T.Group(), ml = mat(0x4ade80, { emis: 0x14532d, ei: .5 });
      posL.forEach(p => lin.add(malha(new T.SphereGeometry(.17, 12, 8), ml, p, null, [1, 1.4, 1])));
      m.parte("linfonodos", lin, V(-2.4, 13.2, .3));
      const vas = new T.Group(), mv = mat(0x86efac, { op: .8 });
      [-1, 1].forEach(s => {
        vas.add(tubo([V(s * 1.2, -.5, .3), V(s * 1.1, 2.5, .4), V(s * 1.15, 5.2, .5), V(s * 1.2, 7, .6), V(s * .4, 9, .4), V(0, 11.5, .2), V(s * .1, 13.2, .1)], .05, mv));
        vas.add(tubo([V(s * 3.8, 6.2, .3), V(s * 3.5, 9.6, .2), V(s * 2.4, 12.8, .1), V(s * .6, 13.5, .1)], .05, mv));
        vas.add(tubo([V(s * .6, 14.5, .4), V(s * .4, 13.8, .3)], .05, mv));
      });
      m.parte("vasos_linfaticos", vas, V(-1.15, 3.2, .4));
      return m;
    }
  };

  /* =================== AEDES AEGYPTI =================== */
  M.mosquito = {
    vistas: [["Lado", [0, 3, 26], [-.5, 1, 0]], ["De cima", [0, 20, 3], [0, 0, 0]], ["Cabeça", [-7, 3, 7], [-5, 1.5, 0]]],
    construir() {
      const m = novoModelo();
      const preto = mat(0x1f2937, { rough: .5 }), branco = mat(0xf8fafc, { rough: .5 });
      // cabeça (não clicável) com olhos
      m.raiz.add(malha(new T.SphereGeometry(.9, 20, 16), preto, V(-5, 1.6, 0)));
      [-1, 1].forEach(s => m.raiz.add(malha(new T.SphereGeometry(.55, 16, 12), mat(0x7f1d1d, { rough: .3 }), V(-5.4, 1.9, s * .55))));
      m.parte("probocide", malha(new T.CylinderGeometry(.1, .05, 4.2, 6), mat(0x94a3b8), V(-7.3, .05, 0), [0, 0, -.93]), V(-8.6, -.8, 0));
      const ant = new T.Group(), ma = mat(0xcbd5e1);
      [-1, 1].forEach(s => { ant.add(tubo([V(-5.6, 2.2, s * .3), V(-6.6, 3.4, s * .7), V(-7.3, 4.6, s * .9)], .05, ma));
        for (let i = 0; i < 8; i++) ant.add(malha(new T.CylinderGeometry(.015, .015, .6, 3), ma, V(-5.9 - i * .18, 2.6 + i * .27, s * (.45 + i * .06)), [s * .8, 0, .8])); });
      m.parte("antenas", ant, V(-7.2, 4.8, .6));
      const tor = new T.Group();
      tor.add(malha(new T.SphereGeometry(1.6, 28, 20), preto, V(-3, 1.6, 0), null, [1.2, 1, 1]));
      [-1, 1].forEach(s => tor.add(tubo([V(-4.2, 2.7, s * .25), V(-3.5, 3.15, s * .75), V(-2.6, 3.15, s * .55), V(-1.9, 2.75, s * .2)], .07, branco)));
      tor.add(tubo([V(-3.9, 3.0, 0), V(-2.2, 3.0, 0)], .04, branco));
      m.parte("torax_aedes", tor, V(-3, 3.6, 0));
      const abd = new T.Group();
      for (let i = 0; i < 8; i++) { const x = -1 + i * .9, r = 1 - Math.abs(i - 2.5) * .1; abd.add(malha(new T.SphereGeometry(r, 20, 14), preto, V(x, 1.1 - i * .12, 0), null, [.75, .85, .85]));
        abd.add(malha(new T.TorusGeometry(r * .83, .08, 6, 24), branco, V(x - .25, 1.1 - i * .12, 0), [0, Math.PI / 2, 0])); }
      m.parte("abdome_aedes", abd, V(3, 2.4, 0));
      const asas = new T.Group(), forma = new T.Shape(); forma.ellipse(0, 0, 3.6, .8, 0, Math.PI * 2);
      const geoA = new T.ShapeGeometry(forma, 30); geoA.translate(3.4, 0, 0);
      const ma2 = mat(0xbae6fd, { op: .35, side: T.DoubleSide, rough: .1 });
      const asaE = malha(geoA, ma2, V(-2.6, 2.8, .4), [-Math.PI / 2 + .15, 0, -.1]), asaD = malha(geoA, ma2, V(-2.6, 2.8, -.4), [-Math.PI / 2 - .15, 0, .1]);
      asaE.scale.y = 1; asas.add(asaE, asaD); m.parte("asas", asas, V(2, 3.4, 2));
      const patas = new T.Group();
      [-1, 1].forEach(s => [-3.8, -3, -2.2].forEach((x, k) => {
        const pts = [V(x, 1, s * .6), V(x - 1 + k, 1.9, s * 2.2), V(x - 2 + k * 1.6, -1.3, s * 3.2), V(x - 2.6 + k * 2.4, -2.6, s * 3.9)];
        const curva = new T.CatmullRomCurve3(pts);
        for (let i = 0; i < 14; i++) { const a = curva.getPoint(i / 14), b = curva.getPoint((i + 1) / 14); patas.add(tubo([a, b], .07, i % 3 === 2 ? branco : preto, false, 2)); }
      }));
      m.parte("patas", patas, V(-4.6, -2.6, 3.6));
      return Object.assign(m, { atualizar(dt, t) { const a = Math.sin(t * 40) * .35; asaE.rotation.x = -Math.PI / 2 + .15 + a; asaD.rotation.x = -Math.PI / 2 - .15 - a; } });
    }
  };

  window.MODELOS = M;
  window.GEO = { mat, malha, rng, fibonacci, orientar, deformar, tubo, novelo, hélice, vírusMini, anticorpoGeo, celulaBola, V };
})();
