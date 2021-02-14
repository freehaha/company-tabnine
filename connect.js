let process = null;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
let buffer = "";
const BUFFER_SIZE = 8 * 1024; // 8KB
let arrayBuffer = new Uint8Array(BUFFER_SIZE);

async function killTabnineProcess() {
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
  lisp.message("tabnine process started");
}

function sendRequest(string) {
  if (!process) {
    lisp.setq(lisp.symbols.company_tabnine__process, lisp.symbols.nil);
    return;
  }
  process.stdin.write(encoder.encode(string));
}

let cbCandidate = null;
let prefix = null;
function getCandidates(callback, arg) {
  // lisp.company_tabnine_query();
  prefix = arg;
  cbCandidate = callback;
  getOutput();
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
        try {
          let resp = JSON.parse(buffer);
          let old_prefix = resp.old_prefix;
          if (old_prefix && old_prefix.length > 0 && resp.results.length > 0) {
            lisp.setq(lisp.symbols.company_prefix, old_prefix);
            let result = lisp.json_parse_string(
              buffer,
              lisp.symbols[":object-type"],
              lisp.symbols.alist
            );
            lisp.setq(lisp.symbols.company_tabnine__response, result);
            lisp.funcall(
              cbCandidate,
              lisp.company_tabnine__candidates(old_prefix)
            );
          }
          buffer = "";
        } catch (e) {
          lisp.message(`parse err ${e.message} ${buffer}`);
        }
        return;
      }
      // setTimeout(getOutput, 0);
    })
    .catch(async (err) => {
      lisp.message(`error reading from tabnine, restarting ${err.message}`);
      await killTabnineProcess();
      startTabnineProcess();
    });
}

lisp.defun({
  name: "my/tabnine-send-request",
  docString: "send request to tabnine",
  interactive: false,
  func: sendRequest,
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
  func: killTabnineProcess,
});

lisp.defun({
  name: "my/get-candidates",
  docString: "get candidates",
  interactive: true,
  func: getCandidates,
});
