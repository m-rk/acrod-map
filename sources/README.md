# Contribute accessible parking data

Use a pull request to suggest a new area or correct an existing dataset. Council open data, GIS exports and official parking maps are good starting points. Check that the source licence permits redistribution before uploading a copy. If a copy can’t be shared, include the source link in the pull request instead.

1. Export the data as a GeoJSON `FeatureCollection` in WGS 84. Coordinates go in `[longitude, latitude]` order. Use one feature per mapped bay, approximate location or car park. Give each feature a street, landmark or car park name where available. Keep official references and restrictions, and identify approximate and car park-level locations clearly. Use `"geometry": null` for records with unknown coordinates, or omit those records.
2. Open the map, choose **Add your area**, and upload or paste the GeoJSON. Check the feature count and spot-check the pins against the source. [Open the parking map](https://m-rk.github.io/acrod-map/)
3. Fork `m-rk/acrod-map` and create a branch. Add the file in a folder under `sources/` for your area, such as `sources/city-of-example/parking.geojson`. [Fork the repository](https://github.com/m-rk/acrod-map/fork)
4. Open a pull request from your branch to `m-rk/acrod-map` on `main`. Include the council or area, source URL, licence, date retrieved, what the points represent and any known gaps. For a correction, describe what changed. [GitHub’s guide to pull requests from forks](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork)

Files in `sources/` are reviewed before they’re added to the public map.

Open the [one-bay GeoJSON example](examples/perth-bay.geojson), select **Raw**, then copy and paste it into **Add your area**. It uses the mapped centre of a City of Perth restriction polygon and retains its source link and bay reference. [City of Perth dataset, CC BY 4.0](https://catalogue.data.wa.gov.au/dataset/perth-parking-bays-restrictions) · [Street and suburb sources](#location-labels)

For an example of proposing a source with reuse terms still to confirm, see the [Town of Victoria Park source proposal](victoria-park/README.md).

## Download existing data

| Area | GeoJSON |
| --- | --- |
| City of Perth | [parking.geojson](perth/parking.geojson) |
| City of Fremantle | [parking.geojson](fremantle/parking.geojson) |
| City of Vincent | [parking.geojson](vincent/parking.geojson) |

The map reads `sources/<area>/parking.geojson` for each configured council. To add an area to a fork, add its slug and display name in [map.js](../map.js) and a council filter in [index.html](../index.html).

Each feature has a stable string `id` beginning with its area slug and a hyphen. Its properties include `council` (the area slug), `name`, `kind` (`bay`, `approx` or `carpark`), and the council’s HTTPS `source_url`. The files preserve notes, source references, suburbs, record IDs, use and bay counts where available. Point features use their geometry as the pin. Polygon features preserve the source shape and store the pin in `properties.marker_coordinates` in `[longitude, latitude]` order.

## Data provenance

Snapshot retrieved 26 November 2026. Counts below describe mapped records or locations. Signs and bay markings apply on arrival. The map has no occupancy data.

| Council | Mapped locations | Method |
| --- | ---: | --- |
| Perth | 101 on-street locations and 30 car parks | Used the ArcGIS web map's ACROD filter on the WA catalogue's parking restrictions layer. Of 102 matching restriction records, two had the same polygon. Both source IDs and distinct descriptions are retained together. Pins show polygon centres. Two records are marked pick-up or set-down only. The car park layer contributes facility-level points with a positive ACROD count. |
| Fremantle | 254 individual bay points and 13 approximate CBD locations | The council's GIS layer, last edited in March 2021, supplies individual bay coordinates. The 2026 CBD PDF contributes approximate symbols with no GIS point within 60 metres of the projected location. An affine fit to 14 OpenStreetMap street intersections registered the PDF. Leave-one-out checks across these controls gave differences up to 24 metres. Printed symbols may represent several bays or a car park. |
| Vincent | 130 individual bay signage points | Used the WGS84 point geometry from the ACROD Parking Bay Signage layer loaded by the council's public Pozi map. Points locate the mapped signage. The snapshot includes car park names where supplied by that layer. |

- **Perth** [WA data catalogue, CC BY 4.0](https://catalogue.data.wa.gov.au/dataset/perth-parking-bays-restrictions) · [Council ArcGIS map](https://experience.arcgis.com/experience/b961bb1f42b8489eac34e41abf4df2ed) · [Restriction layer](https://services7.arcgis.com/v8XBa2naYNQGOjlG/arcgis/rest/services/PS_AST_PARKINGBAYSEXPLODED_PV/FeatureServer/0) · [Car park layer](https://services7.arcgis.com/v8XBa2naYNQGOjlG/arcgis/rest/services/PS_OTH_CARPARKCENTROID_PV/FeatureServer/0).
- **Fremantle** [Council parking page](https://www.fremantle.wa.gov.au/services-and-support/parking-and-transport/parking-locations/) · [Accessible Freo CBD map (PDF)](https://www.fremantle.wa.gov.au/document/acrod-car-park-locations/) · [Council GIS layer](https://www.arcgis.com/home/item.html?id=580c96bcae66468ea6d7ad55a85def4d).
- **Vincent** [Council accessible parking page](https://www.vincent.wa.gov.au/our-neighbourhood/parking/accessible-parking-acrod.aspx) · [Council map with the ACROD layer selected](https://vincent.pozi.com/#/map[public]/x[115.85414]/y[-31.93136]/z[14]/filter[ac]/layers[acrodparkingbaysignage]/tab[layers]/).
- **Basemap and Fremantle registration** [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

### Location labels

Council-supplied facility names take priority. Other bay titles use a named road centreline within 65 metres where available. For the remaining records, nearby street and landmark names were checked against the parking coordinates. Labels give local context. Pins show the original recorded positions. Bay references preserve the identifiers shown in the original map.

- **Road names** [Main Roads Western Australia Road Network](https://catalogue.data.wa.gov.au/dataset/mrwa-road-network). The Commissioner of Main Roads is the creator and owner of the source data. This map derives nearby street labels from that data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), which includes disclaimers of warranties and liability.
- **Suburb context** [Australian Bureau of Statistics Suburbs and Localities, ASGS Edition 3](https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SAL/MapServer), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). These areas approximate gazetted suburb boundaries.
- **Landmarks and additional streets** [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Facility naming also references [City of Vincent parks and facilities](https://www.vincent.wa.gov.au/parks-and-facilities) and [Rottnest Express terminal locations](https://rottnestexpress.com.au/ferry-information/our-locations-parking/).
