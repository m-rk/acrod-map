"use strict";

const councils = {
  all: { name: "All councils" },
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
const mapArea = document.querySelector("#map-area");
const locations = window.parkingLocations;
let council = "all";
let matching = [];
let selected = null;
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

function fitLocations(list, maxZoom = 16) {
  if (!list.length) return;
  map.fitBounds(L.latLngBounds(list.map(location => location.point)), {
    paddingTopLeft: [35, 58], paddingBottomRight: [45, 77], maxZoom, animate: false,
  });
}

function marker(point, kind, label, content) {
  const size = kind === "cluster" ? 35 : 23;
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
        key = [Math.floor(pixel.x / 46), Math.floor(pixel.y / 46)].join("/");
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
        interactive: false, style: { color: "#005e57", weight: 2, fillOpacity: .22 },
      }).addTo(polygonLayer);
    }
    const pin = marker(location.point, location.kind, location.name + ", " + kinds[location.kind],
      location.kind === "carpark" ? "P" : "");
    if (location.id === selected) pin.getElement().classList.add("selected");
    pin.on("click", () => showLocation(location, pin.getElement()));
  }
}

function showLocation(location, mapPin) {
  const fromList = !mapPin;
  selected = location.id;
  if (fromList) {
    map.setView(location.point, location.kind === "bay" ? 19 : 17, { animate: false });
    if (window.matchMedia("(max-width: 760px)").matches) {
      document.querySelector(".map-panel").scrollIntoView({ block: "nearest" });
    }
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

  const popup = element("div");
  popup.append(element("strong", location.name));
  popup.append(element("p", "City of " + councils[location.council].name + " · " + kinds[location.kind], "popup-kind"));
  if (location.bays) {
    popup.append(element("p", location.bays + (location.bays === 1 ? " designated bay" : " designated bays") + " reported by council."));
  }
  if (location.note) popup.append(element("p", location.note));
  const sources = councils[location.council];
  const source = { carpark: sources.facility, approx: sources.approximate }[location.kind] || sources.source;
  popup.append(link("View council source", source));
  const detail = L.popup({
    maxWidth: Math.min(265, map.getSize().x - 126),
    autoPanPaddingTopLeft: [14, 52],
    autoPanPaddingBottomRight: [65, 65],
  })
    .setLatLng(location.point).setContent(popup).openOn(map);
  if (fromList) {
    popup.tabIndex = -1;
    popup.focus({ preventScroll: true });
    detail.on("remove", () => {
      if (detail.getElement().contains(document.activeElement)) {
        results.querySelector('[data-location="' + location.id + '"]')?.focus({ preventScroll: true });
      }
    });
  }
}

function filterLocations() {
  const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  matching = locations.filter(location => {
    const haystack = [location.name, location.note, councils[location.council].name].join(" ").toLowerCase();
    return (council === "all" || location.council === council) && terms.every(term => haystack.includes(term));
  });
  matching.sort((a, b) => councils[a.council].name.localeCompare(councils[b.council].name)
    || a.name.localeCompare(b.name, "en-AU", { numeric: true }));
  selected = null;
  map.closePopup();
  mapArea.textContent = councils[council].name;
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
    const metadata = [councils[location.council].name, kinds[location.kind]];
    if (location.bays) metadata.push(location.bays + (location.bays === 1 ? " bay" : " bays"));
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
map.on("zoomend", drawMap);
map.setView([-31.994, 115.804], 11);
filterLocations();
