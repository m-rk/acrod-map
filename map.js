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
const closestZoom = 19;
const nearbyLimitMetres = 25000;
const pageSize = 25;
const map = L.map("map", {
  zoomControl: false, scrollWheelZoom: false, bounceAtZoomLimits: false,
  fadeAnimation: false, minZoom: 2, maxZoom: closestZoom,
});
L.control.zoom({ position: "topright" }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const mapCanvas = map.getContainer();
let pinchDelta = 0;
let lastWheelPinch = -Infinity;
let gestureStartZoom = null;
function zoomAtPointer(event, target) {
  const zoom = Math.max(map.getMinZoom(), Math.min(closestZoom, target));
  if (zoom !== map.getZoom()) {
    map.setZoomAround(map.mouseEventToContainerPoint(event), zoom, { animate: false });
  }
}

mapCanvas.addEventListener("wheel", event => {
  if (!event.ctrlKey) return;
  event.preventDefault();
  if (gestureStartZoom !== null) return;
  if (event.timeStamp - lastWheelPinch > 180) pinchDelta = 0;
  lastWheelPinch = event.timeStamp;
  const pixelsPerUnit = [1, 16, mapCanvas.clientHeight][event.deltaMode] || 1;
  pinchDelta -= event.deltaY * pixelsPerUnit;
  const steps = Math.trunc(pinchDelta / 48);
  if (!steps) return;
  pinchDelta %= 48;
  zoomAtPointer(event, map.getZoom() + steps);
}, { passive: false });

// Desktop Safari exposes trackpad pinches as gesture events. Leaflet handles touchscreens.
if (window.matchMedia("(pointer: fine)").matches) {
  mapCanvas.addEventListener("gesturestart", event => {
    event.preventDefault();
    gestureStartZoom = map.getZoom();
  });
  mapCanvas.addEventListener("gesturechange", event => {
    if (gestureStartZoom === null) return;
    event.preventDefault();
    zoomAtPointer(event, gestureStartZoom + Math.round(Math.log2(event.scale)));
  });
  document.addEventListener("gestureend", () => { gestureStartZoom = null; });
}

const tileStatus = document.querySelector("#tile-status");
const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: closestZoom,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
}).addTo(map);
let tileLoads = 0;
tiles.on("loading", () => { tileLoads = 0; });
tiles.on("tileload", () => { tileLoads += 1; });
tiles.on("load", () => { tileStatus.hidden = tileLoads > 0; });

const markerLayer = L.layerGroup().addTo(map);
const polygonLayer = L.layerGroup().addTo(map);
const locationLayer = L.layerGroup().addTo(map);
const search = document.querySelector("#search");
const results = document.querySelector("#results");
const count = document.querySelector("#result-count");
const buttons = [...document.querySelectorAll("[data-council]")];
const explorer = document.querySelector(".explorer");
const mapTop = document.querySelector(".map-top");
const localArea = document.querySelector("#local-area");
const contribution = document.querySelector("#contribution");
const locateButton = document.querySelector("#locate-map");
const locateStatus = document.querySelector("#location-status");
const legend = document.querySelector("#parking-legend");
const resetMap = document.querySelector("#reset-map");
const pageControls = document.querySelector("#results-pages");
const previousPage = document.querySelector("#previous-page");
const nextPage = document.querySelector("#next-page");
const pageNumber = document.querySelector("#page-number");
const resultsToggle = document.querySelector("#results-toggle");
const resultsContent = document.querySelector("#results-content");
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
let visible = [];
let page = 0;
let selected = null;
let returnFocus = null;
let searchTimer;
let userPoint = null;
let locationRequest = 0;
let autoLocate = true;
let browseView = null;
const imports = setupGeoJSONImport(map, () => {
  locationRequest += 1;
  locateButton.disabled = false;
  showLocateStatus("");
}, viewPadding);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function locationDetails(location) {
  const details = [kinds[location.kind]];
  if (location.use) details.push(location.use);
  if (location.bays) details.push(location.bays + (location.bays === 1 ? " bay" : " bays"));
  if (location.reference) details.push(location.reference);
  return details;
}

function viewPadding() {
  const size = map.getSize();
  const panel = mapTop.getBoundingClientRect();
  if (size.x - panel.right >= 220 && panel.bottom > size.y * .55) {
    return { paddingTopLeft: [Math.ceil(panel.right) + 18, 24], paddingBottomRight: [68, 44] };
  }
  const bottom = Math.max(sheet.offsetHeight, legend.offsetHeight) + 44;
  const topInset = Math.min(Math.ceil(panel.bottom) + 15, size.y - 90);
  return {
    paddingTopLeft: [24, Math.max(15, topInset)],
    paddingBottomRight: [68, Math.max(18, Math.min(bottom, size.y - topInset - 55))],
  };
}

function fitLocations(list, maxZoom = 16) {
  if (!list.length) return;
  map.fitBounds(L.latLngBounds(list.map(location => location.point)), {
    ...viewPadding(), maxZoom, animate: false,
  });
}

function focusPoint(point, zoom) {
  const { paddingTopLeft: [left, top], paddingBottomRight: [right, bottom] } = viewPadding();
  const centre = map.project(point, zoom).subtract([(left - right) / 2, (top - bottom) / 2]);
  map.setView(map.unproject(centre, zoom), zoom, { animate: false });
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
  const viewport = map.getBounds().pad(.15);
  const overview = isCouncilOverview();
  for (const location of matching) {
    if (!overview && !viewport.contains(location.point)) continue;
    let key = location.id;
    if (zoom < closestZoom && location.id !== selected) {
      if (overview) key = location.council;
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
  if (browseView) return;
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
          .on("click", () => fitLocations(group, Math.min(closestZoom, map.getZoom() + 2)));
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
  setResultsOpen(false);

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
  if (fromList) {
    focusPoint(location.point, location.kind === "bay" ? closestZoom : 17);
  } else {
    const { left, top, width, height } = mapPin.getBoundingClientRect();
    const hit = document.elementFromPoint(left + width / 2, top + height / 2);
    if (!hit?.closest("#map")) focusPoint(location.point, map.getZoom());
  }
  drawMap();
  results.querySelector('[aria-current="true"]')?.removeAttribute("aria-current");
  results.querySelector('[data-location="' + location.id + '"]')?.setAttribute("aria-current", "true");
  sheetName.focus({ preventScroll: true });
}

function closeLocation(restoreFocus = false) {
  const previous = selected;
  const selectedMarker = document.querySelector(".marker.selected");
  selected = null;
  sheet.hidden = true;
  selectedMarker?.classList.remove("selected");
  results.querySelector('[aria-current="true"]')?.removeAttribute("aria-current");
  if (restoreFocus) {
    const replacement = previous && results.querySelector('[data-location="' + previous + '"]');
    const markerReplacement = returnFocus?.classList.contains("marker") ? selectedMarker : null;
    const target = [returnFocus, markerReplacement, replacement].find(button => button?.isConnected && button.getClientRects().length)
      || resultsToggle;
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
  closeLocation();
  if (terms.length && !matching.length) setResultsOpen(true);
  showLocateStatus("");
  fitLocations(matching);
  refreshMap();
}

function refreshMap() {
  if (browseView) return;
  drawMap();
  const bounds = map.getBounds();
  const origin = userPoint && bounds.contains(userPoint) ? userPoint : map.getCenter();
  visible = matching.filter(location => bounds.contains(location.point))
    .map(location => ({ location, distance: origin.distanceTo(location.point) }))
    .sort((a, b) => a.distance - b.distance)
    .map(entry => entry.location);
  page = 0;
  renderResults();
}

function renderResults() {
  count.textContent = visible.length + (visible.length === 1 ? " location" : " locations");
  const pages = Math.ceil(visible.length / pageSize);
  pageControls.hidden = pages < 2;
  pageNumber.textContent = (page + 1) + " / " + pages;
  previousPage.disabled = page === 0;
  nextPage.disabled = page + 1 >= pages;
  results.replaceChildren();

  if (!visible.length) {
    const message = element("li", matching.length
      ? "No locations in this view."
      : "No matching locations. Try another search or council.", "empty");
    if (matching.length) {
      const fit = element("button", "Show results on map", "secondary-button");
      fit.type = "button";
      fit.addEventListener("click", () => fitLocations(matching));
      message.append(fit);
    }
    results.append(message);
  }
  for (const location of visible.slice(page * pageSize, (page + 1) * pageSize)) {
    const row = element("li");
    const button = element("button", "", "result");
    button.type = "button";
    button.dataset.location = location.id;
    if (location.id === selected) button.setAttribute("aria-current", "true");
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
}

function showLocateStatus(text) {
  locateStatus.textContent = text;
  locateStatus.hidden = !text;
}

function useLocation(onLoad = false) {
  if (!navigator.geolocation || !window.isSecureContext) {
    if (!onLoad) showLocateStatus("Device location requires a secure browser connection. You can still move the map.");
    return;
  }
  const request = ++locationRequest;
  locateButton.disabled = true;
  if (!onLoad) showLocateStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    if (request !== locationRequest) return;
    locateButton.disabled = false;
    if (onLoad && !autoLocate) return;
    userPoint = L.latLng(coords.latitude, coords.longitude);
    locationLayer.clearLayers();
    L.circleMarker(userPoint, {
      radius: 7, color: "#fff", weight: 3, fillColor: "#08796d", fillOpacity: 1,
    }).bindTooltip("Your location").addTo(locationLayer);

    if (browseView) {
      focusPoint(userPoint, 15);
      showLocateStatus("");
      return;
    }
    let nearest = null;
    let distance = nearbyLimitMetres;
    for (const location of matching) {
      const metres = userPoint.distanceTo(location.point);
      if (metres <= distance) {
        nearest = location;
        distance = metres;
      }
    }
    if (nearest) {
      map.fitBounds(L.latLngBounds([userPoint, nearest.point]), {
        ...viewPadding(), maxZoom: 16, animate: false,
      });
      showLocateStatus("");
    } else {
      focusPoint(userPoint, 13);
      showLocateStatus("No matching parking records within 25 km.");
    }
  }, error => {
    if (request !== locationRequest) return;
    locateButton.disabled = false;
    if (!onLoad) showLocateStatus(error.code === 1
      ? "Location access is off. You can still move the map."
      : "Couldn’t get your location. Try again or move the map.");
  }, { timeout: 8000, maximumAge: 120000 });
}

function setResultsOpen(open) {
  resultsContent.hidden = !open;
  resultsToggle.setAttribute("aria-expanded", String(open));
}

function toggleContribution() {
  clearTimeout(searchTimer);
  locationRequest += 1;
  locateButton.disabled = false;
  showLocateStatus("");
  if (browseView) {
    const { center, zoom } = browseView;
    browseView = null;
    imports.clear();
    setContributionVisibility(false);
    map.setView(center, zoom, { animate: false });
    refreshMap();
    localArea.focus();
    return;
  }
  browseView = { center: map.getCenter(), zoom: map.getZoom() };
  closeLocation();
  markerLayer.clearLayers();
  polygonLayer.clearLayers();
  setContributionVisibility(true);
  document.querySelector("#contribution-title").focus({ preventScroll: true });
  useLocation();
}

function setContributionVisibility(active) {
  for (const id of ["browse-results", "parking-legend"]) {
    document.getElementById(id).hidden = active;
  }
  search.disabled = active;
  for (const button of buttons) button.disabled = active;
  contribution.hidden = !active;
  resetMap.hidden = active;
  localArea.setAttribute("aria-expanded", String(active));
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
search.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  clearTimeout(searchTimer);
  setResultsOpen(true);
  filterLocations();
});
resetMap.addEventListener("click", () => fitLocations(matching));
localArea.addEventListener("click", toggleContribution);
document.querySelector("#close-contribution").addEventListener("click", toggleContribution);
contribution.addEventListener("keydown", event => {
  if (event.key === "Escape") toggleContribution();
});
resultsToggle.addEventListener("click", () => {
  if (resultsContent.hidden) closeLocation();
  setResultsOpen(resultsContent.hidden);
});
locateButton.addEventListener("click", () => useLocation());
previousPage.addEventListener("click", () => {
  page -= 1;
  renderResults();
  if (previousPage.disabled) nextPage.focus();
});
nextPage.addEventListener("click", () => {
  page += 1;
  renderResults();
  if (nextPage.disabled) previousPage.focus();
});
sheet.querySelector("button").addEventListener("click", () => closeLocation(true));
sheet.addEventListener("keydown", event => {
  if (event.key === "Escape") closeLocation(true);
});
map.setView([-31.994, 115.804], 11);
const controlsObserver = new ResizeObserver(() => {
  const panel = mapTop.getBoundingClientRect();
  const top = explorer.clientWidth - panel.right >= 68 ? panel.top : panel.bottom + 3;
  explorer.style.setProperty("--zoom-top", Math.ceil(top) + "px");
});
controlsObserver.observe(explorer);
controlsObserver.observe(mapTop);
map.on("moveend", refreshMap);
map.on("dragstart", () => showLocateStatus(""));
filterLocations();
for (const event of ["pointerdown", "keydown"]) {
  document.addEventListener(event, () => { autoLocate = false; }, { once: true, capture: true });
}
navigator.permissions?.query({ name: "geolocation" }).then(permission => {
  if (autoLocate && permission.state === "granted") useLocation(true);
}).catch(() => {});
