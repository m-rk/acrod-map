"use strict";

const councils = {
  perth: {
    name: "Perth",
    source: "https://catalogue.data.wa.gov.au/dataset/perth-parking-bays-restrictions",
    facility: "https://experience.arcgis.com/experience/b961bb1f42b8489eac34e41abf4df2ed",
  },
  fremantle: {
    name: "Fremantle",
    source: "https://www.arcgis.com/home/item.html?id=580c96bcae66468ea6d7ad55a85def4d",
    approximate: "https://www.fremantle.wa.gov.au/document/acrod-car-park-locations/",
  },
  vincent: {
    name: "Vincent",
    source: "https://vincent.pozi.com/#/map[public]/x[115.85414]/y[-31.93136]/z[14]/filter[ac]/layers[acrodparkingbaysignage]/tab[layers]/",
  },
};
const kinds = { bay: "Individual bay", approx: "Approximate location", carpark: "Car park" };
const map = L.map("map", {
  zoomControl: false, scrollWheelZoom: false, fadeAnimation: false, minZoom: 9, maxZoom: 21,
});
L.control.zoom({ position: "topright" }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const tileStatus = document.querySelector("#tile-status");
const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxNativeZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
}).addTo(map);
let tileLoads = 0;
tiles.on("loading", () => { tileLoads = 0; });
tiles.on("tileload", () => { tileLoads += 1; });
tiles.on("load", () => { tileStatus.hidden = tileLoads > 0; });

const markerLayer = L.layerGroup().addTo(map);
const polygonLayer = L.layerGroup().addTo(map);
const search = document.querySelector("#search");
const results = document.querySelector("#results");
const count = document.querySelector("#result-count");
const buttons = [...document.querySelectorAll("[data-council]")];
const overviewZoom = 12;
const sheet = document.querySelector("#location-sheet");
const sheetName = document.querySelector("#location-name");
const sheetKind = document.querySelector("#location-kind");
const sheetSymbol = document.querySelector("#location-symbol");
const sheetNote = document.querySelector("#location-note");
const sheetSource = document.querySelector("#location-source");
const locations = window.parkingLocations;
let council = "all";
let matching = [];
let selected = null;
let returnFocus = null;
let searchTimer;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(text, url) {
  const anchor = element("a", text);
  anchor.href = url;
  return anchor;
}

function locationDetails(location) {
  const details = [kinds[location.kind]];
  if (location.use) details.push(location.use);
  if (location.bays) details.push(location.bays + (location.bays === 1 ? " bay" : " bays"));
  if (location.reference) details.push(location.reference);
  return details;
}

function fitLocations(list, maxZoom = 16) {
  if (!list.length) return;
  map.fitBounds(L.latLngBounds(list.map(location => location.point)), {
    paddingTopLeft: [28, 36], paddingBottomRight: [57, 44], maxZoom, animate: false,
  });
}

function marker(point, kind, label, content) {
  const size = kind === "cluster" ? 36 : 28;
  const icon = L.divIcon({
    className: "marker " + kind,
    html: content || "",
    iconSize: [size, size],
  });
  const pin = L.marker(point, { icon, title: label, riseOnHover: true }).addTo(markerLayer);
  pin.getElement().setAttribute("aria-label", label);
  return pin;
}

function isCouncilOverview() {
  return council === "all" && !search.value.trim() && map.getZoom() <= overviewZoom;
}

function groupsAtZoom() {
  const grouping = new Map();
  const zoom = map.getZoom();
  for (const location of matching) {
    let key = location.id;
    if (zoom < 19 && location.id !== selected) {
      if (isCouncilOverview()) key = location.council;
      else {
        const pixel = map.project(location.point, zoom);
        key = [Math.floor(pixel.x / 58), Math.floor(pixel.y / 58)].join("/");
      }
    }
    if (!grouping.has(key)) grouping.set(key, []);
    grouping.get(key).push(location);
  }
  return grouping.values();
}

function drawMap() {
  markerLayer.clearLayers();
  polygonLayer.clearLayers();
  for (const group of groupsAtZoom()) {
    if (group.length > 1) {
      const centre = L.latLngBounds(group.map(location => location.point)).getCenter();
      const councilId = group[0].council;
      if (isCouncilOverview()) {
        marker(centre, "cluster", councils[councilId].name + ", " + group.length + " mapped locations. Show council.", group.length)
          .on("click", () => selectCouncil(councilId));
      } else {
        marker(centre, "cluster", group.length + " mapped locations. Zoom in.", group.length)
          .on("click", () => fitLocations(group, Math.min(19, map.getZoom() + 2)));
      }
      continue;
    }
    const location = group[0];
    if (location.geometry && map.getZoom() >= 18) {
      L.geoJSON(location.geometry, {
        interactive: false, style: { color: "#174fa5", weight: 2, fillOpacity: .22 },
      }).addTo(polygonLayer);
    }
    const pin = marker(location.point, location.kind, location.name + ", " + (location.use || kinds[location.kind]),
      location.kind === "carpark" ? "P" : "");
    if (location.id === selected) pin.getElement().classList.add("selected");
    pin.on("click", () => showLocation(location, pin.getElement()));
  }
}

function showLocation(location, mapPin) {
  const fromList = !mapPin;
  returnFocus = mapPin || results.querySelector('[data-location="' + location.id + '"]');
  selected = location.id;
  if (fromList) {
    map.setView(location.point, location.kind === "bay" ? 19 : 17, { animate: false });
  }
  if (fromList) drawMap();
  else {
    const prior = document.querySelector(".marker.selected");
    if (prior) prior.classList.remove("selected");
    mapPin.classList.add("selected");
  }
  for (const button of results.querySelectorAll("button")) {
    if (button.dataset.location === selected) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  }

  sheetName.textContent = location.name;
  sheetSymbol.className = "sheet-symbol " + location.kind;
  sheetSymbol.textContent = location.kind === "carpark" ? "P" : "♿︎";
  const metadata = ["City of " + councils[location.council].name];
  if (location.suburb && location.suburb !== councils[location.council].name) metadata.push(location.suburb);
  metadata.push(...locationDetails(location));
  sheetKind.textContent = metadata.join(" · ");
  sheetNote.textContent = location.note || "";
  sheetNote.hidden = !location.note;
  const sources = councils[location.council];
  sheetSource.href = { carpark: sources.facility, approx: sources.approximate }[location.kind] || sources.source;
  sheet.hidden = false;
  sheet.scrollIntoView({ block: "nearest" });
  sheetName.focus({ preventScroll: true });
}

function closeLocation(restoreFocus = false) {
  selected = null;
  sheet.hidden = true;
  document.querySelector(".marker.selected")?.classList.remove("selected");
  results.querySelector('[aria-current="true"]')?.removeAttribute("aria-current");
  if (restoreFocus) {
    const target = returnFocus?.isConnected ? returnFocus : map.getContainer();
    target.focus();
  }
  returnFocus = null;
}

function filterLocations() {
  const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  matching = locations.filter(location => {
    const haystack = [location.name, location.suburb, location.reference, location.note, councils[location.council].name].join(" ").toLowerCase();
    return (council === "all" || location.council === council) && terms.every(term => haystack.includes(term));
  });
  matching.sort((a, b) => councils[a.council].name.localeCompare(councils[b.council].name)
    || a.name.localeCompare(b.name, "en-AU", { numeric: true }));
  closeLocation();
  count.textContent = matching.length + (matching.length === 1 ? " mapped location" : " mapped locations");
  results.replaceChildren();

  if (!matching.length) {
    const message = element("li", search.value.trim()
      ? "No matching locations. Try a different search."
      : "Open the council source for locations.", "empty");
    if (!search.value.trim() && council !== "all") {
      message.append(" ", link("View council map", councils[council].source));
    }
    results.append(message);
  }
  for (const location of matching) {
    const row = element("li");
    const button = element("button", "", "result");
    button.type = "button";
    button.dataset.location = location.id;
    const details = element("span");
    const metadata = [location.suburb || councils[location.council].name, ...locationDetails(location)];
    details.append(element("strong", location.name), element("small", metadata.join(" · ")));
    const key = element("i", "", "key " + location.kind);
    key.setAttribute("aria-hidden", "true");
    const chevron = element("span", "›", "chevron");
    chevron.setAttribute("aria-hidden", "true");
    button.append(key, details, chevron);
    button.addEventListener("click", () => showLocation(location));
    row.append(button);
    results.append(row);
  }
  results.scrollTop = 0;
  fitLocations(matching);
  drawMap();
}

function selectCouncil(value) {
  clearTimeout(searchTimer);
  council = value;
  for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.council === council));
  filterLocations();
}

for (const button of buttons) {
  button.addEventListener("click", () => selectCouncil(button.dataset.council));
}
search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(filterLocations, 180);
});
document.querySelector("#reset-map").addEventListener("click", () => fitLocations(matching));
sheet.querySelector("button").addEventListener("click", () => closeLocation(true));
sheet.addEventListener("keydown", event => {
  if (event.key === "Escape") closeLocation(true);
});
map.on("zoomend", drawMap);
map.setView([-31.994, 115.804], 11);
filterLocations();
