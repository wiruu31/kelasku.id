const NS = "http://www.w3.org/2000/svg";

// Set ikon garis sendiri: 24x24, garis 1.5, ujung membulat.
const PATHS = {
  dashboard: ["M4 5.5A1.5 1.5 0 0 1 5.5 4H10v7H4z", "M14 4h4.5A1.5 1.5 0 0 1 20 5.5V9h-6z", "M14 13h6v5.5a1.5 1.5 0 0 1-1.5 1.5H14z", "M4 15h6v5H5.5A1.5 1.5 0 0 1 4 18.5z"],
  ringkasan: ["M12 3 3 8l9 5 9-5z", "M3 12.5l9 5 9-5", "M3 16.5l9 5 9-5"],
  role: ["M12 3 5 6v5.5c0 4.2 2.8 7.4 7 9.5 4.2-2.1 7-5.3 7-9.5V6z", "M9 12l2.2 2.2L15.5 10"],
  kelas: ["M4 5h16v14H4z", "M12 9v6", "M9 12h6"],
  sekolah: ["M3 9.5 12 4l9 5.5", "M5 10v9h14v-9", "M9 19v-5h6v5", "M12 4V2"],
  siaran: ["M4 10v4h3l8 4V6L7 10z", "M18.5 9.5a4 4 0 0 1 0 5"],
  log: ["M6 3.5h12v17H6z", "M9 8h6", "M9 12h6", "M9 16h3"],
  atur: ["M4 7h9", "M17 7h3", "M4 17h3", "M11 17h9", "M13 5v4h4V5z", "M7 15v4h4v-4z"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  tutup: ["M6 6l12 12", "M18 6 6 18"],
  panah: ["M9 6l6 6-6 6"],
  cari: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M20 20l-4-4"],
  keluar: ["M10 4H5v16h5", "M15 8l4 4-4 4", "M19 12H9"],
};

export function icon(name, size) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  if (size) {
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
  }
  for (const d of PATHS[name] ?? []) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

// Tanda merek: halaman buku dengan huruf K, ditambah garis kecil pembeda "admin".
export function brandMark() {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("class", "brand__mark");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<rect x="4" y="4" width="56" height="56" rx="16" fill="#1a1816" stroke="#ff7a45" stroke-width="2"/>' +
    '<path d="M20 16v32M20 33l17-17M26 30l14 18" fill="none" stroke="#ede8e1" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M44 12h8v8" fill="none" stroke="#ff7a45" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
}
