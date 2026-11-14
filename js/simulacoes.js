/* =========================================================================
   MICROVIDA 3D — Simulações em 3D
   Cada simulação: { id, titulo, html, iniciar(ctx) -> { raiz, vistas, atualizar, destruir } }
   ========================================================================= */
(function () {
  const T = THREE;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const lerp = (a, b, k) => a + (b - a) * k;
  const fmt = n => String(n).replace(".", ",");

  /* ---------- gráfico de linhas simples ---------- */
  function grafico(cv, series, o) {
    o = o || {};
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const cs = getComputedStyle(document.documentElement), muted = cs.getPropertyValue("--muted").trim() || "#93a8c8";
    const L = 30, B = h - 16, A = 10, W = w - L - 8;
    g.strokeStyle = muted; g.globalAlpha = .5; g.beginPath(); g.moveTo(L, A); g.lineTo(L, B); g.lineTo(L + W, B); g.stroke(); g.globalAlpha = 1;
    const max = o.max || Math.max(1, ...series.flatMap(s => s.d));
    const n = Math.max(o.minN || 60, ...series.map(s => s.d.length));
    g.fillStyle = muted; g.font = "10px sans-serif"; g.fillText(Math.round(max), 2, A + 8); g.fillText("0", 18, B); if (o.rotX) g.fillText(o.rotX, L + W - 60, h - 3);
    if (o.linha) { const y = B - o.linha.v / max * (B - A); g.setLineDash([4, 4]); g.strokeStyle = o.linha.cor; g.beginPath(); g.moveTo(L, y); g.lineTo(L + W, y); g.stroke(); g.setLineDash([]); g.fillStyle = o.linha.cor; g.fillText(o.linha.txt, L + 4, y - 3); }
    series.forEach(s => { if (s.d.length < 2) return; g.strokeStyle = s.cor; g.lineWidth = 2.2; g.beginPath();
      s.d.forEach((v, i) => { const x = L + i / (n - 1) * W, y = B - Math.min(v, max) / max * (B - A); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.lineWidth = 1; });
  }
  function medidor(id, rot, val) { return `<div><small>${rot}</small><b id="${id}">${val}</b></div>`; }
  function chao(r, cor, op) { const m = GEO.malha(new T.CircleGeometry(r, 64), GEO.mat(cor, { op: op ?? 1, rough: .9 })); m.rotation.x = -Math.PI / 2; return m; }

  const lista = [];

  /* =====================================================================
     1. CICLO DE REPLICAÇÃO VIRAL
     ===================================================================== */
  lista.push({
    id: "replicacao", em: "🧬", titulo: "Replicação viral", hab: "EF07CI10", aulas: "Aulas 2 e 3",
    desc: "Acompanhe, etapa por etapa, como um vírus invade uma célula e a obriga a fabricar novos vírus.",
    html: `<div class="etapas" id="etp">${"<span></span>".repeat(6)}</div>
      <div class="destaque" id="txt"></div>
      <div class="linha-btn"><button class="btn" id="ant">◀ Anterior</button><button class="btn prim" id="prox">Próxima etapa ▶</button><button class="btn" id="auto">⏯ Automático</button></div>
      <details><summary>Entenda</summary><p>Fora de uma célula, o vírus é inerte: não se alimenta, não cresce e não se reproduz. Por isso é chamado de <b>parasita intracelular obrigatório</b> e, pela teoria celular, não é considerado um ser vivo.</p><p>Cada tipo de vírus reconhece células específicas: o da gripe infecta células do sistema respiratório; o HIV, linfócitos T.</p></details>
      <div class="cartao pequeno" style="margin-top:10px" id="pergR"><b>Pense:</b> por que antibióticos não funcionam contra vírus?
        <div class="opcoes" style="margin-top:8px"><button class="opcao" data-c="0">Porque o vírus é grande demais</button><button class="opcao" data-c="1">Porque o vírus não tem célula, parede celular nem ribossomos próprios para o antibiótico atacar</button></div><div id="fbR"></div></div>`,
    iniciar(ctx) {
      const G = ctx.G, raiz = new T.Group(), R = G.rng(5);
      const memMat = G.mat(0xfda4af, { op: .26, side: T.DoubleSide, rough: .3 });
      const memb = G.malha(G.deformar(new T.IcosahedronGeometry(9, 5), .25, .4), memMat); raiz.add(memb);
      memb.userData.info = "Célula hospedeira: o vírus usa a ‘maquinaria’ dela (ribossomos, energia e matéria-prima) para se multiplicar.";
      const nuc = G.malha(G.deformar(new T.IcosahedronGeometry(2.8, 3), .1, .8), G.mat(0x9d174d), V(-2.5, -1.5, -1)); raiz.add(nuc);
      nuc.userData.info = "Núcleo da célula hospedeira, onde fica o DNA dela.";
      const rib = new T.InstancedMesh(new T.SphereGeometry(.12, 6, 4), G.mat(0xfde68a), 220), d = new T.Object3D();
      for (let i = 0; i < 220; i++) { const p = V(R() - .5, R() - .5, R() - .5).normalize().multiplyScalar(3.6 + R() * 4.6); d.position.copy(p); d.updateMatrix(); rib.setMatrixAt(i, d.matrix); }
      raiz.add(rib);
      const P = V(.75, .45, .45).normalize();
      const objs = [];
      const novo = (obj, estados) => { raiz.add(obj); const o = { obj, estados, esc: 0 }; objs.push(o); obj.scale.setScalar(.001); return o; };
      // estados: função(etapa) -> [pos, escala]
      const v0 = novo(G.vírusMini(1.1, 0xfacc15), e => e === 0 ? [V(16, 6, 5), 1] : e === 1 ? [P.clone().multiplyScalar(10.4), 1] : e === 2 ? [P.clone().multiplyScalar(7), .55] : [P.clone().multiplyScalar(6.5), 0]);
      v0.obj.traverse(o => o.userData.info = "Vírus: espículas, capsídeo e material genético.");
      const rna0 = novo(G.novelo(.7, 14, 2, .07, G.mat(0xf472b6, { emis: 0xbe185d, ei: .7 })), e => e < 2 ? [P.clone().multiplyScalar(7), 0] : e === 2 ? [P.clone().multiplyScalar(6.4), 1.3] : e === 3 ? [V(0, .5, 2), 1.3] : [V(0, .5, 2), 0]);
      const copias = [], proteinas = [], novos = [];
      const Q = G.fibonacci(10).map(n => n.multiplyScalar(5.6));
      for (let i = 0; i < 10; i++) {
        const sp = V(R() - .5, R() - .5, R() - .5).normalize().multiplyScalar(3.5 + R() * 2);
        copias.push(novo(G.novelo(.55, 10, 10 + i, .06, G.mat(0xf472b6, { emis: 0xbe185d, ei: .7 })), e => e < 3 ? [V(0, .5, 2), 0] : e === 3 ? [sp, 1] : e === 4 ? [Q[i], .5] : [Q[i], 0]));
      }
      for (let j = 0; j < 40; j++) {
        const sp = V(R() - .5, R() - .5, R() - .5).normalize().multiplyScalar(3.8 + R() * 3.8), k = j % 10;
        proteinas.push(novo(G.malha(new T.IcosahedronGeometry(.28, 0), G.mat(0xa78bfa, { flat: true })), e => e < 3 ? [sp, 0] : e === 3 ? [sp, 1] : [Q[k], 0]));
      }
      for (let k = 0; k < 10; k++) novos.push(novo(G.vírusMini(.85, 0xfacc15), e => e < 4 ? [Q[k], 0] : e === 4 ? [Q[k], 1] : [Q[k].clone().setLength(20 + k % 3 * 2), 1]));
      const textos = [
        "<b>1. Vírus livre.</b> Fora da célula, o vírus não se reproduz nem tem metabolismo. Ele precisa encontrar uma célula hospedeira.",
        "<b>2. Adsorção.</b> As espículas do vírus se encaixam em receptores específicos da membrana da célula, como chave e fechadura.",
        "<b>3. Penetração.</b> O vírus entra na célula e o capsídeo se desfaz, liberando o material genético (RNA) no citoplasma.",
        "<b>4. Replicação.</b> O material genético viral comanda a célula: ela passa a fabricar cópias do RNA do vírus (rosa) e proteínas virais (roxo) em vez das suas próprias.",
        "<b>5. Montagem.</b> As proteínas formam novos capsídeos, que envolvem as cópias do material genético: surgem novos vírus.",
        "<b>6. Liberação.</b> Os novos vírus saem da célula — às vezes rompendo-a (lise). Cada um pode infectar outra célula, e a infecção se espalha pelo corpo."
      ];
      let et = 0, auto = false, tAuto = 0;
      const ir = n => { et = Math.max(0, Math.min(5, n)); ctx.$("#txt").innerHTML = textos[et];
        ctx.cartao.querySelectorAll("#etp span").forEach((s, i) => s.classList.toggle("feito", i <= et));
        ctx.$("#ant").disabled = et === 0; ctx.$("#prox").disabled = et === 5;
        if (et === 0) ctx.voar([0, 0, 0], [6, 6, 34]); if (et === 1) ctx.voar([5, 3, 3], [16, 10, 18]); if (et === 3) ctx.voar([0, 0, 0], [3, 3, 24]); if (et === 5) ctx.voar([0, 0, 0], [8, 10, 42]); };
      ctx.$("#ant").onclick = () => ir(et - 1); ctx.$("#prox").onclick = () => ir(et + 1);
      ctx.$("#auto").onclick = e => { auto = !auto; e.target.classList.toggle("ativo", auto); if (auto && et === 5) ir(0); tAuto = 0; };
      ctx.cartao.querySelectorAll("#pergR .opcao").forEach(b => b.onclick = () => { const ok = b.dataset.c === "1"; ctx.cartao.querySelectorAll("#pergR .opcao").forEach(x => { x.disabled = true; if (x.dataset.c === "1") x.classList.add("certa"); else if (x === b) x.classList.add("errada"); });
        ctx.$("#fbR").innerHTML = `<div class="destaque ${ok ? "saude" : "erro"}">${ok ? "Isso! " : ""}Antibióticos atacam estruturas das bactérias (parede celular, ribossomos bacterianos). O vírus usa a célula do hospedeiro, então o antibiótico não tem onde agir.</div>`; });
      ctx.rotulos([{ txt: "Célula hospedeira", obj: memb, dy: 9.3, cor: "#fda4af" }, { txt: "Núcleo", obj: nuc, dy: 2.9, cor: "#be185d" }, { txt: "Vírus", obj: v0.obj, dy: 1.8, cor: "#facc15" }, { txt: "RNA viral", obj: rna0.obj, dy: 1, cor: "#f472b6" }, { txt: "Proteínas virais", obj: proteinas[3].obj, dy: .5, cor: "#a78bfa" }, { txt: "Novos vírus", obj: novos[0].obj, dy: 1.5, cor: "#facc15" }]);
      ir(0);
      return {
        raiz, vistas: [["Visão geral", [6, 6, 34], [0, 0, 0]], ["Membrana", [16, 10, 18], [5, 3, 3]], ["Por dentro", [3, 3, 20], [0, 0, 0]]],
        atualizar(dt, t) {
          const k = Math.min(1, dt * 2.2);
          objs.forEach(o => { const [p, e] = o.estados(et); o.obj.position.lerp(p, k); o.esc = lerp(o.esc, e, k); o.obj.scale.setScalar(Math.max(.001, o.esc)); o.obj.visible = o.esc > .03; o.obj.rotation.y += dt * .4; });
          if (et === 0) v0.obj.position.y += Math.sin(t * 2) * .01;
          memMat.color.lerp(new T.Color(et === 5 ? 0xef4444 : 0xfda4af), k * .5);
          memb.rotation.y += dt * .03;
          if (auto) { tAuto += dt; if (tAuto > 4.5) { tAuto = 0; if (et < 5) ir(et + 1); else { auto = false; ctx.$("#auto").classList.remove("ativo"); } } }
        }
      };
    }
  });

  /* =====================================================================
     2. BACTÉRIAS: FISSÃO BINÁRIA E RESISTÊNCIA A ANTIBIÓTICOS
     ===================================================================== */
  lista.push({
    id: "bacterias", em: "🧫", titulo: "Bactérias e antibióticos", hab: "EF07CI10", aulas: "Aulas 4 e 5",
    desc: "Veja as bactérias se multiplicarem por fissão binária numa placa de Petri e descubra o que acontece quando o antibiótico é interrompido antes do fim.",
    html: `<div class="medidores">${medidor("mTot", "Bactérias", 0)}${medidor("mSen", "Sensíveis", 0)}${medidor("mRes", "Resistentes", 0)}${medidor("mGer", "Gerações", 0)}</div>
      <canvas class="grafico" id="gB"></canvas>
      <div class="legenda"><span><i style="background:#5eead4"></i>sensíveis</span><span><i style="background:#e879f9"></i>resistentes</span></div>
      <div class="linha-btn"><button class="btn prim" id="bPlay">▶ Iniciar</button><button class="btn" id="bReset">↺ Reiniciar</button></div>
      <div class="linha-btn"><button class="btn" id="bCompleto">💊 Antibiótico até o fim</button><button class="btn" id="bInterr">⚠️ Parar o antibiótico no meio</button></div>
      <div class="destaque" id="txt">Clique em <b>Iniciar</b>. Cada bactéria cresce e se divide em duas: é a <b>fissão binária</b>, uma reprodução assexuada.</div>
      <details><summary>Entenda</summary><p>Numa população de bactérias, por mutação, algumas podem nascer mais resistentes a um antibiótico. Se o tratamento é interrompido, as sensíveis morrem, mas as resistentes sobrevivem e se multiplicam: a nova população fica resistente.</p><p>Por isso: use antibiótico só com receita médica, na dose e pelo tempo indicados. E lembre: antibiótico não age contra vírus.</p></details>`,
    iniciar(ctx) {
      const G = ctx.G, raiz = new T.Group();
      raiz.add(G.malha(new T.CylinderGeometry(12.4, 12.4, 1.6, 64, 1, true), G.mat(0xbfdbfe, { op: .25, side: T.DoubleSide, rough: .1 }), V(0, .3, 0)));
      raiz.add(G.malha(new T.CylinderGeometry(12.4, 12.4, .2, 64), G.mat(0xbfdbfe, { op: .3, rough: .1 }), V(0, -.5, 0)));
      const agar = G.malha(new T.CylinderGeometry(12.1, 12.1, .6, 64), G.mat(0xe0b252, { op: .9, rough: .7 }), V(0, -.1, 0)); raiz.add(agar);
      agar.userData.info = "Ágar: meio de cultura com nutrientes onde as bactérias crescem no laboratório.";
      const nuvem = G.malha(new T.CylinderGeometry(12, 12, 1.2, 64), G.mat(0x38bdf8, { op: .0, dw: false }), V(0, .6, 0)); raiz.add(nuvem);
      const MAX = 700, CAP = 520;
      const inst = new T.InstancedMesh((() => { const g = new T.CapsuleGeometry(.17, .5, 4, 8); g.rotateZ(Math.PI / 2); return g; })(), G.mat(0xffffff, { rough: .4 }), MAX);
      inst.instanceMatrix.setUsage(T.DynamicDrawUsage); raiz.add(inst);
      const cS = new T.Color(0x5eead4), cR = new T.Color(0xd946ef), cM = new T.Color(0x475569), d = new T.Object3D();
      let bs = [], rodando = false, ger = 0, ab = null, hist = { s: [], r: [] }, tHist = 0, jaInterrompeu = false;
      function reset() { bs = []; for (let i = 0; i < 6; i++) bs.push(nova((Math.random() - .5) * 6, (Math.random() - .5) * 6, .05)); ger = 0; ab = null; hist = { s: [], r: [] }; jaInterrompeu = false; rodando = false; ctx.$("#bPlay").textContent = "▶ Iniciar";
        ctx.$("#txt").innerHTML = "Clique em <b>Iniciar</b>. Cada bactéria cresce e se divide em duas: é a <b>fissão binária</b>, uma reprodução assexuada."; }
      function nova(x, z, r) { return { x, z, a: Math.random() * 6.28, idade: Math.random() * .8, ciclo: 1 + Math.random() * .5, r, morta: 0, g: 0 }; }
      reset();
      ctx.$("#bPlay").onclick = e => { rodando = !rodando; e.target.textContent = rodando ? "⏸ Pausar" : "▶ Continuar"; };
      ctx.$("#bReset").onclick = reset;
      const tratar = tipo => { if (!bs.length) return; ab = { tipo, t: 0, dur: tipo === "completo" ? 8 : 2.6 }; rodando = true; ctx.$("#bPlay").textContent = "⏸ Pausar";
        ctx.$("#txt").innerHTML = tipo === "completo" ? "💊 Antibiótico aplicado pelo tempo indicado pelo médico…" : "💊 Antibiótico aplicado… mas a pessoa se sentiu melhor e <b>parou no meio</b>!"; };
      ctx.$("#bCompleto").onclick = () => tratar("completo");
      ctx.$("#bInterr").onclick = () => tratar("interrompido");
      function contar() { let s = 0, r = 0; bs.forEach(b => { if (!b.morta) { if (b.r > .5) r++; else s++; } }); return [s, r]; }
      return {
        raiz, vistas: [["Placa de Petri", [0, 20, 21], [0, 0, 0]], ["Lupa", [2, 4, 6], [0, 0, 0]], ["De cima", [0, 26, .1], [0, 0, 0]]],
        atualizar(dt) {
          if (rodando) {
            const vivos = bs.filter(b => !b.morta).length, lot = Math.max(0, 1 - vivos / CAP);
            const novas = [];
            bs.forEach(b => {
              if (b.morta) { b.morta += dt; return; }
              if (!ab) { b.idade += dt * (0.25 + lot); if (b.idade > b.ciclo && bs.length + novas.length < MAX && lot > 0.01) {
                b.idade = 0; b.g++; ger = Math.max(ger, b.g);
                let rr = b.r; if (rr < .5 && Math.random() < .012) rr = .95;
                const ang = Math.random() * 6.28, dd = .55 + Math.random() * .3; let x = b.x + Math.cos(ang) * dd, z = b.z + Math.sin(ang) * dd;
                const rr2 = Math.hypot(x, z); if (rr2 > 11.4) { x *= 11.4 / rr2; z *= 11.4 / rr2; }
                novas.push(Object.assign(nova(x, z, rr), { g: b.g })); } }
              else { const taxa = 2.6 * (1 - b.r); if (Math.random() < taxa * dt) b.morta = .001; }
            });
            bs = bs.concat(novas).filter(b => b.morta < .8);
            if (ab) { ab.t += dt; if (ab.t >= ab.dur) {
              const [s, r] = contar();
              if (ab.tipo === "completo") {
                if (s + r <= 12) { bs.forEach(b => b.morta = b.morta || .001); ctx.$("#txt").innerHTML = "✅ <b>Tratamento completo:</b> o antibiótico eliminou quase todas as bactérias e as poucas restantes foram destruídas pelas defesas do corpo. Infecção curada!"; }
                else ctx.$("#txt").innerHTML = `⚠️ Mesmo com o tratamento completo, <b>${r}</b> bactérias resistentes sobreviveram: esse antibiótico já não funciona bem. O médico precisará trocar o medicamento. Isso mostra o perigo de criar resistência!`;
              } else { jaInterrompeu = true; ctx.$("#txt").innerHTML = `❌ <b>Tratamento interrompido:</b> as sensíveis morreram, mas sobraram ${s + r} bactérias — proporcionalmente muito mais resistentes (rosa). Continue e veja a população voltar a crescer… agora resistente. Depois tente o antibiótico de novo!`; }
              ab = null; } }
            tHist += dt; if (tHist > .25) { tHist = 0; const [s, r] = contar(); hist.s.push(s); hist.r.push(r); if (hist.s.length > 240) { hist.s.shift(); hist.r.shift(); } }
          }
          nuvem.material.opacity = lerp(nuvem.material.opacity, ab ? .22 : 0, .1); nuvem.visible = nuvem.material.opacity > .01;
          bs.forEach((b, i) => { const cresc = 1 + Math.min(b.idade / b.ciclo, 1) * .5; d.position.set(b.x, .3, b.z); d.rotation.set(0, b.a, 0); d.scale.set(cresc * (b.morta ? 1 - b.morta : 1), 1, 1); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); inst.setColorAt(i, b.morta ? cM : b.r > .5 ? cR : cS); });
          inst.count = bs.length; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
          const [s, r] = contar();
          ctx.$("#mTot").textContent = s + r; ctx.$("#mSen").textContent = s; ctx.$("#mRes").textContent = r; ctx.$("#mGer").textContent = ger;
          grafico(ctx.$("#gB"), [{ d: hist.s, cor: "#5eead4" }, { d: hist.r, cor: "#e879f9" }], { max: CAP, minN: 120, rotX: "tempo →" });
          if (rodando && !ab && s + r === 0 && bs.length === 0) { rodando = false; ctx.$("#bPlay").textContent = "▶ Iniciar"; }
        }
      };
    }
  });

  /* =====================================================================
     3. RESPOSTA IMUNE E VACINA
     ===================================================================== */
  lista.push({
    id: "imune", em: "🛡️", titulo: "Resposta imune e vacina", hab: "EF07CI10", aulas: "Aulas 8, 9 e 10",
    desc: "Vírus entram por uma ferida. Macrófagos atacam primeiro; depois, plasmócitos liberam anticorpos. Compare uma pessoa sem e com vacina.",
    html: `<div class="medidores">${medidor("mV", "Vírus", 0)}${medidor("mA", "Anticorpos", 0)}${medidor("mT", "Tempo (dias)", 0)}${medidor("mMem", "Memória imunológica", "não")}</div>
      <canvas class="grafico" id="gI"></canvas>
      <div class="legenda"><span><i style="background:#fb7185"></i>vírus</span><span><i style="background:#4ade80"></i>anticorpos</span></div>
      <div class="linha-btn"><button class="btn" id="bVac">💉 Aplicar vacina</button><button class="btn prim" id="bInf">🦠 Infecção pelo vírus</button><button class="btn" id="bReset">↺ Nova pessoa</button></div>
      <div class="destaque" id="txt">Comece pela <b>infecção</b> em uma pessoa sem vacina. Depois clique em <b>Nova pessoa</b>, aplique a <b>vacina</b>, espere a resposta e só então provoque a infecção. Compare!</div>
      <details><summary>Entenda</summary><p><b>1ª linha:</b> pele e mucosas impedem a entrada (aqui, o vírus entra por uma ferida). <b>2ª linha — imunidade inata:</b> macrófagos englobam invasores (fagocitose), de forma rápida e não específica. <b>3ª linha — imunidade adaptativa:</b> linfócitos B viram plasmócitos e produzem anticorpos específicos; ficam <b>células de memória</b>.</p><p>A vacina apresenta ao corpo um antígeno inofensivo (vírus inativado, enfraquecido ou só uma parte dele). O corpo produz anticorpos e memória <b>sem ficar doente</b>: é a imunização ativa artificial.</p></details>`,
    iniciar(ctx) {
      const G = ctx.G, raiz = new T.Group(), R = Math.random;
      const pele = new T.Group(), mp = G.mat(0xf9c6a7, { rough: .8 });
      pele.add(G.malha(new T.BoxGeometry(14, 1.6, 12), mp, V(-8, 6.8, 0)), G.malha(new T.BoxGeometry(14, 1.6, 12), mp, V(8, 6.8, 0)));
      pele.add(G.malha(new T.BoxGeometry(30, .4, 12), G.mat(0xd97757, { rough: .9 }), V(0, 7.8, 0)));
      pele.traverse(o => o.userData.info = "Pele: primeira linha de defesa. A ferida no meio é a porta de entrada do vírus.");
      raiz.add(pele);
      const vaso = G.malha(new T.CylinderGeometry(2.2, 2.2, 32, 24, 1, true), G.mat(0xef4444, { op: .25, side: T.DoubleSide }), V(0, -5.5, 0), [0, 0, Math.PI / 2]); raiz.add(vaso);
      vaso.userData.info = "Vaso sanguíneo: por ele chegam as células de defesa.";
      const hems = []; for (let i = 0; i < 26; i++) { const h = G.malha(new T.SphereGeometry(.5, 12, 8), G.mat(0xdc2626), V(-15 + R() * 30, -5.5 + (R() - .5) * 2.4, (R() - .5) * 2.4), null, [1, .4, 1]); h.userData.info = "Hemácia (glóbulo vermelho)."; raiz.add(h); hems.push(h); }
      const tecido = G.malha(new T.BoxGeometry(30, 12, 12), G.mat(0xfecdd3, { op: .06, dw: false }), V(0, 0, 0)); raiz.add(tecido);
      const virs = [], abs = [], macs = [], plas = [];
      const geoAb = G.anticorpoGeo(.16, G.mat(0x4ade80, { emis: 0x166534, ei: .4 }));
      function novoVirus(x, y, z, vacina) {
        const g = G.vírusMini(.38, vacina ? 0x94a3b8 : 0xfb7185); g.position.set(x, y, z); raiz.add(g);
        g.traverse(o => o.userData.info = vacina ? "Antígeno da vacina: vírus inativado. Não se multiplica nem causa doença, mas ensina o sistema imune." : "Vírus invasor: entra pela ferida e se multiplica nas células do tecido.");
        const v = { g, vel: V(R() - .5, R() - .5, R() - .5), neut: false, vac: !!vacina, tRep: 1 + R() * 2 }; virs.push(v); return v;
      }
      for (let i = 0; i < 3; i++) {
        const g = new T.Group(); g.add(G.malha(G.deformar(new T.IcosahedronGeometry(1.2, 3), .3, 1.6), G.mat(0xf59e0b, { op: .85 })));
        g.add(G.malha(new T.SphereGeometry(.45, 12, 8), G.mat(0x92400e), V(.3, .1, .4)));
        g.position.set(-8 + i * 8, -5.5, 0); g.traverse(o => o.userData.parte = "macrofago"); raiz.add(g);
        macs.push({ g, alvo: null, cd: 0, ativo: false, comidos: 0 });
      }
      let estado, hist, tempo, tHist, memoria = false, fase = "idle", tResp = 0, respostaAtiva = false, maxV = 0, vacinou = false;
      function limparAgentes() { virs.forEach(v => raiz.remove(v.g)); virs.length = 0; abs.forEach(a => raiz.remove(a.g)); abs.length = 0; plas.forEach(p => raiz.remove(p.g)); plas.length = 0;
        macs.forEach((m, i) => { m.g.position.set(-8 + i * 8, -5.5, 0); m.ativo = false; m.alvo = null; }); }
      function reset(nova) { limparAgentes(); hist = { v: [], a: [] }; tempo = 0; tHist = 0; fase = "idle"; respostaAtiva = false; maxV = 0; if (nova) { memoria = false; vacinou = false; ctx.$("#txt").innerHTML = "Nova pessoa, <b>sem vacina</b> e sem memória imunológica para este vírus."; } }
      reset(true);
      function iniciar(vacina) {
        abs.forEach(a => raiz.remove(a.g)); abs.length = 0; plas.forEach(p => raiz.remove(p.g)); plas.length = 0;
        hist = { v: [], a: [] }; tempo = 0; maxV = 0; respostaAtiva = false;
        const n = vacina ? 8 : 5; for (let i = 0; i < n; i++) novoVirus((R() - .5) * 1.5, 7 + R(), (R() - .5) * 2, vacina);
        fase = vacina ? "vacina" : "infeccao"; tResp = memoria ? 1.6 : 7;
        macs.forEach(m => m.ativo = true);
        ctx.$("#txt").innerHTML = vacina ? "💉 Vacina aplicada: antígenos inativados (cinza) entram no corpo. Eles <b>não se multiplicam</b>. Observe a resposta…" :
          memoria ? "🦠 O vírus entrou, mas esta pessoa tem <b>memória imunológica</b>. Observe como a resposta é rápida!" : "🦠 O vírus entrou pela ferida e começou a se multiplicar. Os <b>macrófagos</b> (laranja) atacam primeiro…";
      }
      ctx.$("#bInf").onclick = () => iniciar(false);
      ctx.$("#bVac").onclick = () => { if (fase === "infeccao") return ctx.avisar("A vacina é preventiva: deve ser tomada antes do contato com o vírus."); vacinou = true; iniciar(true); };
      ctx.$("#bReset").onclick = () => reset(true);
      const alvoLivre = p => { let m = null, dm = 1e9; virs.forEach(v => { if (v.morto) return; const dd = v.g.position.distanceToSquared(p); if (dd < dm) { dm = dd; m = v; } }); return m; };
      const alvoSemAb = p => { let m = null, dm = 1e9; virs.forEach(v => { if (v.morto || v.neut || v.mira) return; const dd = v.g.position.distanceToSquared(p); if (dd < dm) { dm = dd; m = v; } }); return m; };
      ctx.rotulos([{ txt: "Pele (barreira)", pos: V(-9, 8.2, 3), cor: "#f9c6a7" }, { txt: "Ferida", pos: V(0, 8, 0), cor: "#fb7185" }, { txt: "Vaso sanguíneo", pos: V(11, -3, 0), cor: "#ef4444" }, { txt: "Macrófago", obj: macs[0].g, dy: 1.7, cor: "#f59e0b" }]);
      const lim = (p) => { p.x = Math.max(-14, Math.min(14, p.x)); p.y = Math.max(-3, Math.min(5.6, p.y)); p.z = Math.max(-5.5, Math.min(5.5, p.z)); };
      return {
        raiz, vistas: [["Tecido", [0, 3, 30], [0, 0, 0]], ["Ferida", [0, 8, 12], [0, 5, 0]], ["Vaso", [6, -3, 12], [0, -4, 0]]],
        atualizar(dt, t) {
          hems.forEach(h => { h.position.x += dt * 3; if (h.position.x > 15) h.position.x = -15; });
          if (fase === "idle") { ctx.$("#mMem").textContent = memoria ? "sim ✔" : "não"; grafico(ctx.$("#gI"), [{ d: hist.v, cor: "#fb7185" }, { d: hist.a, cor: "#4ade80" }], { minN: 160, rotX: "tempo →" }); return; }
          tempo += dt;
          // vírus
          const novos = [];
          virs.forEach(v => { if (v.morto) return;
            if (v.preso) { v.g.position.lerp(v.preso.g.position, .2); return; }
            if (!v.neut) { v.vel.add(V(R() - .5, R() - .5 - (v.g.position.y > 5 ? .4 : 0), R() - .5).multiplyScalar(dt * 3)).clampLength(0, 1.4); v.g.position.addScaledVector(v.vel, dt); lim(v.g.position);
              if (!v.vac) { v.tRep -= dt; if (v.tRep < 0 && virs.length + novos.length < 70) { v.tRep = 1.6 + R() * 1.5; novos.push(v.g.position.clone()); } } }
            v.g.rotation.y += dt; });
          novos.forEach(p => novoVirus(p.x + (R() - .5), p.y + (R() - .5), p.z + (R() - .5)));
          // macrófagos (imunidade inata)
          macs.forEach(m => { if (!m.ativo) return; m.cd -= dt;
            if (!m.alvo || m.alvo.morto) m.alvo = alvoLivre(m.g.position);
            if (m.alvo) { const dir = m.alvo.g.position.clone().sub(m.g.position); const dist = dir.length();
              m.g.position.addScaledVector(dir.normalize(), Math.min(dist, dt * (m.alvo.neut ? 3.2 : 1.6)));
              if (dist < 1.3 && m.cd <= 0) { m.alvo.morto = true; raiz.remove(m.alvo.g); m.cd = m.alvo.neut ? .3 : 1.5; m.alvo = null; } }
            m.g.rotation.y += dt * .5; m.g.scale.setScalar(1 + Math.sin(t * 3) * .05); });
          // imunidade adaptativa: plasmócitos e anticorpos
          if (!respostaAtiva && tempo > tResp) { respostaAtiva = true;
            for (let i = 0; i < (memoria ? 4 : 2); i++) { const g = G.celulaBola(1.1, 0x818cf8, 0x312e81, .5, V(.4, 0, 0), .7); g.position.set(-10 + i * 6.5, -5.5, 2); g.traverse(o => o.userData.parte = "plasmocito"); raiz.add(g); plas.push({ g, tEm: 0 }); }
            ctx.$("#txt").innerHTML += memoria ? "<br>⚡ Células de memória reconheceram o antígeno: <b>muitos plasmócitos</b> surgem e liberam anticorpos quase imediatamente!" : "<br>⏳ Depois de alguns dias, os <b>linfócitos B</b> reconheceram o antígeno e viraram <b>plasmócitos</b> (roxo), que liberam <b>anticorpos</b> (verde).";
          }
          plas.forEach(p => { p.g.position.y = lerp(p.g.position.y, -1.5, dt); p.tEm -= dt;
            if (p.tEm < 0 && abs.length < 160 && virs.some(v => !v.morto)) { p.tEm = memoria ? .05 : .12; const g = geoAb.clone(); g.position.copy(p.g.position); g.traverse(o => o.userData.parte = "anticorpo"); raiz.add(g); abs.push({ g, alvo: null }); } });
          abs.forEach(a => { if (a.fixo) { a.g.position.copy(a.fixo.g.position).add(a.off); if (a.fixo.morto) { a.fixo = null; a.livre = true; } return; }
            if (!a.alvo || a.alvo.morto || a.alvo.neut) a.alvo = alvoSemAb(a.g.position) || alvoLivre(a.g.position);
            if (a.alvo) { const dir = a.alvo.g.position.clone().sub(a.g.position), dist = dir.length(); a.g.position.addScaledVector(dir.normalize(), Math.min(dist, dt * 5));
              if (dist < .7) { a.alvo.neut = true; a.alvo.g.traverse(o => { if (o.material && o.material.color) o.material.color.lerp(new T.Color(0x64748b), .5); }); a.fixo = a.alvo; a.off = V(R() - .5, R() - .5, R() - .5).setLength(.6); } }
            else a.g.position.add(V(R() - .5, R() - .5, R() - .5).multiplyScalar(dt * 2));
            a.g.rotation.z += dt * 2; });
          const vivos = virs.filter(v => !v.morto), nv = vivos.filter(v => !v.vac).length, nA = abs.length;
          maxV = Math.max(maxV, vivos.length);
          tHist += dt; if (tHist > .2) { tHist = 0; hist.v.push(vivos.length); hist.a.push(nA); if (hist.v.length > 300) { hist.v.shift(); hist.a.shift(); } }
          ctx.$("#mV").textContent = vivos.length; ctx.$("#mA").textContent = nA; ctx.$("#mT").textContent = Math.round(tempo * 1.4);
          if (respostaAtiva && vivos.length === 0) {
            const eraVac = fase === "vacina"; memoria = true; fase = "idle";
            ctx.$("#txt").innerHTML = eraVac ? "✅ <b>Vacinação concluída:</b> o corpo produziu anticorpos e <b>células de memória</b> sem ficar doente. Agora clique em <b>Infecção pelo vírus</b> e compare!" :
              maxV > 35 ? `🤒 A infecção foi vencida, mas o vírus chegou a <b>${maxV}</b> partículas: a pessoa ficou doente por vários dias. Agora ela tem <b>memória imunológica</b>. Clique em <b>Nova pessoa</b> e teste com a vacina.` :
                `💪 Infecção controlada rapidamente (máximo de <b>${maxV}</b> vírus): a pessoa quase não teve sintomas, graças à memória imunológica${vacinou ? " criada pela vacina" : ""}!`;
            setTimeout(() => { abs.forEach(a => raiz.remove(a.g)); abs.length = 0; }, 1500);
          }
          ctx.$("#mMem").textContent = memoria ? "sim ✔" : "não";
          grafico(ctx.$("#gI"), [{ d: hist.v, cor: "#fb7185" }, { d: hist.a.map(x => x / 2.5), cor: "#4ade80" }], { max: 70, minN: 160, rotX: "tempo →" });
        }
      };
    }
  });

  /* =====================================================================
     4. PROPAGAÇÃO DE DOENÇAS E IMUNIDADE DE REBANHO
     ===================================================================== */
  lista.push({
    id: "contagio", em: "👥", titulo: "Propagação e imunidade de rebanho", hab: "EF07CI09 · EF07CI10", aulas: "Aulas 6, 7, 12 e 13",
    desc: "Uma praça com 180 pessoas e o vírus fictício NVX-25. Ajuste circulação, máscara e vacinação e veja a curva de casos.",
    html: `<div class="controle"><label>🚶 Circulação de pessoas <output id="oC">100%</output></label><input type="range" id="rC" min="5" max="100" value="100"></div>
      <div class="controle"><label>😷 Máscara e higiene das mãos <output id="oM">0%</output></label><input type="range" id="rM" min="0" max="90" value="0"></div>
      <div class="controle"><label>💉 Cobertura vacinal <output id="oV">0%</output></label><input type="range" id="rV" min="0" max="95" step="5" value="0"></div>
      <div class="linha-btn"><button class="btn prim" id="bGo">▶ Iniciar surto</button><button class="btn" id="bRe">↺ Reiniciar praça</button></div>
      <div class="medidores">${medidor("mS", "Suscetíveis", 0)}${medidor("mI", "Infectados", 0)}${medidor("mR", "Recuperados", 0)}${medidor("mVa", "Vacinados", 0)}${medidor("mP", "Pico", 0)}${medidor("mD", "Dia", 0)}</div>
      <canvas class="grafico" id="gC"></canvas>
      <div class="legenda"><span><i style="background:#ef4444"></i>infectados</span><span><i style="background:#22c55e"></i>recuperados</span><span><i style="background:#fcd34d"></i>capacidade do sistema de saúde</span></div>
      <div class="destaque" id="txt">Rode uma vez <b>sem medidas</b>; depois aumente a vacinação ou use máscara e compare a altura do pico.</div>
      <details><summary>Surto, endemia, epidemia e pandemia</summary><p><b>Surto:</b> aumento repentino e localizado (ex.: uma escola). <b>Endemia:</b> doença que se repete em uma região (ex.: malária no Norte). <b>Epidemia:</b> casos acima do esperado em várias localidades (ex.: dengue em SP em 2025). <b>Pandemia:</b> epidemia mundial, declarada pela OMS (ex.: Covid-19).</p><p>A vigilância epidemiológica monitora os casos para agir cedo: isolar doentes, vacinar e orientar a população.</p></details>`,
    iniciar(ctx) {
      const G = ctx.G, raiz = new T.Group(), N = 180, RAIO = 21;
      raiz.add(chao(24, 0x334155)); const grama = chao(RAIO + .3, 0x3f6212); grama.position.y = .01; raiz.add(grama);
      const fonte = G.malha(new T.CylinderGeometry(2.4, 2.6, .8, 32), G.mat(0x94a3b8), V(0, .4, 0)); raiz.add(fonte); raiz.add(G.malha(new T.CylinderGeometry(2.1, 2.1, .2, 32), G.mat(0x38bdf8), V(0, .82, 0)));
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; const tr = new T.Group(); tr.add(G.malha(new T.CylinderGeometry(.18, .25, 1.4, 8), G.mat(0x78350f), V(0, .7, 0))); tr.add(G.malha(new T.ConeGeometry(1.2, 2.6, 10), G.mat(0x166534), V(0, 2.6, 0))); tr.position.set(Math.cos(a) * 22.5, 0, Math.sin(a) * 22.5); raiz.add(tr); }
      const geo = new T.CapsuleGeometry(.32, .7, 4, 10); geo.translate(0, .67, 0);
      const inst = new T.InstancedMesh(geo, G.mat(0xffffff, { rough: .5 }), N); inst.instanceMatrix.setUsage(T.DynamicDrawUsage); raiz.add(inst);
      const cor = { S: new T.Color(0x94a3b8), I: new T.Color(0xef4444), R: new T.Color(0x22c55e), V: new T.Color(0x38bdf8) }, d = new T.Object3D();
      let P = [], hist, dia, tDia, pico, rodando = false, ultimo = null;
      const rC = ctx.$("#rC"), rM = ctx.$("#rM"), rV = ctx.$("#rV");
      const rot = () => { ctx.$("#oC").textContent = rC.value + "%"; ctx.$("#oM").textContent = rM.value + "%"; ctx.$("#oV").textContent = rV.value + "%"; };
      [rC, rM].forEach(r => r.oninput = () => { rot(); P.forEach((p, i) => p.move = (i * 37 % 100) < +rC.value); });
      rV.oninput = () => { rot(); if (!rodando) reset(); };
      function reset() { rot(); const vac = +rV.value / 100; P = [];
        for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, r = 3 + Math.sqrt(Math.random()) * (RAIO - 3.5);
          P.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, dir: Math.random() * 6.28, s: Math.random() < vac ? "V" : "S", t: 0, move: (i * 37 % 100) < +rC.value }); }
        hist = { i: [], r: [] }; dia = 0; tDia = 0; pico = 0; rodando = false; ctx.$("#bGo").disabled = false; }
      reset();
      ctx.$("#bRe").onclick = reset;
      ctx.$("#bGo").onclick = () => { if (rodando) return; reset(); let k = 0; for (const p of P) if (p.s === "S") { p.s = "I"; if (++k >= 2) break; } if (!k) { ctx.avisar("Todos estão vacinados: o vírus não encontrou ninguém para infectar!"); return; } rodando = true; ctx.$("#bGo").disabled = true; ctx.$("#txt").innerHTML = "Dois visitantes chegaram infectados com o NVX-25… observe!"; };
      const CAP = 36;
      return {
        raiz, vistas: [["Praça", [0, 26, 34], [0, 0, 0]], ["Do alto", [0, 46, .1], [0, 0, 0]], ["Na multidão", [14, 3, 14], [0, 1, 0]]],
        atualizar(dt) {
          const prev = 1 - +rM.value / 100 * .85;
          P.forEach(p => { if (!p.move) return; p.dir += (Math.random() - .5) * dt * 3; const v = rodando ? 2.4 : 1.2; p.x += Math.cos(p.dir) * v * dt; p.z += Math.sin(p.dir) * v * dt;
            const r = Math.hypot(p.x, p.z); if (r > RAIO - .6 || r < 3) { p.dir += Math.PI; p.x *= r > RAIO - .6 ? (RAIO - .6) / r : 3 / r; p.z *= r > RAIO - .6 ? (RAIO - .6) / r : 3 / r; } });
          if (rodando) {
            for (const a of P) if (a.s === "I") { a.t += dt; if (a.t > 7) a.s = "R";
              for (const b of P) if (b.s === "S" || b.s === "V") { const dx = a.x - b.x, dz = a.z - b.z; if (dx * dx + dz * dz < 1.3) { const pr = 2.2 * prev * dt * (b.s === "V" ? .08 : 1); if (Math.random() < pr) { b.s = "I"; b.t = 0; } } } }
            tDia += dt; if (tDia > .5) { tDia = 0; dia++; const c = conta(); hist.i.push(c.I); hist.r.push(c.R); pico = Math.max(pico, c.I); }
            const c = conta();
            if (c.I === 0) { rodando = false; ctx.$("#bGo").disabled = false; fim(c); }
          }
          P.forEach((p, i) => { d.position.set(p.x, 0, p.z); d.rotation.set(0, -p.dir, 0); d.scale.setScalar(p.s === "I" ? 1.15 : 1); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); inst.setColorAt(i, cor[p.s]); });
          inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
          const c = conta(); ctx.$("#mS").textContent = c.S; ctx.$("#mI").textContent = c.I; ctx.$("#mR").textContent = c.R; ctx.$("#mVa").textContent = c.V; ctx.$("#mP").textContent = pico; ctx.$("#mD").textContent = dia;
          grafico(ctx.$("#gC"), [{ d: hist.i, cor: "#ef4444" }, { d: hist.r, cor: "#22c55e" }], { max: N, minN: 80, linha: { v: CAP, cor: "#fcd34d", txt: "capacidade de atendimento" }, rotX: "dias →" });
        }
      };
      function conta() { const c = { S: 0, I: 0, R: 0, V: 0 }; P.forEach(p => c[p.s]++); return c; }
      function fim(c) {
        const total = c.R, naoVac = N - c.V, cfg = { C: +rC.value, M: +rM.value, V: +rV.value };
        let m = `Fim do surto: <b>${total}</b> pessoas adoeceram em ${dia} dias; pico de <b>${pico}</b> doentes ao mesmo tempo. `;
        m += pico > CAP ? "⚠️ O pico passou da capacidade de atendimento: hospitais e UBS ficariam <b>sobrecarregados</b>. " : "✅ O pico ficou abaixo da capacidade de atendimento. ";
        if (cfg.V >= 70 && total < naoVac * .3) m += "🛡️ Com alta cobertura vacinal, o vírus não encontrou caminhos para circular e até quem não se vacinou ficou protegido: isso é <b>imunidade de rebanho</b>! ";
        if (ultimo) m += pico < ultimo.pico ? `📉 Comparado à rodada anterior (pico ${ultimo.pico}), a curva foi <b>achatada</b>.` : `📈 Rodada anterior: pico ${ultimo.pico}.`;
        ultimo = { pico, total }; ctx.$("#txt").innerHTML = m;
      }
    }
  });

  /* =====================================================================
     5. CIDADE E SANEAMENTO BÁSICO
     ===================================================================== */
  lista.push({
    id: "saneamento", em: "🚰", titulo: "Cidade e saneamento básico", hab: "EF07CI09", aulas: "Aulas 14 e 15",
    desc: "Ligue os quatro serviços de saneamento numa cidade 3D e veja o rio, os ratos, os mosquitos e os indicadores de saúde mudarem.",
    html: `<div class="toggles"><button class="tg" data-k="agua">🚰 Água tratada</button><button class="tg" data-k="esgoto">🚽 Esgoto coletado e tratado</button><button class="tg" data-k="lixo">🗑️ Coleta de lixo</button><button class="tg" data-k="dren">🌧️ Drenagem urbana</button></div>
      <div class="barras" id="barras"></div><p class="mini-txt muted">Índice relativo (100% = cidade sem nenhum serviço). Modelo didático simplificado.</p>
      <div class="destaque" id="txt">Ligue os serviços um por um e observe o que muda na cidade.</div>
      <div class="cartao pequeno" id="pergS"><b>Desafio da comunidade rural (Aula 15):</b> parte das casas não tem esgoto, a água vem de poços próximos a áreas contaminadas, os casos de diarreia aumentaram e o lixo é jogado em locais improvisados. Com pouco dinheiro, qual deve ser a <b>primeira</b> ação?
        <div class="opcoes" style="margin-top:8px"><button class="opcao" data-c="1">Garantir água tratada e afastar os poços da contaminação</button><button class="opcao" data-c="0">Asfaltar as estradas</button><button class="opcao" data-c="0">Instalar iluminação pública</button><button class="opcao" data-c="0">Construir uma quadra esportiva</button></div><div id="fbS"></div></div>`,
    iniciar(ctx) {
      const G = ctx.G, raiz = new T.Group(), R = G.rng(9);
      const S = { agua: false, esgoto: false, lixo: false, dren: false };
      const solo = G.malha(new T.BoxGeometry(44, 1, 32), G.mat(0x4d7c0f, { rough: .95 }), V(0, -.5, 0)); raiz.add(solo);
      raiz.add(G.malha(new T.BoxGeometry(40, .05, 3), G.mat(0x374151), V(0, .03, -1)));
      const rioMat = G.mat(0x7c5c2e, { rough: .2, metal: .1 }); const rio = G.malha(new T.PlaneGeometry(44, 6, 60, 6), rioMat, V(0, .16, 11), [-Math.PI / 2, 0, 0]); raiz.add(rio);
      rio.userData.info = "Rio: recebe o esgoto quando não há coleta e tratamento.";
      const casas = [];
      for (let i = 0; i < 8; i++) { const c = new T.Group(), cor = [0xfca5a5, 0xfde68a, 0xa5b4fc, 0xfdba74, 0x99f6e4, 0xf9a8d4, 0xbef264, 0xc4b5fd][i];
        c.add(G.malha(new T.BoxGeometry(3, 2.4, 3), G.mat(cor), V(0, 1.2, 0))); c.add(G.malha(new T.ConeGeometry(2.5, 1.6, 4), G.mat(0x7c2d12), V(0, 3.2, 0), [0, Math.PI / 4, 0]));
        c.position.set(-17 + i * 4.8, 0, i % 2 ? -6.5 : 3.5); c.traverse(o => o.userData.info = "Moradia: precisa de água potável, coleta de esgoto, coleta de lixo e drenagem."); raiz.add(c); casas.push(c); }
      // água: ETA x poço
      const eta = new T.Group(); eta.add(G.malha(new T.BoxGeometry(4, 3, 3), G.mat(0xe0f2fe), V(0, 1.5, 0))); [-1, 1].forEach(s => eta.add(G.malha(new T.CylinderGeometry(1.2, 1.2, 4, 20), G.mat(0x0ea5e9), V(s * 3, 2, 0))));
      eta.position.set(-18, 0, -12); eta.traverse(o => o.userData.info = "ETA — Estação de Tratamento de Água: capta, trata e distribui água potável."); raiz.add(eta);
      const canos = new T.Group(); casas.forEach(c => canos.add(G.tubo([V(-18, .2, -10.5), V(c.position.x, .2, -10), V(c.position.x, .2, c.position.z)], .14, G.mat(0x0284c7)))); raiz.add(canos);
      const poco = new T.Group(); poco.add(G.malha(new T.CylinderGeometry(.9, .9, 1, 16, 1, true), G.mat(0x78716c, { side: T.DoubleSide }), V(0, .5, 0))); poco.add(G.malha(new T.CylinderGeometry(.85, .85, .1, 16), G.mat(0x5c4a2e), V(0, .3, 0)));
      poco.position.set(-8, 0, 7.6); poco.traverse(o => o.userData.info = "Poço perto do rio contaminado: a água pode transmitir diarreias, hepatite A e cólera."); raiz.add(poco);
      // esgoto
      const ete = new T.Group(); [-1.6, 1.6].forEach(x => ete.add(G.malha(new T.CylinderGeometry(1.4, 1.4, .8, 24), G.mat(0x64748b), V(x, .4, 0)))); ete.add(G.malha(new T.BoxGeometry(2, 2, 2), G.mat(0xcbd5e1), V(0, 1, -2.2)));
      const eteAgua = []; [-1.6, 1.6].forEach(x => { const a = G.malha(new T.CylinderGeometry(1.25, 1.25, .1, 24), G.mat(0x65a30d), V(x, .82, 0)); ete.add(a); eteAgua.push(a); });
      ete.position.set(17, 0, 6.5); ete.traverse(o => o.userData.info = "ETE — Estação de Tratamento de Esgoto: limpa o esgoto antes de devolvê-lo ao rio."); raiz.add(ete);
      const esgRio = new T.Group(), esgEte = new T.Group(), marrom = G.mat(0x713f12), cinza = G.mat(0x475569);
      casas.forEach(c => { esgRio.add(G.tubo([V(c.position.x, .15, c.position.z + 1.6), V(c.position.x + .5, .15, 8.2)], .16, marrom)); esgEte.add(G.tubo([V(c.position.x, .12, c.position.z + 1.6), V(c.position.x, .12, 1.2), V(15, .12, 1.2), V(17, .12, 5)], .1, cinza)); });
      raiz.add(esgRio, esgEte);
      // lixo e ratos
      const lixo = new T.Group(), ratos = [];
      for (let i = 0; i < 7; i++) { const p = new T.Group(); p.add(G.malha(new T.ConeGeometry(1, .9, 7), G.mat(0x57534e), V(0, .45, 0))); for (let k = 0; k < 4; k++) p.add(G.malha(new T.BoxGeometry(.3, .3, .3), G.mat([0xef4444, 0x3b82f6, 0xfacc15, 0xf8fafc][k]), V((R() - .5) * 1.2, .5 + R() * .4, (R() - .5) * 1.2), [R(), R(), R()]));
        p.position.set(-16 + i * 5.3, 0, 1 - (i % 2) * 4.3); lixo.add(p); }
      lixo.traverse(o => o.userData.info = "Lixo acumulado: atrai ratos (leptospirose), baratas e acumula água (Aedes)."); raiz.add(lixo);
      for (let i = 0; i < 6; i++) { const r = G.malha(new T.CapsuleGeometry(.16, .35, 4, 8), G.mat(0x44403c), V(0, .2, 0), [0, 0, Math.PI / 2]); r.userData.info = "Rato: sua urina contamina a água de enchentes com a bactéria da leptospirose."; raiz.add(r); ratos.push({ m: r, a: R() * 6, c: lixo.children[i % 7].position }); }
      const lixeiras = new T.Group(); for (let i = 0; i < 6; i++) lixeiras.add(G.malha(new T.CylinderGeometry(.35, .3, .9, 12), G.mat(0x16a34a), V(-15 + i * 6, .45, .6)));
      const caminhao = new T.Group(); caminhao.add(G.malha(new T.BoxGeometry(3, 1.6, 1.4), G.mat(0x15803d), V(0, 1.1, 0))); caminhao.add(G.malha(new T.BoxGeometry(1, 1.2, 1.4), G.mat(0xf8fafc), V(2, .9, 0)));
      [-1, 1].forEach(x => [-.75, .75].forEach(z => caminhao.add(G.malha(new T.CylinderGeometry(.35, .35, .3, 12), G.mat(0x111827), V(x, .35, z), [Math.PI / 2, 0, 0]))));
      caminhao.position.set(-18, 0, -1); caminhao.traverse(o => o.userData.info = "Coleta de lixo: limpeza urbana e destino adequado dos resíduos.");
      raiz.add(lixeiras, caminhao);
      // drenagem
      const pocas = new T.Group(); for (let i = 0; i < 7; i++) pocas.add(G.malha(new T.CylinderGeometry(1.4 + R(), 1.4 + R(), .06, 20), G.mat(0x1d4ed8, { op: .7 }), V(-17 + i * 5.6, .1, -1 + (R() - .5) * 2)));
      pocas.traverse(o => o.userData.info = "Água parada: alagamentos e criadouros do mosquito Aedes aegypti.");
      const bueiros = new T.Group(); for (let i = 0; i < 8; i++) bueiros.add(G.malha(new T.BoxGeometry(.9, .08, .5), G.mat(0x111827), V(-17.5 + i * 5, .08, .6)));
      bueiros.traverse(o => o.userData.info = "Bueiros e galerias pluviais: levam a água da chuva embora e evitam alagamentos.");
      raiz.add(pocas, bueiros);
      const chuvaGeo = new T.BufferGeometry(), NC = 500, cp = new Float32Array(NC * 3); for (let i = 0; i < NC; i++) { cp[i * 3] = (R() - .5) * 44; cp[i * 3 + 1] = R() * 16; cp[i * 3 + 2] = (R() - .5) * 30; }
      chuvaGeo.setAttribute("position", new T.BufferAttribute(cp, 3));
      const chuva = new T.Points(chuvaGeo, new T.PointsMaterial({ color: 0x93c5fd, size: .12, transparent: true, opacity: .7 })); raiz.add(chuva);
      const NM = 60, mosq = new T.InstancedMesh(new T.SphereGeometry(.09, 6, 4), G.mat(0x111827), NM), dm = new T.Object3D(), mpos = [];
      for (let i = 0; i < NM; i++) mpos.push([(R() - .5) * 36, 1 + R() * 3, (R() - .5) * 16, R() * 6]); raiz.add(mosq);
      const ind = () => ({ diar: 100 - (S.agua ? 45 : 0) - (S.esgoto ? 40 : 0) - (S.lixo ? 5 : 0), lepto: 100 - (S.esgoto ? 30 : 0) - (S.lixo ? 35 : 0) - (S.dren ? 25 : 0), deng: 100 - (S.lixo ? 45 : 0) - (S.dren ? 35 : 0), alag: 100 - (S.dren ? 65 : 0) - (S.lixo ? 20 : 0), rio: 100 - (S.esgoto ? 65 : 0) - (S.lixo ? 25 : 0) });
      const nomes = { agua: "água tratada", esgoto: "esgoto", lixo: "coleta de lixo", dren: "drenagem" };
      function upd() {
        const I = ind(), B = [["Diarreias", I.diar, "#f59e0b"], ["Leptospirose", I.lepto, "#ef4444"], ["Focos de dengue", I.deng, "#a855f7"], ["Alagamentos", I.alag, "#3b82f6"], ["Poluição do rio", I.rio, "#92400e"]];
        ctx.$("#barras").innerHTML = B.map(b => `<div class="b"><span>${b[0]}</span><span class="tr"><i style="width:${Math.max(5, b[1])}%;background:${b[2]}"></i></span><b>${Math.max(5, b[1])}%</b></div>`).join("");
        eta.visible = canos.visible = S.agua; poco.visible = !S.agua;
        esgRio.visible = !S.esgoto; esgEte.visible = S.esgoto; eteAgua.forEach(a => a.material.color.setHex(S.esgoto ? 0x0ea5e9 : 0x65a30d));
        lixo.visible = !S.lixo; ratos.forEach(r => r.m.visible = !S.lixo); lixeiras.visible = caminhao.visible = S.lixo;
        pocas.visible = !S.dren; bueiros.visible = S.dren; chuva.visible = true;
        mosq.count = Math.round(NM * I.deng / 100);
        const on = Object.values(S).filter(Boolean).length;
        ctx.$("#txt").innerHTML = on === 4 ? "🎉 Com os quatro serviços funcionando, as doenças de veiculação hídrica e transmitidas por vetores caem muito. Saneamento é <b>saúde pública</b>, dignidade e preservação ambiental." :
          on === 0 ? "Sem saneamento: esgoto no rio, poço contaminado, lixo com ratos, água parada e mosquitos." : `Serviços ligados: ${on} de 4. Ainda falta: ${Object.keys(S).filter(k => !S[k]).map(k => nomes[k]).join(", ")}.`;
      }
      ctx.cartao.querySelectorAll(".tg").forEach(b => b.onclick = () => { S[b.dataset.k] = !S[b.dataset.k]; b.classList.toggle("on", S[b.dataset.k]); upd(); });
      ctx.cartao.querySelectorAll("#pergS .opcao").forEach(b => b.onclick = () => { const ok = b.dataset.c === "1"; ctx.cartao.querySelectorAll("#pergS .opcao").forEach(x => { x.disabled = true; if (x.dataset.c === "1") x.classList.add("certa"); else if (x === b) x.classList.add("errada"); });
        ctx.$("#fbS").innerHTML = `<div class="destaque ${ok ? "saude" : "erro"}">${ok ? "Correto! " : ""}A diarreia está ligada à água contaminada: garantir água potável é o mais urgente; em seguida, a coleta de esgoto e de lixo.</div>`; });
      upd();
      const rot = [{ txt: "ETA", obj: eta, dy: 4.6, cor: "#0ea5e9" }, { txt: "Poço", obj: poco, dy: 1.6, cor: "#a8a29e" }, { txt: "ETE", obj: ete, dy: 3, cor: "#64748b" }, { txt: "Rio", pos: V(-12, .6, 12.5), cor: "#92400e" }, { txt: "Lixo", obj: lixo.children[2], dy: 1.6, cor: "#57534e" }, { txt: "Bueiros", obj: bueiros.children[3], dy: .8, cor: "#94a3b8" }, { txt: "Água parada", obj: pocas.children[4], dy: .8, cor: "#3b82f6" }];
      ctx.rotulos(rot);
      const cRio = new T.Color(), cLimpo = new T.Color(0x0ea5e9), cSujo = new T.Color(0x6b4f1d);
      return {
        raiz, vistas: [["Cidade", [0, 24, 34], [0, 0, 0]], ["Rio", [6, 6, 24], [2, 0, 9]], ["Rua", [-6, 4, 8], [-4, 0, -1]]],
        atualizar(dt, t) {
          const I = ind(); cRio.copy(cLimpo).lerp(cSujo, I.rio / 100); rioMat.color.lerp(cRio, .05);
          const pa = rio.geometry.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * .5 + t * 2) * .05); pa.needsUpdate = true;
          ratos.forEach((r, i) => { r.a += dt * 1.5; r.m.position.set(r.c.x + Math.cos(r.a + i) * 1.6, .2, r.c.z + Math.sin(r.a * 1.3 + i) * 1.6); r.m.rotation.y = -r.a; });
          const chuvoso = !S.dren; chuva.material.opacity = lerp(chuva.material.opacity, chuvoso ? .7 : 0, .05);
          const pc = chuva.geometry.attributes.position; for (let i = 0; i < NC; i++) { let y = pc.getY(i) - dt * 14; if (y < 0) y = 16; pc.setY(i, y); } pc.needsUpdate = true;
          for (let i = 0; i < mosq.count; i++) { const m = mpos[i]; dm.position.set(m[0] + Math.sin(t * 2 + m[3]) * 1.2, m[1] + Math.sin(t * 5 + m[3]) * .4, m[2] + Math.cos(t * 1.7 + m[3]) * 1.2); dm.updateMatrix(); mosq.setMatrixAt(i, dm.matrix); }
          mosq.instanceMatrix.needsUpdate = true;
          if (caminhao.visible) { caminhao.position.x += dt * 3; if (caminhao.position.x > 20) caminhao.position.x = -20; }
        }
      };
    }
  });

  /* =====================================================================
     6. FÁBRICA DE VACINAS
     ===================================================================== */
  lista.push({
    id: "fabrica", em: "🏭", titulo: "Da pesquisa ao braço: fabricação de vacinas", hab: "EF07CI10 · EF07CI11", aulas: "Aulas 10 e 11",
    desc: "Siga um frasco de vacina por uma linha de produção em 3D, da pesquisa no laboratório até a distribuição pelo SUS.",
    html: `<div class="etapas" id="etp">${"<span></span>".repeat(8)}</div>
      <div class="destaque" id="txt"></div>
      <div class="linha-btn"><button class="btn" id="ant">◀ Anterior</button><button class="btn prim" id="prox">Próxima etapa ▶</button><button class="btn" id="auto">⏯ Automático</button></div>
      <div class="cartao pequeno" style="margin-top:10px"><h4 style="margin-top:0">Linha do tempo da vacina</h4><ul class="lista">
        <li><b>Século X</b> — Variolação na China: pó das feridas de varíola soprado no nariz.</li>
        <li><b>1796</b> — Edward Jenner usa material da varíola bovina (<i>cowpox</i>) e protege o menino James Phipps. Origem da palavra <i>vacina</i> (de <i>vacca</i>).</li>
        <li><b>1885</b> — Louis Pasteur desenvolve a vacina contra a raiva e consolida a vacinação como método científico.</li>
        <li><b>1904</b> — Revolta da Vacina no Rio de Janeiro: medo, desinformação e medidas autoritárias.</li>
        <li><b>1973</b> — Criação do Programa Nacional de Imunizações (PNI).</li>
        <li><b>1980</b> — A OMS declara a varíola erradicada no mundo.</li></ul>
        <p class="mini-txt muted">No Brasil, o <b>Instituto Butantan</b> (SP) produz, por exemplo, a vacina da gripe; a <b>Fiocruz</b> (RJ) produz vacinas como a da febre amarela.</p></div>`,
    iniciar(ctx) {
      const G = ctx.G, raiz = new T.Group();
      raiz.add(G.malha(new T.BoxGeometry(56, .6, 4), G.mat(0x1f2937), V(0, .3, 0)));
      for (let i = 0; i < 28; i++) raiz.add(G.malha(new T.CylinderGeometry(.25, .25, 4.1, 10), G.mat(0x6b7280, { metal: .5 }), V(-27 + i * 2, .65, 0), [Math.PI / 2, 0, 0]));
      const X = i => -24.5 + i * 7;
      const pessoa = (x, z, cor) => { const g = new T.Group(); g.add(G.malha(new T.CapsuleGeometry(.28, .6, 4, 8), G.mat(cor), V(0, .6, 0))); g.add(G.malha(new T.SphereGeometry(.25, 10, 8), G.mat(0xfcd9b8), V(0, 1.35, 0))); g.position.set(x, 0, z); return g; };
      const est = [
        ["Pesquisa", "No laboratório, cientistas estudam o microrganismo e escolhem o <b>antígeno</b> que vai ensinar o sistema imune (vírus inativado, enfraquecido ou só uma proteína dele).", g => { g.add(G.malha(new T.CylinderGeometry(.9, 1.1, .4, 16), G.mat(0xe5e7eb), V(0, .2, 0))); g.add(G.malha(new T.CylinderGeometry(.18, .18, 2.4, 10), G.mat(0x94a3b8), V(0, 1.4, 0), [0, 0, .3])); const v = G.vírusMini(.5, 0xfb7185); v.position.set(1.2, 2.2, 0); g.add(v); }],
        ["Testes pré-clínicos", "Antes de qualquer pessoa, a vacina é testada em <b>células em laboratório e em animais</b> para verificar se é segura e se provoca resposta imune.", g => { const pf = []; for (let i = 0; i <= 10; i++) { const y = i / 10 * 2.2; pf.push(new T.Vector2(i < 6 ? 1.1 - i * .05 : .4, y)); } g.add(G.malha(new T.LatheGeometry(pf, 24), G.mat(0xbae6fd, { op: .45, side: T.DoubleSide }))); g.add(G.malha(new T.CylinderGeometry(.95, 1.05, .6, 24), G.mat(0x4ade80, { op: .8 }), V(0, .3, 0))); }],
        ["Fase 1", "Poucos voluntários adultos (dezenas). Objetivo principal: verificar a <b>segurança</b>.", g => { for (let i = 0; i < 3; i++) g.add(pessoa(-.9 + i * .9, 0, 0x38bdf8)); }],
        ["Fase 2", "Centenas de voluntários. Avalia a <b>dose</b> ideal e a resposta imune produzida.", g => { for (let i = 0; i < 9; i++) g.add(pessoa(-1.2 + (i % 3) * 1.2, -1 + Math.floor(i / 3), 0xa78bfa)); }],
        ["Fase 3", "Milhares de voluntários, comparando quem tomou a vacina com quem tomou placebo. Confirma a <b>eficácia</b>: a vacina protege?", g => { for (let i = 0; i < 25; i++) g.add(pessoa(-2 + (i % 5) * 1, -2 + Math.floor(i / 5), 0xf472b6)); }],
        ["Aprovação da Anvisa", "A Agência Nacional de Vigilância Sanitária analisa todos os resultados. Só com a <b>aprovação</b> a vacina pode ser usada no Brasil.", g => { g.add(G.malha(new T.BoxGeometry(1.8, .1, 2.4), G.mat(0xf8fafc), V(0, .6, 0))); g.add(G.malha(new T.CylinderGeometry(.5, .5, .9, 16), G.mat(0x16a34a), V(.4, 1.2, .3))); g.add(G.malha(new T.TorusGeometry(.45, .07, 8, 24), G.mat(0x16a34a), V(-.3, .66, -.5), [-Math.PI / 2, 0, 0])); }],
        ["Produção em larga escala", "Em fábricas como as do <b>Butantan</b> e da <b>Fiocruz</b>, a vacina é produzida em grandes biorreatores, com rígido controle de qualidade de cada lote.", g => { [-1, 1].forEach(s => { g.add(G.malha(new T.CylinderGeometry(1, 1, 3.2, 20), G.mat(0xd1d5db, { metal: .6, rough: .3 }), V(s * 1.3, 1.6, 0))); g.add(G.malha(new T.SphereGeometry(1, 20, 10, 0, 6.3, 0, 1.6), G.mat(0xd1d5db, { metal: .6, rough: .3 }), V(s * 1.3, 3.2, 0))); }); g.add(G.tubo([V(-1.3, 2.6, .9), V(0, 3.4, 1.2), V(1.3, 2.6, .9)], .12, G.mat(0x94a3b8))); }],
        ["Distribuição pelo SUS", "O <b>PNI</b> distribui as vacinas, mantidas refrigeradas, para as UBS de todo o país. Depois da aplicação, a segurança continua sendo <b>monitorada</b>.", g => { g.add(G.malha(new T.BoxGeometry(3, 1.8, 1.6), G.mat(0xf8fafc), V(-.4, 1.3, 0))); g.add(G.malha(new T.BoxGeometry(1.1, 1.3, 1.6), G.mat(0x0ea5e9), V(1.7, 1.05, 0))); [-1.4, .5, 1.7].forEach(x => [-.85, .85].forEach(z => g.add(G.malha(new T.CylinderGeometry(.35, .35, .25, 14), G.mat(0x111827), V(x, .35, z), [Math.PI / 2, 0, 0])))); }]
      ];
      const rots = [];
      est.forEach(([nome, txt, f], i) => { const g = new T.Group(); f(g); g.position.set(X(i), 3.2, -4.6); g.traverse(o => o.userData.info = nome + ": " + txt.replace(/<[^>]+>/g, ""));
        const base = G.malha(new T.CylinderGeometry(3, 3, .3, 32), G.mat(0x334155), V(X(i), 3.05, -4.6)); raiz.add(base, g); rots.push({ txt: (i + 1) + ". " + nome, pos: V(X(i), 7.2, -4.6), cor: "#5eead4" }); });
      raiz.add(G.malha(new T.BoxGeometry(56, 3, .5), G.mat(0x1e293b), V(0, 1.6, -2.3)));
      const frasco = new T.Group(); frasco.add(G.malha(new T.CylinderGeometry(.6, .6, 1.6, 24), G.mat(0xe0f2fe, { op: .45 }), V(0, .8, 0))); const liq = G.malha(new T.CylinderGeometry(.52, .52, 1, 24), G.mat(0xf472b6), V(0, .55, 0)); frasco.add(liq); frasco.add(G.malha(new T.CylinderGeometry(.45, .45, .4, 24), G.mat(0xef4444), V(0, 1.8, 0)));
      frasco.position.set(X(0), .6, 0); frasco.traverse(o => o.userData.info = "Frasco de vacina seguindo a linha de produção."); raiz.add(frasco);
      ctx.rotulos(rots.concat([{ txt: "Vacina", obj: frasco, dy: 2.6, cor: "#f472b6" }]));
      let et = 0, auto = false, tA = 0;
      const ir = n => { et = Math.max(0, Math.min(7, n)); ctx.$("#txt").innerHTML = `<b>${et + 1}. ${est[et][0]}.</b> ${est[et][1]}`; ctx.cartao.querySelectorAll("#etp span").forEach((s, i) => s.classList.toggle("feito", i <= et)); ctx.$("#ant").disabled = et === 0; ctx.$("#prox").disabled = et === 7; ctx.voar([X(et), 2.5, -2.5], [X(et) + 6, 11, 17]); };
      ctx.$("#ant").onclick = () => ir(et - 1); ctx.$("#prox").onclick = () => ir(et + 1);
      ctx.$("#auto").onclick = e => { auto = !auto; e.target.classList.toggle("ativo", auto); if (auto && et === 7) ir(0); tA = 0; };
      ir(0);
      return {
        raiz, vistas: [["Etapa atual", [X(0) + 6, 11, 17], [X(0), 2.5, -2.5]], ["Linha inteira", [0, 26, 44], [0, 0, -2]]],
        atualizar(dt, t) { frasco.position.x = lerp(frasco.position.x, X(et), Math.min(1, dt * 2)); frasco.rotation.y += dt; liq.scale.y = .9 + Math.sin(t * 3) * .05;
          if (auto) { tA += dt; if (tA > 4.5) { tA = 0; if (et < 7) ir(et + 1); else { auto = false; ctx.$("#auto").classList.remove("ativo"); } } } }
      };
    }
  });

  /* =====================================================================
     7. INDICADORES DE SAÚDE EM 3D
     ===================================================================== */
  lista.push({
    id: "indicadores", em: "📊", titulo: "Indicadores de saúde em 3D", hab: "EF07CI09 · EF07CI11", aulas: "Aulas 1 e 16",
    desc: "Compare quatro cidades fictícias por indicadores de saúde em barras 3D e descubra como saneamento, vacinação e mortalidade infantil se relacionam.",
    html: `<div class="chips" id="tabsI"></div>
      <div class="destaque" id="txt"></div>
      <div class="cartao pequeno"><h4 style="margin-top:0">Dado real — Estado de São Paulo</h4><p>A taxa de mortalidade infantil caiu <b>34%</b> entre 2000 e 2023, chegando a <b>11,2 óbitos por mil nascidos vivos</b> (Fundação SEADE, 2024).</p>
        <p class="mini-txt muted">Mortalidade infantil é um indicador <b>quantitativo</b>; acesso a serviços e condições de moradia são exemplos de indicadores <b>qualitativos</b>.</p></div>
      <div class="cartao pequeno" id="pergI"><b>Analise o painel:</b> qual política pública os indicadores apontam como prioridade para Vila Azul?
        <div class="opcoes" style="margin-top:8px"><button class="opcao" data-c="0">Construir um estádio</button><button class="opcao" data-c="1">Ampliar a coleta de esgoto, a água tratada e a vacinação infantil</button><button class="opcao" data-c="0">Fechar postos de saúde</button></div><div id="fbI"></div></div>
      <details><summary>Saúde segundo a OMS e o SUS</summary><p>Para a OMS, saúde é um estado de completo bem-estar físico, mental e social, e não apenas a ausência de doença. A Constituição de 1988 garante a saúde como direito de todos e dever do Estado; o SUS oferece atendimento universal, integral e gratuito, começando pelas UBS (Atenção Primária).</p></details>`,
    iniciar(ctx) {
      const G = ctx.G, raiz = new T.Group(), R = G.rng(3);
      const cid = ["Vila Azul", "Jardim Sol", "Porto Verde", "Serra Alta"];
      const ind = {
        mort: { t: "Mortalidade infantil", u: " ‰", v: [24, 9, 15, 11], max: 30, bom: "baixo", desc: "óbitos de menores de 1 ano por mil nascidos vivos" },
        vac: { t: "Cobertura vacinal infantil", u: "%", v: [68, 96, 85, 93], max: 100, bom: "alto", desc: "crianças com o calendário vacinal em dia" },
        esg: { t: "Esgoto coletado", u: "%", v: [45, 98, 72, 90], max: 100, bom: "alto", desc: "domicílios ligados à rede de esgoto" },
        agua: { t: "Água tratada", u: "%", v: [74, 100, 91, 97], max: 100, bom: "alto", desc: "domicílios com água potável" },
        diar: { t: "Internações por diarreia", u: "", v: [32, 4, 15, 8], max: 40, bom: "baixo", desc: "internações por 10 mil habitantes" }
      };
      const xs = [-15, -5, 5, 15], barras = [], vals = [0, 0, 0, 0];
      cid.forEach((c, i) => {
        const base = G.malha(new T.CylinderGeometry(4.2, 4.4, .6, 40), G.mat(0x334155), V(xs[i], .3, 0)); raiz.add(base);
        for (let k = 0; k < 7; k++) { const h = .8 + R() * 2.2; const b = G.malha(new T.BoxGeometry(.9, h, .9), G.mat([0x94a3b8, 0xcbd5e1, 0x64748b][k % 3]), V(xs[i] + (R() - .5) * 5.5, .6 + h / 2, (R() - .5) * 5.5)); raiz.add(b); }
        const barra = G.malha(new T.BoxGeometry(2.2, 1, 2.2), G.mat(0x5eead4, { rough: .3, emis: 0x0f766e, ei: .2 }), V(xs[i], .6, 0)); barra.geometry.translate(0, .5, 0); raiz.add(barra); barras.push(barra);
        barra.userData.info = c + " (cidade fictícia)";
      });
      raiz.add(G.malha(new T.BoxGeometry(44, .2, 14), G.mat(0x1e293b), V(0, -.1, 0)));
      let atual = "mort";
      const rots = cid.map((c, i) => ({ txt: c, pos: V(xs[i], -.2, 5), cor: "#94a3b8" })).concat(cid.map((c, i) => ({ txt: "", obj: barras[i], dy: 0, cor: "#5eead4", atualizarTxt: () => fmt(vals[i] ? ind[atual].v[i] : 0) + ind[atual].u, i })));
      ctx.rotulos(rots);
      const cBom = new T.Color(0x22c55e), cRuim = new T.Color(0xef4444);
      function mostrar(k) { atual = k; ctx.cartao.querySelectorAll("#tabsI .chip").forEach(b => b.classList.toggle("ativo", b.dataset.k === k));
        const d = ind[k], melhor = d.bom === "alto" ? Math.max(...d.v) : Math.min(...d.v), pior = d.bom === "alto" ? Math.min(...d.v) : Math.max(...d.v);
        ctx.$("#txt").innerHTML = `<b>${d.t}</b> (${d.desc}). Melhor: <b>${cid[d.v.indexOf(melhor)]}</b> · pior: <b>${cid[d.v.indexOf(pior)]}</b>. ${k === "mort" ? "Repare: a cidade com menos esgoto e água tratada é a que tem mais mortalidade infantil." : ""}`;
        barras.forEach((b, i) => { const q = d.bom === "alto" ? d.v[i] / d.max : 1 - d.v[i] / d.max; b.material.color.copy(cRuim).lerp(cBom, q); });
      }
      ctx.$("#tabsI").innerHTML = Object.entries(ind).map(([k, d]) => `<button class="chip" data-k="${k}">${d.t}</button>`).join("");
      ctx.cartao.querySelectorAll("#tabsI .chip").forEach(b => b.onclick = () => mostrar(b.dataset.k));
      ctx.cartao.querySelectorAll("#pergI .opcao").forEach(b => b.onclick = () => { const ok = b.dataset.c === "1"; ctx.cartao.querySelectorAll("#pergI .opcao").forEach(x => { x.disabled = true; if (x.dataset.c === "1") x.classList.add("certa"); else if (x === b) x.classList.add("errada"); });
        ctx.$("#fbI").innerHTML = `<div class="destaque ${ok ? "saude" : "erro"}">${ok ? "Isso! " : ""}Vila Azul tem os piores índices de saneamento e vacinação — e, não por acaso, a maior mortalidade infantil e mais internações por diarreia. Indicadores orientam onde investir.</div>`; });
      mostrar("mort");
      return {
        raiz, vistas: [["Painel", [0, 18, 46], [0, 5, 0]], ["Lado a lado", [-32, 10, 18], [0, 5, 0]]],
        atualizar(dt) { const d = ind[atual]; barras.forEach((b, i) => { vals[i] = lerp(vals[i], d.v[i] / d.max * 12, Math.min(1, dt * 3)); b.scale.y = Math.max(.05, vals[i]); }); rots.forEach(r => { if (r.i !== undefined) r.dy = .6 + vals[r.i] + .6; }); }
      };
    }
  });

  window.SIMULACOES = { lista, grafico };
})();
