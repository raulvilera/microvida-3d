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
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(redimensionar).observe(palco);

  /* ------------------------------ CÂMERA ------------------------------ */
  function voarPara(alvo, pos, dur) {
    est.voo = { t: 0, dur: dur ?? 0.9, a0: ctl.target.clone(), p0: cam.position.clone(), a1: alvo.clone(), p1: pos.clone() };
  }
  // afasta a câmera quando o palco é estreito (celular em pé, painel aberto)
  function ajustar(alvo, pos) { const f = Math.max(1, 1.08 / Math.max(cam.aspect, .3)); return pos.clone().sub(alvo).multiplyScalar(f).add(alvo); }
  function vista(v) {
    if (!v) return;
    const a = new T.Vector3(...v[2]); voarPara(a, ajustar(a, new T.Vector3(...v[1])));
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
    limparPalco();
    const def = MODELOS[id], md = def.construir();
    est.modo = "modelo"; est.modeloId = id; est.ultimoModelo = id; est.atual = md;
    cena.add(md.raiz);
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
    const op = est.opac[p], vis = est.visivel[p] && op > 0.02;
    est.mats[p].forEach(m => { const o = m.userData.baseOp * op; m.opacity = o; m.transparent = o < 0.999; m.depthWrite = o >= 0.6 ? m.userData.dw0 : false; });
    (est.atual.partes[p] || []).forEach(me => me.visible = vis);
  }
  function mostrarTudo() { Object.keys(est.mats).forEach(p => { est.visivel[p] = true; est.opac[p] = 1; aplicarParte(p); }); listarPartes(); }

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
  function criarRotulos(lista) {
    const box = $("#rotulos"); box.innerHTML = '<svg class="linhas-rot" aria-hidden="true"></svg>'; est.rotEls = [];
    est.svgRot = box.querySelector("svg");
    lista.forEach(r => {
      const el = document.createElement("div"); el.className = "rot"; el.textContent = r.txt; el.style.setProperty("--c", r.cor || "#5eead4");
      if (r.parte) el.onclick = () => selecionar(r.parte, false);
      box.appendChild(el); r.el = el; r.tam = null; est.rotEls.push(r);
    });
  }
  /* Rótulos sem sobreposição: cada rótulo tenta ficar logo acima do seu ponto; se bater
     em outro já posicionado, procura um lugar livre acima/abaixo/ao lado e liga-se ao
     ponto por uma linha. Se não houver espaço, fica oculto (o selecionado sempre aparece). */
  const _v = new T.Vector3();
  function atualizarRotulos() {
    const w = palco.clientWidth, h = palco.clientHeight, cand = [];
    est.rotEls.forEach(r => {
      let vis = est.rotulos;
      if (r.parte && est.modo === "modelo") vis = vis && est.visivel[r.parte] && est.opac[r.parte] > .05;
      if (r.local && est.atual) { _v.copy(r.local); est.atual.raiz.localToWorld(_v); }
      else if (r.obj) { r.obj.getWorldPosition(_v); if (r.dy) _v.y += r.dy; if (!r.obj.visible) vis = false; }
      else if (r.pos) _v.copy(r.pos);
      if (r.oculto) vis = false;
      if (vis) { _v.project(cam); if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) vis = false; }
      if (r.atualizarTxt) { const t = r.atualizarTxt(); if (t !== r.el.textContent) { r.el.textContent = t; r.tam = null; } }
      r.el.classList.toggle("sel", !!r.parte && r.parte === est.selecionado);
      if (!vis) { r.el.style.display = "none"; return; }
      r.el.style.display = "";
      if (!r.tam || !r.tam[0]) r.tam = [r.el.offsetWidth, r.el.offsetHeight];
      cand.push({ r, ax: (_v.x * .5 + .5) * w, ay: (-_v.y * .5 + .5) * h, z: _v.z });
    });
    // prioridade: selecionado primeiro, depois os mais próximos da câmera
    cand.sort((a, b) => (b.r.parte === est.selecionado) - (a.r.parte === est.selecionado) || a.z - b.z);
    const ocup = [], pad = 4, linhas = [];
    const bate = (x, y, cw, ch) => ocup.some(o => x < o[2] + pad && x + cw + pad > o[0] && y < o[3] + pad && y + ch + pad > o[1]);
    cand.forEach(c => {
      const [cw, ch] = c.r.tam, gap = 12;
      const ax = c.ax, ay = c.ay, up = ay - gap - ch, st = ch + 5;
      const tent = [[ax - cw / 2, up], [ax - cw / 2, up - st], [ax + 10, ay - ch / 2], [ax - cw - 10, ay - ch / 2], [ax - cw / 2, ay + gap],
        [ax - cw / 2, up - 2 * st], [ax + 10, up], [ax - cw - 10, up], [ax + 10, ay + gap], [ax - cw - 10, ay + gap], [ax - cw / 2, ay + gap + st], [ax - cw / 2, up - 3 * st]];
      let pos = null;
      for (let [x, y] of tent) {
        x = Math.max(2, Math.min(w - cw - 2, x)); y = Math.max(2, Math.min(h - ch - 2, y));
        if (!bate(x, y, cw, ch)) { pos = [x, y]; break; }
      }
      if (!pos && c.r.parte === est.selecionado) pos = [Math.max(2, Math.min(w - cw - 2, c.ax - cw / 2)), Math.max(2, c.ay - gap - ch)];
      if (!pos) { c.r.el.style.display = "none"; return; }
      ocup.push([pos[0], pos[1], pos[0] + cw, pos[1] + ch]);
      c.r.el.style.transform = `translate(${pos[0]}px, ${pos[1]}px)`;
      const lx = Math.max(pos[0] + 6, Math.min(pos[0] + cw - 6, c.ax)), ly = c.ay < pos[1] ? pos[1] : c.ay > pos[1] + ch ? pos[1] + ch : pos[1] + ch / 2;
      linhas.push(`<line x1="${c.ax.toFixed(1)}" y1="${c.ay.toFixed(1)}" x2="${lx.toFixed(1)}" y2="${ly.toFixed(1)}" stroke="${c.r.el.style.getPropertyValue("--c")}"/><circle cx="${c.ax.toFixed(1)}" cy="${c.ay.toFixed(1)}" r="3.2" fill="${c.r.el.style.getPropertyValue("--c")}"/>`);
    });
    if (est.svgRot) est.svgRot.innerHTML = linhas.join("");
  }

  /* ------------------------------ SELEÇÃO ------------------------------ */
  function realcar(p, cor, int) { (est.mats[p] || []).forEach(m => { m.emissive.setHex(cor); m.emissiveIntensity = int; }); }
  function limparRealce(p) { (est.mats[p] || []).forEach(m => { m.emissive.setHex(m.userData.em0); m.emissiveIntensity = m.userData.ei0; }); }
  function selecionar(p, voar) {
    if (!D.fichas[p]) return;
    const f = D.fichas[p];
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
  renderer.domElement.addEventListener("pointerdown", e => { baixo = [e.clientX, e.clientY]; ctl.autoRotate = false; $("#btnGirar").classList.remove("ativo"); $(".ajuda-gestos").classList.add("some"); });
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
    corpo: "O sistema imune inclui órgãos linfoides: medula óssea e timo (primários), linfonodos, baço e tonsilas (secundários). A pele é a primeira barreira.",
    mosquito: "A fêmea do Aedes aegypti transmite os vírus da dengue, zika, chikungunya e febre amarela urbana. Repare nas listras brancas e na ‘lira’ do tórax."
  };
  function mostrarModeloInfo(id) {
    if (est.desafio) return;
    const m = D.modelos.find(x => x.id === id);
    info.innerHTML = `<div class="cartao"><div class="etiqueta" style="--c:var(--acento)">${m.aula}</div><h2>${m.em} ${m.nome}</h2><p>${introModelo[id]}</p>
      <p class="muted mini-txt">Clique em uma estrutura no modelo ou em um nome abaixo para abrir a ficha.</p>
      <div class="acoes"><button class="btn" id="bOuvirM">🔊 Ouvir</button></div></div>${partesIrmas(id)}`;
    $("#bOuvirM").onclick = () => falar(introModelo[id].replace(/<[^>]+>/g, ""));
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
    $("#aba-saiba").innerHTML = `
      <div class="cartao"><h3>🧭 Como usar</h3><ul class="lista">
        <li><b>Girar:</b> arraste · <b>Mover:</b> botão direito ou dois dedos · <b>Zoom:</b> roda do mouse ou pinça.</li>
        <li>Clique em uma estrutura para abrir a ficha e use <b>Ouvir</b> para escutar a explicação.</li>
        <li>Na lateral, mostre ou esconda partes e ajuste a transparência. Use o <b>Corte</b> para ver o interior.</li>
        <li>Em <b>Simular</b>, controle replicação viral, bactérias e antibióticos, resposta imune e vacina, propagação de doenças, saneamento, fabricação de vacinas e indicadores de saúde.</li></ul></div>
      <div class="cartao"><h3>📖 Glossário</h3><dl class="glossario">${D.glossario.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}</dl></div>
      <div class="cartao"><h3>🔎 Referências</h3><ul class="refs">${D.referencias.map(([t, d, u]) => `<li><b><a href="${u}" target="_blank" rel="noopener">${t}</a></b><br><small class="muted">${d}</small></li>`).join("")}</ul>
      <p class="muted mini-txt">Os modelos são didáticos e esquemáticos, construídos por código. Formas e cores são representações; apenas o modelo “Escala microscópica” mantém as proporções reais. Dados de cidades nas simulações são fictícios quando indicado.</p></div>`;
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

  /* ------------------------------ INÍCIO ------------------------------ */
  montarSimular(); montarHabilidades(); montarQuiz(); montarDesafio(); montarSaiba();
  redimensionar();
  carregarModelo("virus", true);
  mostrarBoasVindas();
  carga.style.setProperty("--p", 1);
  laco();
  setTimeout(() => carga.classList.add("some"), 400);
  setTimeout(() => $(".ajuda-gestos").classList.add("some"), 9000);
  window.APP = { est, carregarModelo, abrirSim, selecionar, trocarAba, cam, ctl, cena };
})();
