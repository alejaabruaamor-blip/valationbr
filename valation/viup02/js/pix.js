/* Pix (FreePay) — checkout e upsells. */
(function () {
  var API = "https://magic-play-helper.lovable.app/api/public/pix";
  var CSS =
    "#pixov{position:fixed;inset:0;background:rgba(15,23,42,.7);display:flex;align-items:center;justify-content:center;padding:16px;z-index:99999;font-family:Arial,Helvetica,sans-serif}" +
    "#pixbox{background:#fff;color:#15171a;border-radius:16px;max-width:400px;width:100%;padding:22px;text-align:center;max-height:92vh;overflow:auto}" +
    "#pixbox h3{margin:0 0 4px;font-size:19px}#pixbox p{margin:6px 0;font-size:13px;color:#667085}" +
    "#pixbox input{width:100%;box-sizing:border-box;margin-top:8px;padding:12px;border:1px solid #d6dee8;border-radius:10px;font-size:15px}" +
    "#pixbox button{width:100%;margin-top:12px;padding:14px;border:0;border-radius:10px;background:#e11d48;color:#fff;font-size:15px;font-weight:800;cursor:pointer}" +
    "#pixbox .sec{background:#f2f4f7;color:#15171a}#pixbox img{margin:12px auto;display:block;border-radius:10px}" +
    "#pixcode{word-break:break-all;background:#f2f4f7;border-radius:10px;padding:10px;font-size:11px;color:#15171a;text-align:left}" +
    "#pixerr{color:#e11d48;font-weight:700}";

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    return d.firstChild;
  }
  function store(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  function read(k) {
    try {
      return localStorage.getItem(k) || "";
    } catch (e) {
      return "";
    }
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

    var nome = (opts.name || read("cli_nome") || "").trim();
    var email = (opts.email || read("cli_email") || "").trim();

    function form(msg) {
      box.innerHTML =
        "<h3>Pagamento via Pix</h3>" +
        (msg ? '<p id="pixerr">' + msg + "</p>" : "") +
        '<input id="pn" placeholder="Nome e sobrenome" value="' + nome + '">' +
        '<input id="pe" placeholder="E-mail" value="' + email + '">' +
        '<button id="pgo">Gerar Pix</button>' +
        '<button class="sec" id="pfechar">Cancelar</button>';
      box.querySelector("#pfechar").onclick = function () {
        ov.remove();
      };
      box.querySelector("#pgo").onclick = function () {
        nome = box.querySelector("#pn").value.trim();
        email = box.querySelector("#pe").value.trim();
        if (!nome || email.indexOf("@") < 0) {
          form("Preencha nome e e-mail corretamente.");
          return;
        }
        store("cli_nome", nome);
        store("cli_email", email);
        gerar();
      };
    }

    function gerar() {
      box.innerHTML = "<h3>Gerando seu Pix...</h3><p>Aguarde um instante</p>";
      fetch(API + "/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: step, name: nome, email: email }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          if (!d || !d.qr_code) {
            form((d && d.error) || "Não foi possível gerar o Pix.");
            return;
          }
          mostrar(d);
        })
        .catch(function () {
          form("Falha de conexão. Tente novamente.");
        });
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
      box.querySelector("#pfechar").onclick = function () {
        clearInterval(timer);
        ov.remove();
      };
      box.querySelector("#pcopy").onclick = function () {
        var t = document.createElement("textarea");
        t.value = d.qr_code;
        document.body.appendChild(t);
        t.select();
        try {
          document.execCommand("copy");
        } catch (e) {}
        t.remove();
        box.querySelector("#pcopy").textContent = "Código copiado!";
      };
      var timer = setInterval(function () {
        fetch(API + "/status?id=" + encodeURIComponent(d.id))
          .then(function (r) {
            return r.json();
          })
          .then(function (s) {
            if (s && s.paid) {
              clearInterval(timer);
              box.querySelector("#pixstat").textContent = "Pagamento confirmado! Redirecionando...";
              if (window.fbq) fbq("track", "Purchase", { value: d.amount, currency: "BRL" });
              var dest = opts.next || d.next || "/";
              if (dest.charAt(0) === "/") {
                var base = location.pathname
                  .replace(/[^\/]*$/, "")
                  .replace(/(checkout|up[1-5]|obrigado|sisc|registro|junin[12])\/$/, "");
                dest = base.replace(/\/$/, "") + dest;
              }
              if (window.comUtm) dest = window.comUtm(dest);
              else dest = dest + window.location.search;
              setTimeout(function () {
                location.href = dest;
              }, 900);
            }
          })
          .catch(function () {});
      }, 4000);
    }

    if (nome && email.indexOf("@") > 0) {
      store("cli_nome", nome);
      store("cli_email", email);
      gerar();
    } else if (step === "checkout") {
      form("");
    } else {
      nome = "Cliente";
      email = "cliente" + Date.now() + "@email.com";
      gerar();
    }
  };
})();
