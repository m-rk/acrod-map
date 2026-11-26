# Parking data sources

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

## Location labels

Council-supplied facility names take priority. Other bay titles use a named road centreline within 65 metres where available. For the remaining records, nearby street and landmark names were checked against the parking coordinates. Labels give local context. Pins show the original recorded positions. Bay references preserve the identifiers shown in the original map.

- **Road names** [Main Roads Western Australia Road Network](https://catalogue.data.wa.gov.au/dataset/mrwa-road-network). The Commissioner of Main Roads is the creator and owner of the source data. This map derives nearby street labels from that data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), which includes disclaimers of warranties and liability.
- **Suburb context** [Australian Bureau of Statistics Suburbs and Localities, ASGS Edition 3](https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SAL/MapServer), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). These areas approximate gazetted suburb boundaries.
- **Landmarks and additional streets** [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Facility naming also references [City of Vincent parks and facilities](https://www.vincent.wa.gov.au/parks-and-facilities) and [Rottnest Express terminal locations](https://rottnestexpress.com.au/ferry-information/our-locations-parking/).
