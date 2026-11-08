// Start-screen menu: small round icon buttons tucked into the top corners, so they take no
// space and the start screen still never scrolls. menu.add(icon, label, onTap).
export function createMenu() {
  const slot = document.getElementById("slot-start-menu");
  const left = document.createElement("div"); left.className = "x-menu x-menu-left";
  const right = document.createElement("div"); right.className = "x-menu x-menu-right";
  slot.replaceChildren(left, right);
  let count = 0;
  return {
    add(icon, label, onTap) {
      const b = document.createElement("button");
      b.className = "x-menu-btn"; b.textContent = icon; b.title = label; b.setAttribute("aria-label", label);
      b.addEventListener("click", onTap);
      (count++ % 2 === 0 ? left : right).append(b);
      return b;
    },
  };
}
