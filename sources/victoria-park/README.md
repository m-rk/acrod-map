# Town of Victoria Park ACROD parking source

The **Transport** section of the Town’s public map includes an **Acrod Bays** point layer. On 27 November 2026 it returned 93 distinct points, including 41 within the ABS East Victoria Park suburb boundary. The layer supplies coordinates, a bay type and a location label. The count describes the source snapshot. [Town online maps](https://www.victoriapark.wa.gov.au/about/town/places-and-maps/online-maps.aspx) · [ABS suburb reference](https://www.abs.gov.au/census/find-census-data/quickstats/2021/SAL50468)

- **Source** [Acrod Bays GeoJSON service](https://maps.vicpark.wa.gov.au/pozi/qgisserver?MAP=E%3A%2FPoziProjects%2FTransport.qgs&SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=Acrod_Bays&SRSNAME=EPSG%3A4326&OUTPUTFORMAT=GeoJSON)
- **Reuse status** Redistribution terms for this layer are unconfirmed. The Town’s map metadata marks the layer as unavailable for download in the map interface. [Town copyright statement](https://www.victoriapark.wa.gov.au/copyright-statement.aspx)

The council points can be included in `parking.geojson` once the Town confirms redistribution. Use `Asset_Location` for each label and retain every distinct bay point, including bays with the same street address. [GeoJSON contribution guide](../README.md) · [Sample GeoJSON](../examples/perth-bay.geojson)
