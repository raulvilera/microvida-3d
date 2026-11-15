/* =========================================================================
   MICROVIDA 3D — Aplicação (palco 3D, painel, abas, quiz e desafio)
   ========================================================================= */
(function () {
  const T = THREE, D = DADOS, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const carga = $("#carregando"); carga.style.setProperty("--p", .3);

  /* ------------------------------ RENDERIZAÇÃO ------------------------------ */
  const palco = $("#palco");
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.localClippingEnabled = true;
  palco.appendChild(renderer.domElement);
  const cena = new T.Scene();
  const cam = new T.PerspectiveCamera(40, 1, 0.05, 600);
  cam.position.set(0, 2, 20);
  cena.add(new T.HemisphereLight(0xe0f2fe, 0x0b1628, 0.95));
  const sol = new T.DirectionalLight(0xffffff, 1.15); sol.position.set(8, 14, 10); cena.add(sol);
  const contra = new T.DirectionalLight(0x5eead4, 0.55); contra.position.set(-10, -4, -8); cena.add(contra);
  const realce = new T.DirectionalLight(0xf472b6, 0.25); realce.position.set(10, -6, 4); cena.add(realce);
  const ctl = new T.OrbitControls(cam, renderer.domElement);
  ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.autoRotateSpeed = 1.2;
  const plano = new T.Plane(new T.Vector3(0, 0, -1), 0);
  carga.style.setProperty("--p", .6);

  const est = {
    modo: "modelo", modeloId: null, ultimoModelo: "virus", atual: null, sim: null, simId: null,
    mats: {}, visivel: {}, opac: {}, selecionado: null, rotulos: true, corte: false, raio: 8,
    voo: null, desafio: null, rotEls: []
  };

  function redimensionar() {
    const w = palco.clientWidth, h = palco.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; ajustarCentro();
    // se a área 3D mudou de tamanho (ex.: painel fechado no celular) e o usuário não mexeu na câmera, reenquadra
    const t = w + "x" + h; if (est.tamPalco && est.tamPalco !== t && est.vistaAtual && !est.usuarioMoveu) vista(est.vistaAtual, .35);
    est.tamPalco = t;
  }
  function ajustarCentro() {
    const w = palco.clientWidth, h = palco.clientHeight, d = est && est.deslLeg || 0;
    if (d && w && h) cam.setViewOffset(w, h, 0, d, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(redimensionar).observe(palco);

  /* ------------------------------ CÂMERA ------------------------------ */
  function voarPara(alvo, pos, dur) {
    est.voo = { t: 0, dur: dur ?? 0.9, a0: ctl.target.clone(), p0: cam.position.clone(), a1: alvo.clone(), p1: pos.clone() };
  }
  // afasta a câmera quando o palco é estreito (celular em pé, painel aberto)
  function ajustar(alvo, pos) { const f = Math.max(1, 1.08 / Math.max(cam.aspect, .3)); return pos.clone().sub(alvo).multiplyScalar(f).add(alvo); }
  function vista(v, dur) {
    if (!v) return;
    est.vistaAtual = v; est.usuarioMoveu = false;
    const a = new T.Vector3(...v[2]); let p = ajustar(a, new T.Vector3(...v[1]));
    // vista geral: afasta a câmera até o modelo inteiro caber (deixando margem para os rótulos)
    if (est.modo === "modelo" && est.esfera && MODELOS[est.modeloId].vistas[0] === v && est.modeloId !== "escala") {
      const vf = T.MathUtils.degToRad(cam.fov) / 2, hf = Math.atan(Math.tan(vf) * cam.aspect);
      const precisa = (est.esfera.radius + est.esfera.center.distanceTo(a)) / Math.sin(Math.min(vf, hf)) * (ehEstreita() && MODELOS[est.modeloId].rotulosNumerados ? .8 : .98); // com números não precisa de margem para nomes
      const d = p.distanceTo(a); if (precisa > d) p = p.clone().sub(a).multiplyScalar(precisa / d).add(a);
      const af = cam.aspect < .8 ? (MODELOS[est.modeloId].afastarCelular || 1) : 1; if (af !== 1) p = p.clone().sub(a).multiplyScalar(af).add(a);
    }
    voarPara(a, p);
    if (v[3] && v[3].corte !== undefined) definirCorte(v[3].corte);
  }
  function montarVistas(lista) {
    const g = $("#grupoVistas");
    g.innerHTML = (lista || []).map((v, i) => `<button data-v="${i}">${v[0]}</button>`).join("");
    g.querySelectorAll("button").forEach(b => b.onclick = () => vista(lista[+b.dataset.v]));
  }

  /* ------------------------------ LIMPEZA ------------------------------ */
  function descartar(obj) {
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
  }
  function limparPalco() {
    if (est.sim && est.sim.destruir) est.sim.destruir();
    if (est.atual) { cena.remove(est.atual.raiz); descartar(est.atual.raiz); }
    est.atual = null; est.sim = null; est.simId = null; est.selecionado = null;
    est.mats = {}; est.visivel = {}; est.opac = {};
    $("#rotulos").innerHTML = ""; est.rotEls = [];
    $("#hud").hidden = true; $("#escalaInfo").hidden = true;
    definirCorte(false, true);
  }

  /* ------------------------------ MODELOS ------------------------------ */
  function carregarModelo(id, semInfo) {
    const def = MODELOS[id];
    if (def.preparar && !def.pronto()) {
      avisar("Carregando o modelo anatômico 3D…"); carga.classList.remove("some"); $("#cargaTxt").textContent = "Montando o corpo humano…"; carga.style.setProperty("--p", .5);
      return def.preparar().then(() => { carga.classList.add("some"); carregarModelo(id, semInfo); }).catch(() => { carga.classList.add("some"); avisar("Não foi possível carregar o modelo anatômico. Verifique a internet."); });
    }
    limparPalco();
    const md = def.construir();
    est.modo = "modelo"; est.modeloId = id; est.ultimoModelo = id; est.atual = md;
    cena.add(md.raiz);
    { const bx = new T.Box3(), b2 = new T.Box3(); md.raiz.updateMatrixWorld(true);
      md.raiz.traverse(o => { if (o.isMesh && !o.userData.semCaixa) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b2.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); bx.union(b2); } });
      est.esfera = bx.isEmpty() ? null : bx.getBoundingSphere(new T.Sphere()); }
    Object.entries(md.partes).forEach(([p, meshes]) => {
      const s = new Set(); meshes.forEach(m => (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => s.add(x)));
      est.mats[p] = [...s]; est.mats[p].forEach(x => { x.userData.dw0 = x.depthWrite; x.userData.em0 = x.emissive.getHex(); x.userData.ei0 = x.emissiveIntensity; });
      est.visivel[p] = true; est.opac[p] = 1;
    });
    const caixa = new T.Box3().setFromObject(md.raiz); est.raio = caixa.getSize(new T.Vector3()).length() / 2;
    cam.near = def.near || 0.05; cam.updateProjectionMatrix();
    ctl.minDistance = def.near ? 0.08 : 2; ctl.maxDistance = Math.max(80, est.raio * 6);
    montarVistas(def.vistas); vista(def.vistas[0]);
    $$(".mod-btn").forEach(b => b.classList.toggle("ativo", b.dataset.mod === id));
    listarPartes();
    criarRotulos(Object.keys(md.ancoras).map(p => ({ parte: p, txt: D.fichas[p] ? D.fichas[p].nome : p, cor: D.fichas[p] ? D.fichas[p].cor : "#fff", local: md.ancoras[p] })));
    if (def.escala) { $("#escalaInfo").hidden = false; $("#escalaInfo").textContent = def.escala; }
    est.semRotulo = new Set(); montarCamadas(def);
    if (def.camadas) aplicarCamada(def.camadaInicial || 0, true);
    $("#secCorte").hidden = false;
    if (!semInfo) mostrarModeloInfo(id);
  }
  function listarPartes() {
    const box = $("#listaPartes");
    if (est.modo !== "modelo") { box.innerHTML = `<p class="muted mini-txt">Simulação em andamento. Use os controles no painel ao lado. Para voltar aos modelos, escolha um modelo acima.</p>`; return; }
    box.innerHTML = Object.keys(est.mats).map(p => { const f = D.fichas[p] || { nome: p, cor: "#fff" };
      return `<div class="parte ${est.visivel[p] ? "" : "off"}" data-p="${p}" style="--c:${f.cor}"><button class="bol" title="Mostrar/esconder" aria-label="Mostrar ou esconder ${f.nome}"></button><button class="nome">${f.nome}</button><input type="range" min="0" max="100" value="${Math.round(est.opac[p] * 100)}" aria-label="Transparência de ${f.nome}"></div>`; }).join("");
    box.querySelectorAll(".parte").forEach(el => {
      const p = el.dataset.p;
      el.querySelector(".bol").onclick = () => { est.visivel[p] = !est.visivel[p]; aplicarParte(p); el.classList.toggle("off", !est.visivel[p]); };
      el.querySelector(".nome").onclick = () => selecionar(p, true);
      el.querySelector("input").oninput = e => { est.opac[p] = e.target.value / 100; aplicarParte(p); };
    });
  }
  function aplicarParte(p) {
    est.rotSujo = true; est.pinSig = null;
    const op = est.opac[p], vis = est.visivel[p] && op > 0.02;
    est.mats[p].forEach(m => { const o = m.userData.baseOp * op; m.opacity = o; m.transparent = o < 0.999; m.depthWrite = o >= 0.6 ? m.userData.dw0 : false; });
    (est.atual.partes[p] || []).forEach(me => me.visible = vis && !me.userData.oculto);
  }
  function montarCamadas(def) {
    const sec = $("#secCamadas");
    if (!def.camadas) { sec.hidden = true; return; }
    sec.hidden = false;
    $("#listaCamadas").innerHTML = def.camadas.map((c, i) => `<button class="chip" data-camada="${i}">${c.nome}</button>`).join("") +
      (est.atual.sexo ? `<div class="seg-sexo"><button class="chip ativo" data-sexo="fem">Corpo feminino</button><button class="chip" data-sexo="masc">Corpo masculino</button></div>` : "");
    $$("#listaCamadas [data-camada]").forEach(b => b.onclick = () => aplicarCamada(+b.dataset.camada));
    $$("#listaCamadas [data-sexo]").forEach(b => b.onclick = () => { est.atual.sexo(b.dataset.sexo); $$("#listaCamadas [data-sexo]").forEach(x => x.classList.toggle("ativo", x === b)); aplicarParte("pele"); });
  }
  function aplicarCamada(i, silencioso) {
    const def = MODELOS[est.modeloId]; if (!def || !def.camadas) return;
    const c = def.camadas[i]; est.camada = i; est.semRotulo = new Set();
    Object.keys(est.mats).forEach(p => {
      const dentro = c.partes === "*" || c.partes.includes(p), extra = c.extra && c.extra[p] != null;
      est.visivel[p] = dentro || extra;
      est.opac[p] = extra ? c.extra[p] : (c.opac && c.opac[p] != null ? c.opac[p] : 1);
      if (extra && !dentro) est.semRotulo.add(p);
      aplicarParte(p);
    });
    $$("#listaCamadas [data-camada]").forEach(b => b.classList.toggle("ativo", +b.dataset.camada === i));
    listarPartes();
    if (!silencioso) avisar("Mostrando: " + c.nome);
  }
  function mostrarTudo() {
    const def = MODELOS[est.modeloId];
    if (est.modo === "modelo" && def && def.camadas) { const k = def.camadas.findIndex(c => c.partes === "*"); return aplicarCamada(k < 0 ? 0 : k, true); } Object.keys(est.mats).forEach(p => { est.visivel[p] = true; est.opac[p] = 1; aplicarParte(p); }); listarPartes(); }

  /* ------------------------------ CORTE ------------------------------ */
  function definirCorte(on, silencioso) {
    est.corte = !!on; $("#chkCorte").checked = est.corte; $("#corteVal").disabled = !est.corte;
    if (!silencioso || est.atual) atualizarCorte();
  }
  function atualizarCorte() {
    plano.constant = ($("#corteVal").value / 100) * est.raio * 0.6;
    if (!est.atual) return;
    est.atual.raiz.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { const q = est.corte ? [plano] : null; if (m.clippingPlanes !== q) { m.clippingPlanes = q; m.clipShadows = true; m.needsUpdate = true; } }); });
  }
  $("#chkCorte").onchange = e => definirCorte(e.target.checked);
  $("#corteVal").oninput = atualizarCorte;

  /* ------------------------------ RÓTULOS ------------------------------ */
  function corTexto(hex) { // texto escuro em fundo claro, branco em fundo escuro
    const c = new T.Color(hex), l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    return l > 0.28 ? "#08111f" : "#ffffff";
  }
  function criarRotulos(lista) {
    const box = $("#rotulos"); box.innerHTML = '<svg class="linhas-rot" aria-hidden="true"></svg>'; est.rotEls = []; est.pinSig = null; est.rotSujo = true; est.rotSigCam = null;
    est.svgRot = box.querySelector("svg");
    lista.forEach(r => {
      const cor = r.cor || "#5eead4", el = document.createElement("div"); el.className = "rot"; el.textContent = r.txt;
      el.style.setProperty("--c", cor); el.style.setProperty("--ct", corTexto(cor));
      if (r.parte) el.onclick = () => selecionar(r.parte, false);
      box.appendChild(el); r.el = el; r.cor = cor; r.tam = null; r.modo = null; est.rotEls.push(r);
    });
  }

  /* ---- Contorno do modelo na tela (retângulo das partes visíveis) ---- */
  const _v = new T.Vector3(), _bx = new T.Box3(), _b2 = new T.Box3(), _cn = new T.Vector3();
  function contornoTela(w, h) {
    if (!est.atual) return null;
    _bx.makeEmpty();
    est.atual.raiz.traverseVisible(o => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.semCaixa) return;
      if (o.material && o.material.opacity < .05) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      _b2.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); _bx.union(_b2);
    });
    if (_bx.isEmpty()) return null;
    // retângulo das quinas da caixa (exagera em perspectiva) ∩ retângulo da esfera envolvente (justo para formas redondas)
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (let i = 0; i < 8; i++) {
      _cn.set(i & 1 ? _bx.max.x : _bx.min.x, i & 2 ? _bx.max.y : _bx.min.y, i & 4 ? _bx.max.z : _bx.min.z).project(cam);
      if (_cn.z > 1) return null;
      const x = (_cn.x * .5 + .5) * w, y = (-_cn.y * .5 + .5) * h;
      l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
    }
    const centro = _bx.getCenter(new T.Vector3()), raio = _bx.getSize(new T.Vector3()).length() / 2 * .92;
    const dist = centro.distanceTo(cam.position);
    if (dist > raio * 1.05) {
      const ang = Math.asin(Math.min(1, raio / dist)), escala = Math.tan(ang) / Math.tan(T.MathUtils.degToRad(cam.fov / 2)) * h / 2;
      _cn.copy(centro).project(cam); const sx = (_cn.x * .5 + .5) * w, sy = (-_cn.y * .5 + .5) * h;
      l = Math.max(l, sx - escala); r = Math.min(r, sx + escala); t = Math.max(t, sy - escala); b = Math.min(b, sy + escala);
    }
    return { l: Math.max(0, l), t: Math.max(0, t), r: Math.min(w, r), b: Math.min(h, b) };
  }

  /* =====================================================================
     RÓTULOS — dois modos, ambos estáveis (nada é recalculado enquanto a câmera se move):
     • Telas largas: nomes em colunas fora do modelo, com linhas de chamada. Ao girar, os
       nomes somem suavemente e voltam já organizados quando a câmera para.
     • Telas estreitas (celular): números coloridos presos às estruturas + legenda numerada,
       como num atlas de anatomia. Os números acompanham a estrutura ao girar.
     ===================================================================== */
  const ehEstreita = () => palco.clientWidth < 640;
  function projetarRotulos(w, h) {
    const cand = [];
    est.rotEls.forEach(r => {
      let vis = est.rotulos;
      if (r.parte && est.modo === "modelo") vis = vis && est.visivel[r.parte] && est.opac[r.parte] > .05 && !(est.semRotulo && est.semRotulo.has(r.parte) && r.parte !== est.selecionado);
      if (r.local && est.atual) { _v.copy(r.local); est.atual.raiz.localToWorld(_v); }
      else if (r.obj) { r.obj.getWorldPosition(_v); if (r.dy) _v.y += r.dy; if (!r.obj.visible) vis = false; }
      else if (r.pos) _v.copy(r.pos);
      if (r.oculto) vis = false;
      const wy = _v.y;
      if (vis) { _v.project(cam); if (_v.z > 1 || Math.abs(_v.x) > 1.02 || Math.abs(_v.y) > 1.02) vis = false; }
      if (r.atualizarTxt) { const tx = r.atualizarTxt(); if (tx !== r.txt) { r.txt = tx; r.modo = null; r.tam = null; } }
      r.el.classList.toggle("sel", !!r.parte && r.parte === est.selecionado);
      if (!vis) { r.el.style.display = "none"; return; }
      r.el.style.display = "";
      cand.push({ r, ax: (_v.x * .5 + .5) * w, ay: (-_v.y * .5 + .5) * h, z: _v.z, wy });
    });
    return cand;
  }
  function modoRotulo(r, modo) {
    if (r.modo === modo) return;
    r.modo = modo; r.el.classList.toggle("pino", modo === "pino");
    r.el.textContent = modo === "pino" ? (r.num || "") : r.txt; r.tam = null;
  }
  function atualizarRotulos() {
    const w = palco.clientWidth, h = palco.clientHeight, box = $("#rotulos");
    const cand = projetarRotulos(w, h);
    const pinos = est.modo === "modelo" && ehEstreita() && !!MODELOS[est.modeloId].rotulosNumerados; // só o corpo humano usa números + legenda
    box.classList.toggle("modo-pinos", pinos);
    if (pinos) { box.classList.remove("movendo"); return layoutPinos(cand, w, h); }
    $("#legenda").hidden = true; if (est.deslLeg) { est.deslLeg = 0; ajustarCentro(); }
    cand.forEach(c => modoRotulo(c.r, "nome"));
    if (est.modo === "modelo") {
      const sigCam = cam.matrixWorld.elements.map(x => x.toFixed(2)).join(",") + "|" + w + "x" + h, agora = performance.now();
      if (sigCam !== est.rotSigCam) { est.rotSigCam = sigCam; est.rotMudou = agora; est.rotSujo = true; box.classList.add("movendo"); return; }
      if (agora - est.rotMudou < 180) return;
      const sigVis = cand.map(c => c.r.txt + (c.r.parte === est.selecionado ? "*" : "")).join("|");
      if (!est.rotSujo && sigVis === est.rotSigVis) return;
      est.rotSigVis = sigVis; est.rotSujo = false;
      layoutChamadas(cand, w, h); box.classList.remove("movendo");
      return;
    }
    box.classList.remove("movendo");
    layoutLivre(cand, w, h, [], []);
  }
  function medir(c) { if (!c.r.tam || !c.r.tam[0]) c.r.tam = [c.r.el.offsetWidth, c.r.el.offsetHeight]; c.cw = c.r.tam[0]; c.ch = c.r.tam[1]; }

  /* ---- telas largas: colunas fora do modelo ---- */
  function layoutChamadas(cand, w, h) {
    cand.forEach(medir);
    const M = 8, G = 18, ocup = [], linhas = [], resto = [];
    const R = contornoTela(w, h);
    const ponto = (c, x, y, lado) => { ocup.push([x, y, x + c.cw, y + c.ch]); c.x = x; c.y = y; c.lado = lado; };
    if (R && ((R.r - R.l) < w * .97 || (R.b - R.t) < h * .97)) {
      const cx = (R.l + R.r) / 2, cy = (R.t + R.b) / 2, rw = Math.max(1, R.r - R.l), rh = Math.max(1, R.b - R.t);
      const espaco = { l: R.l - G - M, r: w - R.r - G - M, t: R.t - G - M, b: h - R.b - G - M };
      const grupos = { l: [], r: [], t: [], b: [] };
      cand.forEach(c => {
        const dx = (c.ax - cx) / rw, dy = (c.ay - cy) / rh, H = dx < 0 ? "l" : "r", Vt = dy < 0 ? "t" : "b", H2 = H === "l" ? "r" : "l", V2 = Vt === "t" ? "b" : "t";
        const alto = rh > rw * 1.3, largo = rw > rh * 1.3;
        const pref = alto ? [H, H2, Vt, V2] : largo ? [Vt, V2, H, H2] : Math.abs(dx) >= Math.abs(dy) ? [H, Vt, V2, H2] : [Vt, H, H2, V2];
        const lado = pref.find(s => (s === "l" || s === "r") ? espaco[s] >= c.cw : espaco[s] >= c.ch);
        if (lado) grupos[lado].push(c); else resto.push(c);
      });
      ["t", "b"].forEach(s => {
        const g = grupos[s].sort((a, b) => a.ax - b.ax), fimLinha = [];
        g.forEach(c => {
          const passo = c.ch + 6, nLin = Math.max(1, Math.floor((espaco[s] + 6) / passo));
          for (let k = 0; k < nLin; k++) {
            const x = Math.max(M, Math.min(w - M - c.cw, c.ax - c.cw / 2), (fimLinha[k] ?? -1e9) + 6);
            if (x + c.cw <= w - M) { fimLinha[k] = x + c.cw; return ponto(c, x, s === "t" ? R.t - G - c.ch - k * passo : R.b + G + k * passo, s); }
          }
          const lat = [c.ax < cx ? "l" : "r", c.ax < cx ? "r" : "l"].find(q => espaco[q] >= c.cw);
          if (lat) grupos[lat].push(c); else resto.push(c);
        });
      });
      ["l", "r"].forEach(s => {
        const g = grupos[s].sort((a, b) => a.ay - b.ay); let fim = M - 6;
        g.forEach(c => { c.y = Math.max(c.ay - c.ch / 2, fim + 6); fim = c.y + c.ch; });
        const exc = fim - (h - M); if (exc > 0) g.forEach(c => c.y = Math.max(M, c.y - exc));
        // alinha a coluna inteira pela borda do modelo (aspecto de legenda de atlas)
        g.forEach(c => ponto(c, s === "l" ? Math.max(M, R.l - G - c.cw) : Math.min(w - M - c.cw, R.r + G), c.y, s));
      });
    } else cand.forEach(c => resto.push(c));
    layoutLivre(resto, w, h, ocup, linhas, cand);
  }

  /* ---- posicionamento livre (cenários que ocupam a tela e simulações) ---- */
  function layoutLivre(lista, w, h, ocup, linhas, todos) {
    lista.forEach(medir);
    const bate = (x, y, cw, ch) => ocup.some(o => x < o[2] + 4 && x + cw + 4 > o[0] && y < o[3] + 4 && y + ch + 4 > o[1]);
    lista.sort((a, b) => (b.r.parte === est.selecionado) - (a.r.parte === est.selecionado) || a.z - b.z).forEach(c => {
      const { ax, ay, cw, ch } = c, up = ay - 14 - ch, st = ch + 5;
      const tent = [[ax - cw / 2, up], [ax - cw / 2, up - st], [ax + 12, ay - ch / 2], [ax - cw - 12, ay - ch / 2], [ax - cw / 2, ay + 14],
        [ax - cw / 2, up - 2 * st], [ax + 12, up], [ax - cw - 12, up], [ax + 12, ay + 14], [ax - cw - 12, ay + 14], [ax - cw / 2, ay + 14 + st]];
      if (c.r.off) tent.unshift([ax + c.r.off[0], ay + c.r.off[1]]); // mantém o lugar anterior se ainda estiver livre (evita pulos)
      for (let [x, y] of tent) { x = Math.max(2, Math.min(w - cw - 2, x)); y = Math.max(2, Math.min(h - ch - 2, y)); if (!bate(x, y, cw, ch)) { ocup.push([x, y, x + cw, y + ch]); c.x = x; c.y = y; c.lado = "livre"; c.r.off = [x - ax, y - ay]; return; } }
      if (c.r.parte === est.selecionado) { c.x = Math.max(2, Math.min(w - cw - 2, ax - cw / 2)); c.y = Math.max(2, up); c.lado = "livre"; return; }
      c.r.el.style.display = "none"; c.r.off = null;
    });
    (todos || lista).forEach(c => {
      if (c.x === undefined) return;
      c.r.el.style.transform = `translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px)`;
      let lx, ly;
      if (c.lado === "l") { lx = c.x + c.cw; ly = c.y + c.ch / 2; }
      else if (c.lado === "r") { lx = c.x; ly = c.y + c.ch / 2; }
      else if (c.lado === "t") { lx = Math.max(c.x + 8, Math.min(c.x + c.cw - 8, c.ax)); ly = c.y + c.ch; }
      else if (c.lado === "b") { lx = Math.max(c.x + 8, Math.min(c.x + c.cw - 8, c.ax)); ly = c.y; }
      else { lx = Math.max(c.x + 6, Math.min(c.x + c.cw - 6, c.ax)); ly = c.ay < c.y ? c.y : c.ay > c.y + c.ch ? c.y + c.ch : c.y + c.ch / 2; }
      const mx = c.lado === "l" ? lx + 10 : c.lado === "r" ? lx - 10 : lx, my = c.lado === "t" ? ly + 6 : c.lado === "b" ? ly - 6 : ly;
      linhas.push(`<polyline points="${c.ax.toFixed(1)},${c.ay.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)}" stroke="${c.r.cor}"/><circle cx="${c.ax.toFixed(1)}" cy="${c.ay.toFixed(1)}" r="3.6" fill="${c.r.cor}" stroke="#08111f" stroke-width="1"/>`);
    });
    if (est.svgRot) est.svgRot.innerHTML = linhas.join("");
  }

  /* ---- telas estreitas: números + legenda ---- */
  function layoutPinos(cand, w, h) {
    // numeração estável: de cima para baixo no corpo (altura real), refeita só quando muda o conjunto visível
    const sig = cand.map(c => c.r.txt).sort().join("|");
    if (sig !== est.pinSig) {
      est.pinSig = sig;
      cand.slice().sort((a, b) => b.wy - a.wy || a.r.txt.localeCompare(b.r.txt)).forEach((c, i) => { c.r.num = i + 1; c.r.modo = null; });
      montarLegenda(cand);
    }
    cand.forEach(c => modoRotulo(c.r, "pino"));
    const P = cand.map(c => ({ c, x: c.ax, y: c.ay })), D = 22;
    for (let it = 0; it < 6; it++) for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y, d = Math.hypot(dx, dy) || .01;
      if (d < D) { const k = (D - d) / 2 / d; P[i].x -= dx * k; P[i].y -= dy * k; P[j].x += dx * k; P[j].y += dy * k; }
    }
    const linhas = [];
    P.forEach(p => {
      const x = Math.max(11, Math.min(w - 11, p.x)), y = Math.max(11, Math.min(h - 11, p.y)), c = p.c;
      c.r.el.style.transform = `translate(${(x - 11).toFixed(1)}px, ${(y - 11).toFixed(1)}px)`;
      if (Math.hypot(x - c.ax, y - c.ay) > 4) linhas.push(`<line x1="${c.ax.toFixed(1)}" y1="${c.ay.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${c.r.cor}"/><circle cx="${c.ax.toFixed(1)}" cy="${c.ay.toFixed(1)}" r="2.6" fill="${c.r.cor}"/>`);
    });
    if (est.svgRot) est.svgRot.innerHTML = linhas.join("");
    const leg = $("#legenda"); leg.hidden = !cand.length;
    // centraliza o modelo no espaço livre acima da legenda
    const desl = leg.hidden ? 0 : Math.round(leg.offsetHeight / 2);
    if (desl !== (est.deslLeg || 0)) { est.deslLeg = desl; ajustarCentro(); }
    leg.querySelectorAll("li").forEach(li => li.classList.toggle("sel", li.dataset.p === est.selecionado));
  }
  function montarLegenda(cand) {
    const leg = $("#legenda"), itens = cand.slice().sort((a, b) => a.r.num - b.r.num);
    leg.innerHTML = `<button class="leg-tit" aria-expanded="${est.legAberta !== false}">Legenda <span>${itens.length}</span><b>${est.legAberta !== false ? "▾" : "▸"}</b></button>
      <ol ${est.legAberta === false ? "hidden" : ""}>${itens.map(c => `<li data-p="${c.r.parte || ""}"><i style="background:${c.r.cor};color:${corTexto(c.r.cor)}">${c.r.num}</i><span>${c.r.txt}</span></li>`).join("")}</ol>`;
    leg.querySelector(".leg-tit").onclick = () => { est.legAberta = est.legAberta === false; montarLegenda(cand); };
    leg.querySelectorAll("li[data-p]").forEach(li => { if (li.dataset.p) li.onclick = () => selecionar(li.dataset.p, true); });
  }

  /* ------------------------------ SELEÇÃO ------------------------------ */
  function realcar(p, cor, int) { (est.mats[p] || []).forEach(m => { m.emissive.setHex(cor); m.emissiveIntensity = int; }); }
  function limparRealce(p) { (est.mats[p] || []).forEach(m => { m.emissive.setHex(m.userData.em0); m.emissiveIntensity = m.userData.ei0; }); }
  function selecionar(p, voar) {
    if (!D.fichas[p]) return;
    const f = D.fichas[p], def = MODELOS[f.modelo];
    if (def.preparar && !def.pronto()) { carregarModelo(f.modelo, true); return def.preparar().then(() => setTimeout(() => selecionar(p, voar), 50)); }
    if (est.modo !== "modelo" || est.modeloId !== f.modelo) carregarModelo(f.modelo, true);
    if (est.desafio) return responderDesafio(p);
    if (est.selecionado) limparRealce(est.selecionado);
    est.selecionado = p; realcar(p, 0xbef264, 0.45);
    if (!est.visivel[p] || est.opac[p] < .3) { est.visivel[p] = true; est.opac[p] = 1; aplicarParte(p); listarPartes(); }
    if (voar) focar(p);
    mostrarInfo(p);
  }
  function focar(p) {
    const a = est.atual && est.atual.ancoras[p]; if (!a) return;
    const alvo = est.atual.raiz.localToWorld(a.clone());
    const dir = cam.position.clone().sub(ctl.target).normalize();
    const dist = Math.max(est.raio * 0.55, (MODELOS[est.modeloId].near ? .3 : 4));
    const dEsc = est.modeloId === "escala" ? ({ virus_escala: .35, bacteria_escala: 4, hemacia: 12 }[p] || 34) : dist;
    voarPara(alvo, alvo.clone().add(dir.multiplyScalar(dEsc)));
  }
  // clique no palco (sem arrastar)
  const ray = new T.Raycaster(), mouse = new T.Vector2(); let baixo = null;
  renderer.domElement.addEventListener("wheel", () => est.usuarioMoveu = true, { passive: true });
  renderer.domElement.addEventListener("pointerdown", e => { est.usuarioMoveu = true; baixo = [e.clientX, e.clientY]; ctl.autoRotate = false; $("#btnGirar").classList.remove("ativo"); $(".ajuda-gestos").classList.add("some"); });
  renderer.domElement.addEventListener("pointerup", e => {
    if (!baixo || Math.hypot(e.clientX - baixo[0], e.clientY - baixo[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, cam);
    if (!est.atual) return;
    const hits = ray.intersectObject(est.atual.raiz, true).filter(h => {
      let o = h.object, vis = true; while (o) { if (!o.visible) vis = false; o = o.parent; }
      if (!vis) return false;
      if (est.corte && plano.distanceToPoint(h.point) < 0) return false;
      return h.object.userData.parte || h.object.userData.info;
    });
    if (!hits.length) return;
    const o = hits[0].object;
    if (est.modo === "sim") {
      const id = o.userData.parte, info = o.userData.info;
      if (info) avisar(info);
      else if (id && D.fichas[id]) avisar(`${D.fichas[id].nome}: ${D.fichas[id].funcao}`);
      return;
    }
    selecionar(o.userData.parte, false);
  });

  /* ------------------------------ PAINEL: FICHAS ------------------------------ */
  const info = $("#info");
  function nomeModelo(id) { return (D.modelos.find(m => m.id === id) || {}).nome || id; }
  function mostrarInfo(p) {
    if (est.desafio) return;
    trocarAba("explorar", true);
    const f = D.fichas[p];
    info.innerHTML = `
      <div class="cartao">
        <div class="etiqueta" style="--c:${f.cor}">${nomeModelo(f.modelo)} · Aula ${f.aula}</div>
        <h2>${f.nome}</h2>
        <h4>Função</h4><p>${f.funcao}</p>
        <h4>Como é</h4><p>${f.desc}</p>
        ${f.curiosidade ? `<div class="destaque curioso"><b>Você sabia?</b> ${f.curiosidade}</div>` : ""}
        ${f.saude ? `<div class="destaque saude"><b>Saúde e prevenção:</b> ${f.saude}</div>` : ""}
        <h4>Habilidade relacionada</h4><div class="chips">${f.hab.map(c => `<button class="chip" data-hab="${c}">${c}</button>`).join("")}</div>
        <div class="acoes">
          <button class="btn prim" id="bFocar">Aproximar</button>
          <button class="btn" id="bOuvir">🔊 Ouvir</button>
          <button class="btn" id="bIsolar">Isolar</button>
          <button class="btn" id="bTudo">Mostrar tudo</button>
        </div>
      </div>
      ${partesIrmas(f.modelo, p)}`;
    $("#bFocar").onclick = () => focar(p);
    $("#bOuvir").onclick = () => falar(`${f.nome}. ${f.funcao} ${f.desc} ${f.curiosidade || ""} ${f.saude || ""}`);
    $("#bIsolar").onclick = () => { Object.keys(est.mats).forEach(x => { est.visivel[x] = x === p; aplicarParte(x); }); listarPartes(); };
    $("#bTudo").onclick = mostrarTudo;
    ligarChips(info);
  }
  function partesIrmas(modelo, atual) {
    const ps = Object.keys(D.fichas).filter(k => D.fichas[k].modelo === modelo);
    return `<div class="cartao pequeno"><h4 style="margin-top:0">Outras estruturas deste modelo</h4><div class="chips">${ps.map(k => `<button class="chip ${k === atual ? "ativo" : ""}" data-parte="${k}">${D.fichas[k].nome}</button>`).join("")}</div></div>`;
  }
  function ligarChips(box) {
    box.querySelectorAll("[data-parte]").forEach(b => b.onclick = () => selecionar(b.dataset.parte, true));
    box.querySelectorAll("[data-hab]").forEach(b => b.onclick = () => { trocarAba("habilidades"); destacarHab(b.dataset.hab); });
    box.querySelectorAll("[data-mod]").forEach(b => b.onclick = () => { carregarModelo(b.dataset.mod); fecharLateralMovel(); });
    box.querySelectorAll("[data-sim]").forEach(b => b.onclick = () => abrirSim(b.dataset.sim));
  }
  const introModelo = {
    virus: "Vírus são estruturas acelulares formadas por material genético protegido por um capsídeo de proteínas. Alguns, como o da gripe, têm envelope. Use o <b>corte</b> para ver o interior.",
    fago: "Bacteriófagos são vírus que infectam bactérias. A cauda funciona como uma seringa que injeta o DNA viral na célula.",
    bacteria: "Bactérias são seres unicelulares e procariontes: não têm núcleo organizado. Ative o <b>corte</b> para ver o nucleoide, os ribossomos e os plasmídeos.",
    formas: "Bactérias são classificadas pela forma: cocos (esferas), bacilos (bastonetes), espirilos (espirais) e vibriões (vírgula). Os cocos podem se agrupar.",
    escala: "Aqui os tamanhos são REAIS entre si. Use as vistas para viajar da célula humana até o vírus — ele é minúsculo! Dica: aproxime bem para enxergá-lo.",
    defesa: "Os glóbulos brancos (leucócitos) defendem o corpo. Macrófagos e neutrófilos fazem parte da imunidade inata; linfócitos B e T, da imunidade adaptativa.",
    corpo: "Modelo anatômico real (BodyParts3D e HuBMAP). Use as <b>camadas</b> para ver as <b>barreiras</b> (1ª linha de defesa: pele, lágrimas, muco, saliva, ácido do estômago, microbiota), os órgãos linfoides <b>primários</b> (medula óssea e timo, onde as células de defesa nascem e amadurecem) e os <b>secundários</b> (linfonodos, baço, tonsilas, apêndice e placas de Peyer, onde elas encontram os invasores).",
    mosquito: "A fêmea do Aedes aegypti transmite os vírus da dengue, zika, chikungunya e febre amarela urbana. Repare nas listras brancas e na ‘lira’ do tórax."
  };
  function mostrarModeloInfo(id) {
    if (est.desafio) return;
    const m = D.modelos.find(x => x.id === id);
    const camadas = MODELOS[id].camadas ? `<h4>Camadas</h4><div class="chips">${MODELOS[id].camadas.map((c, i) => `<button class="chip ${i === (est.camada || 0) ? "ativo" : ""}" data-cam="${i}">${c.nome}</button>`).join("")}</div>` : "";
    info.innerHTML = `<div class="cartao"><div class="etiqueta" style="--c:var(--acento)">${m.aula}</div><h2>${m.em} ${m.nome}</h2><p>${introModelo[id]}</p>${camadas}
      <p class="muted mini-txt">Clique em uma estrutura no modelo ou em um nome abaixo para abrir a ficha.</p>
      <div class="acoes"><button class="btn" id="bOuvirM">🔊 Ouvir</button></div></div>${partesIrmas(id)}`;
    $("#bOuvirM").onclick = () => falar(introModelo[id].replace(/<[^>]+>/g, ""));
    info.querySelectorAll("[data-cam]").forEach(b => b.onclick = () => { aplicarCamada(+b.dataset.cam); info.querySelectorAll("[data-cam]").forEach(x => x.classList.toggle("ativo", x === b)); });
    ligarChips(info);
  }
  function mostrarBoasVindas() {
    info.innerHTML = `<div class="cartao"><h2>Bem-vindo ao laboratório!</h2>
      <p>Explore em 3D os microrganismos e as defesas do corpo estudados no 4º bimestre. Escolha um modelo para começar:</p>
      <div class="grade-mod">${D.modelos.map(m => `<button data-mod="${m.id}"><span class="em">${m.em}</span><span>${m.nome}</span></button>`).join("")}</div></div>
      <div class="cartao pequeno"><h4 style="margin-top:0">Simulações em 3D</h4><div class="chips">${SIMULACOES.lista.map(s => `<button class="chip" data-sim="${s.id}">${s.em} ${s.titulo}</button>`).join("")}</div>
      <ul class="lista"><li>Em <b>Habilidades</b>, encontre cada aula e vá direto ao recurso.</li><li>Em <b>Quiz</b> e <b>Desafio</b>, teste o que aprendeu.</li></ul></div>`;
    ligarChips(info);
  }

  /* ------------------------------ VOZ ------------------------------ */
  function falar(txt) {
    if (!("speechSynthesis" in window)) return avisar("Seu navegador não tem leitura em voz alta.");
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt); u.lang = "pt-BR"; u.rate = 1;
    const v = speechSynthesis.getVoices().find(v => /pt[-_]BR/i.test(v.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function avisar(t) { const a = $("#aviso"); a.textContent = t; a.hidden = false; clearTimeout(a._t); a._t = setTimeout(() => a.hidden = true, 5000); }

  /* ------------------------------ SIMULAÇÕES ------------------------------ */
  function montarSimular() {
    const box = $("#aba-simular");
    box.innerHTML = `<div class="cartao"><h3>🧪 Simulações em 3D</h3><p class="muted">Escolha uma simulação. Ela aparece no palco 3D e os controles ficam aqui.</p></div>` +
      SIMULACOES.lista.map(s => `<div class="cartao sim"><h3>${s.em} ${s.titulo} <span class="cod">${s.hab}</span></h3><p class="muted">${s.desc}</p><p class="mini-txt muted">${s.aulas}</p><button class="btn prim" data-sim="${s.id}">▶ Abrir no palco 3D</button></div>`).join("");
    box.querySelectorAll("[data-sim]").forEach(b => b.onclick = () => abrirSim(b.dataset.sim));
  }
  function abrirSim(id) {
    if (est.desafio) pararDesafio();
    limparPalco();
    const def = SIMULACOES.lista.find(s => s.id === id);
    est.modo = "sim"; est.simId = id;
    $$(".mod-btn").forEach(b => b.classList.remove("ativo"));
    listarPartes(); $("#secCorte").hidden = true;
    trocarAba("simular", true);
    const box = $("#aba-simular");
    box.innerHTML = `<div class="linha-btn" style="margin:0 0 10px"><button class="btn" id="bVoltarSims">← Todas as simulações</button></div>
      <div class="cartao sim" id="cartaoSim"><h3>${def.em} ${def.titulo} <span class="cod">${def.hab}</span></h3><p class="mini-txt muted">${def.aulas}</p>${def.html}</div>`;
    $("#bVoltarSims").onclick = () => { carregarModelo(est.ultimoModelo, true); mostrarModeloInfo(est.ultimoModelo); montarSimular(); trocarAba("simular", true); };
    const cartao = $("#cartaoSim");
    const ctx = {
      T, G: GEO, cam, ctl, cartao, $: s => cartao.querySelector(s),
      hud: html => { const h = $("#hud"); h.hidden = !html; h.innerHTML = html || ""; },
      avisar, grafico: SIMULACOES.grafico, voar: (a, p) => { const A = new T.Vector3(...a); voarPara(A, ajustar(A, new T.Vector3(...p))); },
      rotulos: lista => criarRotulos(lista)
    };
    const s = def.iniciar(ctx);
    est.sim = s; est.atual = { raiz: s.raiz, partes: {}, ancoras: {} };
    cena.add(s.raiz);
    cam.near = 0.05; cam.updateProjectionMatrix(); ctl.minDistance = 2; ctl.maxDistance = 140;
    const caixa = new T.Box3().setFromObject(s.raiz); est.raio = caixa.getSize(new T.Vector3()).length() / 2;
    montarVistas(s.vistas); vista(s.vistas[0]);
  }

  /* ------------------------------ HABILIDADES ------------------------------ */
  function montarHabilidades() {
    const box = $("#aba-habilidades");
    box.innerHTML = `<div class="cartao"><h3>Habilidades do Currículo Paulista</h3><p class="muted">Ciências · 7º ano · 4º bimestre · Unidade temática <b>Vida e evolução</b>.</p></div>
      ${D.habilidades.map(h => `<div class="cartao hab" data-cod="${h.codigo}"><div class="hab-top"><span class="codigo">${h.codigo}</span></div><p>${h.texto}</p></div>`).join("")}
      <div class="cartao"><h3>Aulas do bimestre</h3>${D.aulas.map(a => `<div class="aula"><span class="n">${a.n}</span><div><b>${a.t}</b><small>${a.d}</small><small>${a.hab}</small></div><button class="btn" data-aula="${a.n}">Abrir</button></div>`).join("")}</div>
      <div class="cartao so-movel-bloco"><button class="btn" id="bSaibaM">📖 Glossário e referências</button></div>`;
    box.querySelectorAll("[data-aula]").forEach(b => b.onclick = () => executarAcao(D.aulas[+b.dataset.aula - 1].acao));
    $("#bSaibaM").onclick = () => trocarAba("saiba");
  }
  function destacarHab(cod) { const c = document.querySelector(`.hab[data-cod="${cod}"]`); if (!c) return; c.scrollIntoView({ behavior: "smooth", block: "center" }); c.classList.add("piscar"); setTimeout(() => c.classList.remove("piscar"), 1500); }
  function executarAcao(a) {
    if (a.modelo) { carregarModelo(a.modelo); trocarAba("explorar", true); }
    if (a.sim) abrirSim(a.sim);
    if (a.aba) trocarAba(a.aba);
  }

  /* ------------------------------ QUIZ ------------------------------ */
  const embaralhar = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const quiz = { lista: [], i: 0, pontos: 0 };
  function montarQuiz() {
    $("#aba-quiz").innerHTML = `<div class="cartao"><h3>📝 Quiz do bimestre</h3><p class="muted">10 questões sorteadas do banco de ${D.quiz.length}. Cada uma indica a habilidade avaliada.</p>
      <div class="linha-btn"><button class="btn prim" data-q="TODOS">Misturado</button><button class="btn" data-q="EF07CI09">EF07CI09 · Indicadores e saúde pública</button><button class="btn" data-q="EF07CI10">EF07CI10 · Microrganismos, defesa e vacinas</button></div></div><div id="quizArea"></div>`;
    $$("#aba-quiz [data-q]").forEach(b => b.onclick = () => { const f = b.dataset.q; quiz.lista = embaralhar(D.quiz.filter(q => f === "TODOS" || q.h === f || (f === "EF07CI09" && q.h === "EF07CI11"))).slice(0, 10); quiz.i = 0; quiz.pontos = 0; questao(); });
  }
  function questao() {
    const area = $("#quizArea");
    if (quiz.i >= quiz.lista.length) {
      const n = quiz.lista.length, p = quiz.pontos, pc = Math.round(p / n * 100);
      const msg = pc >= 80 ? "Excelente! 🏆" : pc >= 60 ? "Muito bom! 👏" : pc >= 40 ? "Bom começo — revise os modelos 3D. 📚" : "Explore os modelos e as simulações e tente de novo! 💪";
      area.innerHTML = `<div class="cartao centro"><h2>${p} / ${n}</h2><div class="barra"><span style="width:${pc}%"></span></div><p>${msg}</p></div>`;
      return;
    }
    const q = quiz.lista[quiz.i], ordem = embaralhar(q.o.map((t, i) => ({ t, i })));
    area.innerHTML = `<div class="cartao"><div class="hab-top"><span class="muted">Questão ${quiz.i + 1} de ${quiz.lista.length}</span><span class="codigo">${q.h}</span></div>
      <div class="barra"><span style="width:${quiz.i / quiz.lista.length * 100}%"></span></div>
      <p class="pergunta">${q.p}</p><div class="opcoes">${ordem.map((o, k) => `<button class="opcao" data-i="${o.i}"><b>${"ABCD"[k]})</b> ${o.t}</button>`).join("")}</div><div id="qFeed"></div></div>`;
    area.querySelectorAll(".opcao").forEach(b => b.onclick = () => {
      const certo = +b.dataset.i === q.c; if (certo) quiz.pontos++;
      area.querySelectorAll(".opcao").forEach(x => { if (+x.dataset.i === q.c) x.classList.add("certa"); else if (x === b) x.classList.add("errada"); x.disabled = true; });
      $("#qFeed").innerHTML = `<div class="destaque ${certo ? "saude" : "erro"}"><b>${certo ? "Correto!" : "Não foi dessa vez."}</b> ${q.e}</div><button class="btn prim" id="qProx">${quiz.i + 1 < quiz.lista.length ? "Próxima" : "Ver resultado"}</button>`;
      $("#qProx").onclick = () => { quiz.i++; questao(); };
    });
  }

  /* ------------------------------ DESAFIO ------------------------------ */
  function montarDesafio() {
    $("#aba-desafio").innerHTML = `<div class="cartao"><h3>🎯 Desafio: encontre no modelo!</h3>
      <p class="muted">Aparece o nome de uma estrutura e o modelo certo é carregado. Clique nela no palco 3D. Acertar de primeira vale 1 ponto; na segunda tentativa, meio ponto. 10 rodadas.</p>
      <button class="btn prim" id="bIniDes">Começar desafio</button></div><div id="desArea"></div>`;
    $("#bIniDes").onclick = iniciarDesafio;
  }
  function iniciarDesafio() {
    est.desafio = { fila: embaralhar(D.desafio).slice(0, 10), i: 0, pontos: 0, tent: 0, inicio: performance.now() };
    rodada();
  }
  function pararDesafio() { est.desafio = null; }
  function rodada() {
    const d = est.desafio, area = $("#desArea");
    if (d.i >= d.fila.length) {
      const seg = Math.round((performance.now() - d.inicio) / 1000);
      area.innerHTML = `<div class="cartao centro"><h2>${d.pontos} / ${d.fila.length}</h2><p>Tempo total: ${seg} s</p><button class="btn prim" id="bDesNovo">Jogar de novo</button></div>`;
      $("#bDesNovo").onclick = iniciarDesafio; est.desafio = null; return;
    }
    const id = d.fila[d.i], f = D.fichas[id]; d.tent = 0;
    if (MODELOS[f.modelo].preparar && !MODELOS[f.modelo].pronto()) { MODELOS[f.modelo].preparar().then(rodada); return; }
    if (est.modo !== "modelo" || est.modeloId !== f.modelo) { const des = est.desafio; est.desafio = null; carregarModelo(f.modelo, true); est.desafio = des; }
    mostrarTudo();
    est.rotulos = false; $("#btnRotulos").classList.remove("ativo");
    area.innerHTML = `<div class="cartao centro alvo"><small>Rodada ${d.i + 1}/${d.fila.length} · Pontos: ${d.pontos}</small><h2>Clique em: <span>${f.nome}</span></h2>
      <p class="muted">Modelo: ${nomeModelo(f.modelo)} · Dica: use o corte e a transparência se a estrutura estiver escondida.</p><div id="desFeed"></div><button class="btn" id="bPular">Pular / mostrar</button></div>`;
    $("#bPular").onclick = () => { realcar(id, 0xbef264, .8); focar(id); setTimeout(() => { limparRealce(id); d.i++; rodada(); }, 1800); };
  }
  function responderDesafio(p) {
    const d = est.desafio, alvo = d.fila[d.i], fb = $("#desFeed");
    if (p === alvo) {
      d.pontos += d.tent === 0 ? 1 : 0.5;
      realcar(alvo, 0x22ff66, .7); setTimeout(() => limparRealce(alvo), 900);
      fb.innerHTML = `<div class="destaque saude">✔️ Isso mesmo! ${D.fichas[alvo].funcao}</div>`;
      d.i++; setTimeout(rodada, 1500);
    } else {
      d.tent++; realcar(p, 0xff2222, .6); setTimeout(() => limparRealce(p), 700);
      fb.innerHTML = `<div class="destaque erro">✖️ Isso é: <b>${D.fichas[p].nome}</b>. Tente de novo!</div>`;
    }
  }

  /* ------------------------------ SAIBA MAIS ------------------------------ */
  function montarSaiba() {
    setTimeout(() => { const b = $("#bForcar"); if (b) b.onclick = forcarAtualizacao; }, 0);
    $("#aba-saiba").innerHTML = `
      <div class="cartao"><h3>🧭 Como usar</h3><ul class="lista">
        <li><b>Girar:</b> arraste · <b>Mover:</b> botão direito ou dois dedos · <b>Zoom:</b> roda do mouse ou pinça.</li>
        <li>Clique em uma estrutura para abrir a ficha e use <b>Ouvir</b> para escutar a explicação.</li>
        <li>Na lateral, mostre ou esconda partes e ajuste a transparência. Use o <b>Corte</b> para ver o interior.</li>
        <li>Em <b>Simular</b>, controle replicação viral, bactérias e antibióticos, resposta imune e vacina, propagação de doenças, saneamento, fabricação de vacinas e indicadores de saúde.</li></ul></div>
      <div class="cartao" id="cartaoInstalar"><h3>📲 Instalar como aplicativo</h3><ul class="lista">
        <li><b>Android (Chrome):</b> toque em <b>Instalar app</b> no topo ou, no menu ⋮, em <b>Instalar aplicativo</b> / <b>Adicionar à tela inicial</b>.</li>
        <li><b>iPhone e iPad (Safari):</b> toque em <b>Compartilhar</b> (quadrado com seta) e depois em <b>Adicionar à Tela de Início</b>.</li>
        <li><b>Computador (Chrome ou Edge):</b> clique em <b>Instalar app</b> no topo ou no ícone de instalar na barra de endereço.</li></ul>
        <p class="muted mini-txt">Depois de aberto uma vez com internet, o Microvida 3D funciona offline — ótimo para a sala de aula. Ele se atualiza sozinho quando há internet.</p>
        <p class="mini-txt">Versão instalada: <b>${VERSAO_APP}</b></p>
        <button class="btn" id="bForcar">🔄 Forçar atualização</button></div>
      <div class="cartao"><h3>📖 Glossário</h3><dl class="glossario">${D.glossario.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}</dl></div>
      <div class="cartao"><h3>🔎 Referências</h3><ul class="refs">${D.referencias.map(([t, d, u]) => `<li><b><a href="${u}" target="_blank" rel="noopener">${t}</a></b><br><small class="muted">${d}</small></li>`).join("")}</ul>
      <p class="muted mini-txt">O modelo “Corpo e defesas” usa malhas anatômicas reais (BodyParts3D e HuBMAP, CC BY 4.0); linfonodos, vasos, medula e placas de Peyer foram posicionados sobre trajetos medidos nessas malhas. Os demais modelos são didáticos, construídos por código; apenas a “Escala microscópica” mantém as proporções reais. Dados de cidades nas simulações são fictícios quando indicado.</p></div>`;
  }

  /* ------------------------------ BUSCA ------------------------------ */
  const busca = $("#busca"), sug = $("#sugestoes");
  const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  busca.oninput = () => {
    const q = semAcento(busca.value.trim()); if (q.length < 2) { sug.hidden = true; return; }
    const r = [];
    Object.entries(D.fichas).forEach(([k, f]) => { if (semAcento(f.nome).includes(q)) r.push({ t: f.nome, s: nomeModelo(f.modelo), a: () => selecionar(k, true) }); });
    D.modelos.forEach(m => { if (semAcento(m.nome).includes(q)) r.push({ t: m.nome, s: "Modelo 3D", a: () => carregarModelo(m.id) }); });
    SIMULACOES.lista.forEach(s => { if (semAcento(s.titulo + " " + s.desc).includes(q)) r.push({ t: s.titulo, s: "Simulação", a: () => abrirSim(s.id) }); });
    sug.innerHTML = r.slice(0, 8).map((x, i) => `<button class="sug" data-i="${i}">${x.t}<small>${x.s}</small></button>`).join("") || `<div class="sug muted">Nada encontrado</div>`;
    sug.hidden = false;
    sug.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { r[+b.dataset.i].a(); sug.hidden = true; busca.value = ""; });
  };
  busca.onblur = () => setTimeout(() => sug.hidden = true, 200);

  /* ------------------------------ ABAS ------------------------------ */
  function trocarAba(nome, semEfeito) {
    if (nome === "mais") nome = "habilidades";
    $$(".aba").forEach(b => b.classList.toggle("ativo", b.dataset.aba === nome));
    $$(".abas-movel button").forEach(b => b.classList.toggle("ativo", b.dataset.aba === nome || (b.dataset.aba === "mais" && (nome === "habilidades" || nome === "saiba"))));
    $$(".conteudo-aba").forEach(c => c.hidden = c.id !== "aba-" + nome);
    document.body.classList.remove("painel-fechado");
    if (semEfeito) return;
    if (nome !== "desafio" && est.desafio) { pararDesafio(); est.rotulos = true; $("#btnRotulos").classList.add("ativo"); }
    if (nome === "explorar" && est.modo === "sim") { carregarModelo(est.ultimoModelo); }
    if (nome === "simular" && est.modo !== "sim") montarSimular();
  }
  $$(".aba, .abas-movel button").forEach(b => b.onclick = () => trocarAba(b.dataset.aba));

  /* ------------------------------ FERRAMENTAS ------------------------------ */
  $("#btnRotulos").onclick = e => { est.rotulos = !est.rotulos; e.currentTarget.classList.toggle("ativo", est.rotulos); };
  $("#btnGirar").onclick = e => { ctl.autoRotate = !ctl.autoRotate; e.currentTarget.classList.toggle("ativo", ctl.autoRotate); };
  $("#btnReset").onclick = () => { if (est.modo === "modelo") { mostrarTudo(); definirCorte(false); vista(MODELOS[est.modeloId].vistas[0]); } else if (est.sim) vista(est.sim.vistas[0]); };
  $("#btnFoto").onclick = () => {
    renderer.render(cena, cam);
    const a = document.createElement("a"); a.href = renderer.domElement.toDataURL("image/png"); a.download = "microvida3d.png"; document.body.appendChild(a); a.click(); a.remove();
  };
  $("#btnTela").onclick = () => { const el = $(".palco-wrap"); if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => avisar("Tela cheia indisponível aqui.")); };
  $("#btnTema").onclick = () => { const t = document.documentElement.dataset.tema === "claro" ? "escuro" : "claro"; document.documentElement.dataset.tema = t; try { localStorage.setItem("mv3d_tema", t); } catch (e) { } };
  $("#btnLateral").onclick = () => document.body.classList.toggle("lateral-aberta");
  $("#btnFecharPainel").onclick = () => document.body.classList.add("painel-fechado");
  function fecharLateralMovel() { document.body.classList.remove("lateral-aberta"); }

  // lista de modelos na lateral
  $("#listaModelos").innerHTML = D.modelos.map(m => `<button class="mod-btn" data-mod="${m.id}"><span class="em">${m.em}</span><span><b>${m.nome}</b><small>${m.sub}</small></span></button>`).join("");
  $$(".mod-btn").forEach(b => b.onclick = () => { if (est.desafio) { pararDesafio(); est.rotulos = true; $("#btnRotulos").classList.add("ativo"); } carregarModelo(b.dataset.mod); trocarAba("explorar", true); fecharLateralMovel(); });

  /* ------------------------------ LAÇO ------------------------------ */
  const relogio = new T.Clock(); let tempo = 0;
  function laco() {
    requestAnimationFrame(laco);
    const dt = Math.min(relogio.getDelta(), 0.05); tempo += dt;
    if (est.voo) {
      const v = est.voo; v.t += dt / v.dur; const k = v.t >= 1 ? 1 : 1 - Math.pow(1 - v.t, 3);
      ctl.target.lerpVectors(v.a0, v.a1, k); cam.position.lerpVectors(v.p0, v.p1, k);
      if (v.t >= 1) est.voo = null;
    }
    ctl.update();
    if (est.atual && est.atual.atualizar) est.atual.atualizar(dt, tempo);
    if (est.sim && est.sim.atualizar) est.sim.atualizar(dt, tempo);
    renderer.render(cena, cam);
    atualizarRotulos();
  }

  /* ------------------------------ APLICATIVO (PWA) ------------------------------ */
  let pedidoInstalacao = null;
  const instalado = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); pedidoInstalacao = e; if (!instalado()) $("#btnInstalar").hidden = false; });
  window.addEventListener("appinstalled", () => { $("#btnInstalar").hidden = true; pedidoInstalacao = null; avisar("Microvida 3D instalado! Procure o ícone na tela inicial."); });
  if (ehIOS && !instalado()) $("#btnInstalar").hidden = false;
  $("#btnInstalar").onclick = async () => {
    if (pedidoInstalacao) { pedidoInstalacao.prompt(); const r = await pedidoInstalacao.userChoice; if (r.outcome === "accepted") $("#btnInstalar").hidden = true; pedidoInstalacao = null; return; }
    trocarAba("saiba"); setTimeout(() => { const c = $("#cartaoInstalar"); if (c) { c.scrollIntoView({ behavior: "smooth" }); c.classList.add("piscar"); } }, 50);
  };
  const VERSAO_APP = "7 · 15/11/2026";
  let tinhaControlador = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
        reg.update();
        // ao voltar para o app (ex.: reabrir o aplicativo instalado), procura versão nova
        document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update(); });
        setInterval(() => reg.update(), 15 * 60 * 1000);
      }).catch(() => { });
      let recarregou = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!tinhaControlador) { tinhaControlador = true; return; } // 1ª visita: só passou a funcionar offline
        if (recarregou) return; recarregou = true;
        try { sessionStorage.setItem("mv3d_atualizado", "1"); } catch (e) { }
        location.reload();
      });
    });
    try { if (sessionStorage.getItem("mv3d_atualizado")) { sessionStorage.removeItem("mv3d_atualizado"); setTimeout(() => avisar("✅ Microvida 3D atualizado para a versão mais recente."), 1200); } } catch (e) { }
  }
  async function forcarAtualizacao() {
    avisar("Baixando a versão mais recente…");
    try {
      if ("serviceWorker" in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); }
      if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
    } catch (e) { }
    location.replace(location.pathname + "?v=" + Date.now());
  }

  /* ------------------------------ INÍCIO ------------------------------ */
  montarSimular(); montarHabilidades(); montarQuiz(); montarDesafio(); montarSaiba();
  redimensionar();
  carregarModelo("virus", true);
  mostrarBoasVindas();
  carga.style.setProperty("--p", 1);
  laco();
  setTimeout(() => carga.classList.add("some"), 400);
  { const aba = new URLSearchParams(location.search).get("aba"); if (["simular", "quiz", "desafio", "habilidades", "saiba"].includes(aba)) trocarAba(aba); }
  setTimeout(() => $(".ajuda-gestos").classList.add("some"), 9000);
  setTimeout(() => { if (MODELOS.corpo.preparar) MODELOS.corpo.preparar().catch(() => { }); }, 2500);
  window.APP = { est, carregarModelo, abrirSim, selecionar, trocarAba, cam, ctl, cena };
})();
