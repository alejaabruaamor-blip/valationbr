/* Pix (FreePay) — checkout e upsells. API propria em /api/backend */
(function () {
  var API_CREATE = "/api/backend/";
  var API_STATUS = "/api/check_status/";
  var AMOUNTS = { up1: "19,99", up2: "21,99" };
  var CSS =
    "#pixov{position:fixed;inset:0;background:rgba(31,0,46,.75);display:flex;align-items:center;justify-content:center;padding:16px;z-index:99999;font-family:Arial,Helvetica,sans-serif}" +
    "#pixbox{background:#fff;color:#15171a;border-radius:16px;max-width:400px;width:100%;padding:22px;text-align:center;max-height:92vh;overflow:auto}" +
    "#pixbox h3{margin:0 0 4px;font-size:19px}#pixbox p{margin:6px 0;font-size:13px;color:#667085}" +
    "#pixbox button{width:100%;margin-top:12px;padding:14px;border:0;border-radius:999px;background:#820ad1;color:#fff;font-size:15px;font-weight:800;cursor:pointer}" +
    "#pixbox .sec{background:#f5f0fa;color:#15171a}#pixbox img{margin:12px auto;display:block;border-radius:10px}" +
    "#pixcode{word-break:break-all;background:#f5f0fa;border-radius:10px;padding:10px;font-size:11px;color:#15171a;text-align:left}" +
    "#pixerr{color:#820ad1;font-weight:700}";

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    return d.firstChild;
  }
  function read(k) {
    try { return localStorage.getItem(k) || ""; } catch (e) { return ""; }
  }
  function utms() {
    var out = {};
    try {
      var q = new URLSearchParams(location.search);
      ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function (k) {
        var v = q.get(k) || read(k);
        if (v) out[k] = v;
      });
    } catch (e) {}
    return out;
  }

  window.abrirPix = function (step, opts) {
    opts = opts || {};
    if (!document.getElementById("pixcss")) {
      var s = document.createElement("style");
      s.id = "pixcss";
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    var ov = el('<div id="pixov"><div id="pixbox"></div></div>');
    document.body.appendChild(ov);
    var box = ov.querySelector("#pixbox");

    var nome = (opts.name || read("nomeUsuario") || read("cli_nome") || "Cliente").trim();
    var email = (opts.email || read("email") || read("cli_email") || "").trim();
    if (email.indexOf("@") < 0) email = "cliente" + Date.now() + "@email.com";
    var cpf = read("cpfUsuario") || "";
    var fone = read("telephone") || "";
    var amount = opts.amount || AMOUNTS[step] || "19,99";

    function erro(msg) {
      box.innerHTML =
        "<h3>Pagamento via Pix</h3>" +
        '<p id="pixerr">' + msg + "</p>" +
        '<button id="pgo">Tentar novamente</button>' +
        '<button class="sec" id="pfechar">Cancelar</button>';
      box.querySelector("#pfechar").onclick = function () { ov.remove(); };
      box.querySelector("#pgo").onclick = function () { gerar(); };
    }

    function gerar() {
      box.innerHTML = "<h3>Gerando seu Pix...</h3><p>Aguarde um instante</p>";
      var body = { amount: amount, nome: nome, email: email, cpf: cpf, telefone: fone, stage: step };
      var u = utms();
      Object.keys(u).forEach(function (k) { body[k] = u[k]; });
      fetch(API_CREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var qr = d && (d.qr_code || d.qrcode || (d.pix && d.pix.qrcode));
          var id = d && (d.id || d.txid || d.transaction_id);
          if (!qr || !id) {
            erro((d && d.error) || "Não foi possível gerar o Pix.");
            return;
          }
          mostrar({ id: id, qr_code: qr, amount: parseFloat(String(amount).replace(",", ".")) });
        })
        .catch(function () { erro("Falha de conexão. Tente novamente."); });
    }

    function mostrar(d) {
      var valor = Number(d.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      box.innerHTML =
        "<h3>Pague " + valor + " no Pix</h3>" +
        "<p>Escaneie o QR Code ou use o copia e cola</p>" +
        '<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' +
        encodeURIComponent(d.qr_code) +
        '" width="220" height="220" alt="QR Code Pix">' +
        '<div id="pixcode">' + d.qr_code + "</div>" +
        '<button id="pcopy">Copiar código Pix</button>' +
        '<p id="pixstat">Aguardando pagamento...</p>' +
        '<button class="sec" id="pfechar">Fechar</button>';
      box.querySelector("#pfechar").onclick = function () { clearInterval(timer); ov.remove(); };
      box.querySelector("#pcopy").onclick = function () {
        var t = document.createElement("textarea");
        t.value = d.qr_code;
        document.body.appendChild(t);
        t.select();
        try { document.execCommand("copy"); } catch (e) {}
        t.remove();
        box.querySelector("#pcopy").textContent = "Código copiado!";
      };
      var timer = setInterval(function () {
        fetch(API_STATUS + "?txid=" + encodeURIComponent(d.id))
          .then(function (r) { return r.json(); })
          .then(function (s) {
            if (s && s.paid) {
              clearInterval(timer);
              box.querySelector("#pixstat").textContent = "Pagamento confirmado! Redirecionando...";
              if (window.fbq) fbq("track", "Purchase", { value: d.amount, currency: "BRL" });
              var dest = opts.next || s.next || "/";
              if (dest.charAt(0) === "/") {
                var base = location.pathname
                  .replace(/[^\/]*$/, "")
                  .replace(/(checkout|up[1-5]|obrigado|sisc|registro|junin[12])\/$/, "");
                dest = base.replace(/\/$/, "") + dest;
              }
              if (window.comUtm) dest = window.comUtm(dest);
              else dest = dest + window.location.search;
              setTimeout(function () { location.href = dest; }, 900);
            }
          })
          .catch(function () {});
      }, 4000);
    }

    gerar();
  };
})();
