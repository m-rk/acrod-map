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
  zoomControl: false, scrollWheelZoom: false, fadeAnimation: false, minZoom: 2, maxZoom: closestZoom,
});
L.control.zoom({ position: "topright" }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

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
const localArea = document.querySelector("#local-area");
const contribution = document.querySelector("#contribution");
const locateButton = document.querySelector("#locate-map");
const locateStatus = document.querySelector("#location-status");
const resetMap = document.querySelector("#reset-map");
const pageControls = document.querySelector("#results-pages");
const previousPage = document.querySelector("#previous-page");
const nextPage = document.querySelector("#next-page");
const pageNumber = document.querySelector("#page-number");
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
});

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
  if (fromList) {
    map.setView(location.point, location.kind === "bay" ? closestZoom : 17, { animate: false });
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
  const previous = selected;
  selected = null;
  sheet.hidden = true;
  document.querySelector(".marker.selected")?.classList.remove("selected");
  results.querySelector('[aria-current="true"]')?.removeAttribute("aria-current");
  if (restoreFocus) {
    const replacement = previous && results.querySelector('[data-location="' + previous + '"]');
    const target = returnFocus?.isConnected ? returnFocus : replacement || map.getContainer();
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
      map.setView(userPoint, 15, { animate: false });
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
        paddingTopLeft: [36, 82], paddingBottomRight: [62, 45], maxZoom: 16, animate: false,
      });
      showLocateStatus("");
    } else {
      map.setView(userPoint, 13, { animate: false });
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
    map.invalidateSize({ pan: false });
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
  map.invalidateSize({ pan: false });
  document.querySelector("#contribution-title").focus({ preventScroll: true });
  useLocation();
}

function setContributionVisibility(active) {
  explorer.classList.toggle("contribution-mode", active);
  for (const id of ["browse-tools", "browse-results", "parking-legend"]) {
    document.getElementById(id).hidden = active;
  }
  contribution.hidden = !active;
  resetMap.hidden = active;
  localArea.textContent = active ? "Back to map" : "Add your area";
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
resetMap.addEventListener("click", () => fitLocations(matching));
localArea.addEventListener("click", toggleContribution);
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
map.on("moveend", refreshMap);
map.on("dragstart", () => showLocateStatus(""));
filterLocations();
for (const event of ["pointerdown", "keydown"]) {
  document.addEventListener(event, () => { autoLocate = false; }, { once: true, capture: true });
}
navigator.permissions?.query({ name: "geolocation" }).then(permission => {
  if (autoLocate && permission.state === "granted") useLocation(true);
}).catch(() => {});
