// Cartoon sticker icons (Remy's ink-outline style). The drawings live once in index.html's <defs>;
// sticker("i-flame") makes a small <svg> that shows one. Faces (f-...) use Remy's own frame.
const FACE_BOX = "-18 -12 136 116", WIDE_FACE_BOX = "-28 -12 156 116";
export function sticker(id, { cls = "x-ico", fill, box } = {}) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", box || (id === "f-savage" || id === "f-shock" ? WIDE_FACE_BOX : id.startsWith("f-") ? FACE_BOX : "0 0 100 100"));
  s.setAttribute("class", cls); s.setAttribute("aria-hidden", "true");
  s.innerHTML = `<use href="#${id}"${fill ? ` fill="${fill}"` : ""}/>`;
  return s;
}
// an element with a sticker in front of its text
export function withSticker(tag, cls, id, text, opts) {
  const e = document.createElement(tag); if (cls) e.className = cls;
  const t = document.createElement("span"); t.textContent = text;
  e.append(sticker(id, opts), t);
  return e;
}
