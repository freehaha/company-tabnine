let process = null;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
let buffer = "";
let arrayBuffer = new Uint8Array(4096);

async function killProcess() {
  if (process) {
    await process.kill(processId);
    process = null;
    lisp.setq(lisp.symbols.company_tabnine__process, lisp.symbols.nil);
  }
}

function startTabnineProcess() {
  // killProcess()
  let execPath = lisp.company_tabnine__executable_path();
  let p = Deno.run({
    cmd: [execPath, "--client", "emacs-ng"],
    stdin: "piped",
    stdout: "piped",
  });
  lisp.setq(lisp.symbols.company_tabnine__process, lisp.symbols.t);
  process = p;
  lisp.print("tabnine process started");
  setTimeout(getOutput, 0);
}

function sendString(string) {
  if (!process) {
    lisp.setq(lisp.symbols.company_tabnine__process, lisp.symbols.nil);
    return;
  }
  process.stdin.write(encoder.encode(string));
}

function getCandidates(callback) {
  lisp.funcall(callback, lisp.company_tabnine__candidates(""));
}

function getOutput() {
  if (!process) return;
  process.stdout
    .read(arrayBuffer)
    .then((len) => {
      let out = decoder.decode(arrayBuffer.slice(0, len));
      buffer += out;
      if (out[out.length - 1] === "\n") {
        let blist = buffer.split("\n");
        buffer = blist.pop();
        if (!buffer || buffer.length === 0) {
          buffer = blist.pop();
        }
        // lisp.setq(lisp.symbols.company_tabnine__response);
        try {
          let result = lisp.json_parse_string(
            buffer,
            lisp.symbols[":object-type"],
            lisp.symbols.alist
          );
          lisp.setq(lisp.symbols.company_tabnine__response, result);
          buffer = "";
        } catch (e) {
          lisp.print(`parse err ${e.message} ${buffer}`);
        }
      }
      setTimeout(getOutput, 0);
    })
    .catch((err) => {
      lisp.print(`read err ${err.message}`);
    });
}

lisp.defun({
  name: "my/tabnine-send-request",
  docString: "send request to tabnine",
  interactive: false,
  func: sendString,
});

lisp.defun({
  name: "my/start-tabnine-process",
  docString: "start tabnine process",
  interactive: true,
  func: startTabnineProcess,
});

lisp.defun({
  name: "my/kill-tabnine-process",
  docString: "kill tabnine process",
  interactive: false,
  func: killProcess,
});

lisp.defun({
  name: "my/get-candidates",
  docString: "get candidates",
  interactive: true,
  func: getCandidates,
});

lisp.defun({
  name: "my/test",
  docString: "get candidates",
  interactive: true,
  func: function () {
    return lisp.make.alist({
      a: 123,
      b: "abc",
    });
  },
});
