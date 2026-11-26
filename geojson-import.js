"use strict";

const maxImportBytes = 5 * 1024 * 1024;
const maxImportFeatures = 5000;
const maxImportPositions = 100000;

function parseGeoJSON(text) {
  if (new Blob([text]).size > maxImportBytes) throw new Error("Use a GeoJSON file under 5 MB.");
  let input;
  try {
    input = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("This text is not valid JSON. Check that it contains the complete GeoJSON.");
  }
  if (!input || typeof input !== "object") throw new Error("Choose a GeoJSON file or paste a GeoJSON object.");
  if (input.crs && !/^(?:EPSG:4326|urn:ogc:def:crs:EPSG::4326|urn:ogc:def:crs:OGC:(?::|1\.3:)CRS84)$/i.test(input.crs.properties?.name)) {
    throw new Error("Export the layer in WGS 84 (EPSG:4326) and try again.");
  }

  const features = input.type === "FeatureCollection" ? input.features
    : [input.type === "Feature" ? input : { type: "Feature", geometry: input, properties: {} }];
  if (!Array.isArray(features)) throw new Error("The FeatureCollection needs a features array.");
  if (features.length > maxImportFeatures) throw new Error("Preview up to 5,000 features at a time.");
  const geometryDepth = { Point: 0, MultiPoint: 1, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3 };
  let positions = 0;

  function validateCoordinates(coordinates, depth) {
    if (!Array.isArray(coordinates) || !coordinates.length) throw new Error("Some features have missing coordinates.");
    if (depth) {
      coordinates.forEach(item => validateCoordinates(item, depth - 1));
      return;
    }
    const [longitude, latitude] = coordinates;
    if (coordinates.length < 2 || !coordinates.every(Number.isFinite) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
      throw new Error("Use WGS 84 coordinates in [longitude, latitude] order.");
    }
    if (++positions > maxImportPositions) throw new Error("This file has too much detail for one preview. Export a smaller area.");
  }

  function validateGeometry(geometry, level = 0) {
    if (geometry?.type === "GeometryCollection") {
      if (level >= 8 || !Array.isArray(geometry.geometries)) throw new Error("The file contains an invalid GeometryCollection.");
      geometry.geometries.forEach(item => validateGeometry(item, level + 1));
      return;
    }
    if (!geometry || !Object.hasOwn(geometryDepth, geometry.type)) throw new Error("The file contains a feature with an unrecognised geometry.");
    const { type, coordinates } = geometry;
    validateCoordinates(coordinates, geometryDepth[type]);
    if (type === "LineString" || type === "MultiLineString") {
      const lines = type === "LineString" ? [coordinates] : coordinates;
      if (lines.some(line => line.length < 2)) throw new Error("Each line needs at least two positions.");
    }
    if (type === "Polygon" || type === "MultiPolygon") {
      const polygons = type === "Polygon" ? [coordinates] : coordinates;
      for (const rings of polygons) {
        for (const ring of rings) {
          const [first] = ring;
          const last = ring[ring.length - 1];
          if (ring.length < 4 || first.length !== last.length || first.some((value, i) => value !== last[i])) {
            throw new Error("Each polygon ring needs at least four positions and must return to its starting point.");
          }
        }
      }
    }
  }

  const mappable = [];
  for (const feature of features) {
    if (feature?.type !== "Feature" || !Object.hasOwn(feature, "geometry")) {
      throw new Error("Each entry in a FeatureCollection must be a GeoJSON Feature with geometry.");
    }
    if (feature.geometry === null) continue;
    const previousPositions = positions;
    validateGeometry(feature.geometry);
    if (positions > previousPositions) mappable.push(feature);
  }
  if (!positions) throw new Error("The file contains no features with a mappable location.");
  return { data: { type: "FeatureCollection", features: mappable }, skipped: features.length - mappable.length, original: input };
}

function setupGeoJSONImport(map, onPreview) {
  const form = document.querySelector("#geojson-form");
  const fileInput = form.querySelector("#geojson-file");
  const textInput = form.querySelector("#geojson-text");
  const status = form.querySelector("#import-status");
  const submit = document.querySelector("#submit-geojson");
  const help = document.querySelector("#geojson-help");
  const preview = L.featureGroup().addTo(map);
  const renderer = L.canvas({ padding: .3 });
  let exportData = null;
  let load = 0;

  function clear() {
    load += 1;
    exportData = null;
    status.hidden = true;
    submit.hidden = true;
    preview.clearLayers();
  }

  function message(text, error = false) {
    status.textContent = text;
    status.hidden = false;
    status.toggleAttribute("data-error", error);
  }

  function render(text) {
    clear();
    try {
      const { data, skipped, original } = parseGeoJSON(text);
      const style = { renderer, color: "#08796d", weight: 3, fillOpacity: .24 };
      const layer = L.geoJSON(data, {
        style,
        pointToLayer: (_, point) => L.circleMarker(point, { ...style, radius: 7, fillOpacity: .6 }),
        onEachFeature: (feature, featureLayer) => {
          const properties = feature.properties;
          const name = [properties?.name, properties?.NAME, properties?.title, properties?.address]
            .find(value => typeof value === "string" && value.trim());
          if (name) {
            const label = document.createElement("span");
            label.textContent = name.trim().slice(0, 200);
            featureLayer.bindPopup(label);
          }
        },
      });
      const bounds = layer.getBounds();
      if (!bounds.isValid()) throw new Error("The file contains no features with a mappable location.");
      preview.addLayer(layer);
      exportData = original;
      onPreview();
      map.fitBounds(bounds, { padding: [42, 65], maxZoom: 16, animate: false });
      const number = data.features.length;
      message(number + (number === 1 ? " feature on the map." : " features on the map.")
        + (skipped ? " Skipped " + skipped + " without locations." : ""));
      submit.hidden = false;
      if (window.matchMedia("(max-width: 760px)").matches) map.getContainer().scrollIntoView({ block: "nearest" });
    } catch (error) {
      message(error.message, true);
    }
  }

  async function previewFile(file) {
    clear();
    const request = load;
    if (file.size > maxImportBytes) {
      message("Use a GeoJSON file under 5 MB.", true);
      return;
    }
    try {
      const text = await file.text();
      if (request === load) render(text);
    } catch {
      if (request === load) message("Couldn’t open that file. Try again or paste its contents.", true);
    }
  }

  fileInput.addEventListener("change", () => {
    const [file] = fileInput.files;
    if (file) {
      textInput.value = "";
      previewFile(file);
    }
  });
  textInput.addEventListener("input", event => {
    fileInput.value = "";
    clear();
    if (event.inputType === "insertFromPaste") render(textInput.value);
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (textInput.value.trim()) render(textInput.value);
    else if (fileInput.files.length) previewFile(fileInput.files[0]);
    else message("Choose a GeoJSON file or paste GeoJSON to preview it.", true);
  });
  document.querySelector("#geojson-help-button").addEventListener("click", () => help.showModal());
  document.querySelector("#download-geojson").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportData) + "\n"], { type: "application/json" }));
    const download = document.createElement("a");
    download.href = url;
    download.download = "accessible-parking.json";
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return { clear };
}
